import test from 'node:test';
import assert from 'node:assert/strict';
import {createPartyRoom,projection,allProjections,reduceEvent,type SavedRoom} from '../server/roomEngine';
const display='00000000-0000-4000-8000-000000000001',a='00000000-0000-4000-8000-000000000002',b='00000000-0000-4000-8000-000000000003',c='00000000-0000-4000-8000-000000000004';
function setup(){
 const s=createPartyRoom('D'.repeat(32),display,8,100000);
 for(const [id,name] of [[a,'سلطان'],[b,'ماجد'],[c,'فهد']])reduceEvent(s,id,{type:'JOIN_ROOM',payload:{roomCode:s.room.roomCode,playerName:name}},100001);
 reduceEvent(s,a,{type:'START_MATCH',payload:{roomCode:s.room.roomCode}},100002);return s;
}
function play(s:SavedRoom,truth=true){
 s.game!.players[0].hand[0]={id:'secret_actor_card',characterId:truth?'malqoof':'nashal'};
 s.game!.players[1].hand=s.game!.players[1].hand.map((v,i)=>({...v,id:`secret_target_${i}`}));
 reduceEvent(s,a,{type:'SUBMIT_MOVE',payload:{cardId:'secret_actor_card',claimedCharacter:'malqoof',targetPlayerId:b}},100003,{matchId:s.game!.matchId,turnNumber:s.game!.turnNumber});
}
test('screen does not take a player seat and first phone becomes host',()=>{
 const s=createPartyRoom('D'.repeat(32),display,8,100000);
 assert.equal(s.room.members.length,0);assert.equal(allProjections(s,100000).length,1);
 reduceEvent(s,a,{type:'JOIN_ROOM',payload:{roomCode:s.room.roomCode,playerName:'سلطان'}},100001);
 assert.equal(s.room.hostPlayerId,a);assert.equal(s.room.members[0].isHost,true);
 assert.match(s.room.inviteUrl,/party=1/);
});
test('display cannot join as a player, start, act, challenge, pass or chat',()=>{
 const s=setup();const before=JSON.stringify(s);
 for(const event of [{type:'JOIN_ROOM',payload:{roomCode:s.room.roomCode,playerName:'اختراق'}},{type:'START_MATCH',payload:{roomCode:s.room.roomCode}},{type:'SUBMIT_MOVE',payload:{cardId:'fake',claimedCharacter:'sanad',targetPlayerId:null}},{type:'PRESS_SADOOH',payload:{matchId:s.game!.matchId,turnNumber:1}},{type:'PASS_CHALLENGE',payload:{matchId:s.game!.matchId,turnNumber:1}},{type:'SEND_CHAT',payload:{text:'x'}}] as any[])assert.throws(()=>reduceEvent(s,display,event,100003));
 assert.equal(JSON.stringify(s),before);assert.throws(()=>projection(s,'outsider',100003));
});
test('public display never receives hands, played secret card or private peek',()=>{
 const s=setup();play(s);let pub=projection(s,display,100003).view!;
 assert.deepEqual(pub.myHand,[]);assert.equal(pub.pendingClaimPublic?.claimedCharacter,'malqoof');
 assert.ok(!JSON.stringify(pub).includes('secret_actor_card'));
 const payload={matchId:s.game!.matchId,turnNumber:1};
 reduceEvent(s,b,{type:'PASS_CHALLENGE',payload},100004);
 assert.equal(projection(s,b,100004).view!.hasPassedChallenge,true);
 assert.throws(()=>reduceEvent(s,b,{type:'PRESS_SADOOH',payload},100004));
 reduceEvent(s,c,{type:'PASS_CHALLENGE',payload},100005);
 assert.equal(s.game!.phase,'RESOLVING_CHALLENGE');
 assert.ok(projection(s,a,100005).view!.lastOutcomePublic?.myPrivateReveal);
 pub=projection(s,display,100005).view!;
 assert.equal(pub.lastOutcomePublic?.myPrivateReveal,null);assert.equal(pub.lastOutcomePublic?.revealedCard,null);
 const serialized=JSON.stringify(pub);
 for(const p of s.game!.players)for(const card of p.hand)assert.ok(!serialized.includes(card.id));
 assert.ok(!serialized.includes('secret_actor_card'));assert.ok(!('drawPile' in pub));assert.ok(!('botMemories' in pub));
 assert.ok(pub.players.every(p=>!('hand' in p)));assert.equal(allProjections(s,100005).length,4);
});
test('display shows both challenge outcomes but never anyone’s remaining cards',()=>{
 for(const truth of [true,false]){
  const s=setup();play(s,truth);reduceEvent(s,b,{type:'PRESS_SADOOH',payload:{matchId:s.game!.matchId,turnNumber:1}},100004);
  const pub=projection(s,display,100004).view!;
  assert.equal(pub.lastOutcomePublic?.wasTruthful,truth);assert.equal(pub.lastOutcomePublic?.challenged,true);
  assert.equal(pub.lastOutcomePublic?.penaltyPlayerId,truth?b:a);
  assert.ok(pub.lastOutcomePublic?.revealedCard);assert.deepEqual(pub.myHand,[]);
  for(const p of s.game!.players)for(const card of p.hand)assert.ok(!JSON.stringify(pub).includes(card.id));
 }
});
