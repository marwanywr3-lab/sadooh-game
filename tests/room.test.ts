import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,reduceEvent,projection,tick} from '../server/roomEngine';
const host='11111111-1111-4111-8111-111111111111',guest='22222222-2222-4222-8222-222222222222',third='33333333-3333-4333-8333-333333333333';
function setup(){const s=createRoom('A'.repeat(32),host,'المضيف',4,100000);reduceEvent(s,guest,{type:'JOIN_ROOM',payload:{roomCode:s.room.roomCode,playerName:'ضيف'}},100000);reduceEvent(s,third,{type:'JOIN_ROOM',payload:{roomCode:s.room.roomCode,playerName:'ضيف آخر'}},100000);return s;}
test('host privileges and waiting room capacity cannot be bypassed',()=>{
 const s=setup();assert.throws(()=>reduceEvent(s,guest,{type:'ADD_BOT',payload:{difficulty:'hard'}},100000));
 assert.throws(()=>reduceEvent(s,host,{type:'UPDATE_MAX_PLAYERS',payload:{maxPlayers:2}},100000));
 reduceEvent(s,host,{type:'ADD_BOT',payload:{difficulty:'hard'}},100000);
 assert.throws(()=>reduceEvent(s,'outsider',{type:'JOIN_ROOM',payload:{roomCode:s.room.roomCode,playerName:'متطفل'}},100000));
});
test('server deck uses opaque identifiers; all 48 cards stay unique and balanced',()=>{
 const s=setup();reduceEvent(s,host,{type:'START_MATCH',payload:{roomCode:s.room.roomCode}},100000);
 const cards=[...s.game!.drawPile,...s.game!.players.flatMap(p=>p.hand)];assert.equal(cards.length,48);assert.equal(new Set(cards.map(c=>c.id)).size,48);
 for(const c of cards){assert.match(c.id,/^[a-f0-9-]{36}$/);assert.ok(!c.id.includes(c.characterId));}
});
test('server rejects wrong actor, stale turn, fake card and claimant challenge',()=>{
 const s=setup();reduceEvent(s,host,{type:'START_MATCH',payload:{roomCode:s.room.roomCode}},100000);const g=s.game!;
 const e={type:'SUBMIT_MOVE' as const,payload:{cardId:g.players[0].hand[0].id,claimedCharacter:'sanad' as const,targetPlayerId:null}};
 const ctx={matchId:g.matchId,turnNumber:g.turnNumber};
 assert.throws(()=>reduceEvent(s,guest,e,100001,ctx));assert.throws(()=>reduceEvent(s,host,e,100001,{...ctx,turnNumber:0}));
 assert.throws(()=>reduceEvent(s,host,{...e,payload:{...e.payload,cardId:'fake'}},100001,ctx));
 reduceEvent(s,host,e,100001,ctx);
 assert.throws(()=>reduceEvent(s,host,{type:'PRESS_SADOOH',payload:ctx},100002));
 const deadline=s.deadline;reduceEvent(s,guest,{type:'PASS_CHALLENGE',payload:ctx},100002);assert.equal(s.deadline,deadline);assert.equal(s.game!.phase,'CHALLENGE_WINDOW');
});
test('ticks cannot advance early; server deadlines resolve a disconnected human',()=>{
 const s=setup();reduceEvent(s,host,{type:'START_MATCH',payload:{roomCode:s.room.roomCode}},100000);
 assert.equal(tick(s,114999),false);assert.equal(s.game!.phase,'CHOOSING_MOVE');
 assert.equal(tick(s,115000),true);assert.equal(s.game!.phase,'CHALLENGE_WINDOW');
 assert.equal(tick(s,120000),true);assert.notEqual(s.game!.phase,'CHALLENGE_WINDOW');
});
test('mute is per viewer, reports capture evidence and outsiders cannot get a projection',()=>{
 const s=setup();reduceEvent(s,guest,{type:'SEND_CHAT',payload:{text:'حي الله الشباب'}},100000);
 reduceEvent(s,host,{type:'MUTE_PLAYER',payload:{targetPlayerId:guest,muted:true}},100001);
 assert.equal(projection(s,host,100001).room.chatHistory.length,0);assert.equal(projection(s,third,100001).room.chatHistory.length,1);
 const r=reduceEvent(s,host,{type:'REPORT_ABUSE',payload:{targetPlayerId:guest,reason:'اختبار البلاغات'}},100001);assert.equal(r?.reporter,host);assert.equal((r?.evidence as unknown[]).length,1);
 assert.throws(()=>projection(s,'outsider',100001));assert.throws(()=>reduceEvent(s,guest,{type:'SEND_CHAT',payload:{text:'تكرار سريع'}},100001));
});
