import test from 'node:test';
import assert from 'node:assert/strict';
import {createTutorialExample,playTutorialExample,TUTORIAL_PLAYER} from '../src/game/tutorial/tutorialEngine';

test('truthful first play removes one card and grants protection',()=>{
 const s=playTutorialExample(2,createTutorialExample(2));
 assert.equal(s.players[0].hand.length,3);assert.equal(s.players[0].hasSanadShield,true);
});
test('unchallenged bluff applies the declared ability',()=>{
 const s=playTutorialExample(3,createTutorialExample(3));
 assert.equal(s.players[0].hand.length,2);assert.equal(s.players[1].hand.length,5);
 assert.equal(s.lastOutcome?.abilityExecuted,true);
});
test('catching a lie penalizes its author and cancels the ability',()=>{
 const s=playTutorialExample(4,createTutorialExample(4));
 assert.equal(s.lastOutcome?.wasTruthful,false);assert.equal(s.lastOutcome?.penaltyPlayerId,s.players[1].id);
 assert.equal(s.lastOutcome?.abilityExecuted,false);assert.equal(s.players[0].hand.length,4);
});
test('challenging truth penalizes the learner',()=>{
 const s=playTutorialExample(5,createTutorialExample(5));
 assert.equal(s.lastOutcome?.wasTruthful,true);assert.equal(s.lastOutcome?.penaltyPlayerId,TUTORIAL_PLAYER);
 assert.equal(s.players[0].hand.length,5);
});
test('playing the final card wins the final lesson',()=>{
 const s=playTutorialExample(6,createTutorialExample(6));
 assert.equal(s.winnerPlayerId,TUTORIAL_PLAYER);assert.equal(s.phase,'GAME_OVER');
});
