import test from 'node:test';
import assert from 'node:assert/strict';
import {createPassPhoneMatch} from '../src/screens/PassPhoneScreen';
import {submitPlayerMove,resolveChallengeWindow,advanceToNextTurn} from '../src/game/engine/gameEngine';
import {projectGameStateForPlayer} from '../src/game/engine/stateProjector';
for(const count of [3,8])test(`one phone deals to ${count} humans`,()=>{
 const names=Array.from({length:count},(_,i)=>`لاعب ${i+1}`),s=createPassPhoneMatch(names);
 assert.deepEqual(s.players.map(p=>p.name),names);assert.ok(s.players.every(p=>!p.isBot&&p.hand.length===4));assert.deepEqual(s.botMemories,{});
});
test('shared table hides hands and peek; next turn is manual',()=>{
 let s=createPassPhoneMatch(['سلطان','ماجد','فهد']);s.players[0].hand[0].characterId='malqoof';const card=s.players[0].hand[0];
 s=submitPlayerMove(s,{playerId:s.players[0].id,cardId:card.id,claimedCharacter:'malqoof',targetPlayerId:s.players[1].id}).nextState;
 assert.equal(s.phase,'CHALLENGE_WINDOW');let pub=projectGameStateForPlayer(s,'table');assert.deepEqual(pub.myHand,[]);assert.ok(!JSON.stringify(pub).includes(card.id));
 s=resolveChallengeWindow(s,null);assert.equal(s.phase,'RESOLVING_CHALLENGE');assert.ok(s.lastOutcome?.privateReveal);pub=projectGameStateForPlayer(s,'table');assert.equal(pub.lastOutcomePublic?.myPrivateReveal,null);
 assert.equal(s.currentPlayerIndex,0);s=advanceToNextTurn(s);assert.equal(s.currentPlayerIndex,1);assert.equal(s.phase,'CHOOSING_MOVE');
});
for(const truth of [true,false])test(`challenge truth=${truth}`,()=>{
 let s=createPassPhoneMatch(['سلطان','ماجد','فهد']);s.players[0].hand[0].characterId=truth?'sanad':'nashal';
 s=submitPlayerMove(s,{playerId:s.players[0].id,cardId:s.players[0].hand[0].id,claimedCharacter:'sanad'}).nextState;
 s=resolveChallengeWindow(s,s.players[1].id);assert.equal(s.lastOutcome?.wasTruthful,truth);assert.equal(s.lastOutcome?.penaltyPlayerId,s.players[truth?1:0].id);
});
