import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEvent,cleanText,capacity,token,digest} from '../server/security';
import {createMatch,submitPlayerMove,resolveChallengeWindow} from '../src/game/engine/gameEngine';
import {projectGameStateForPlayer} from '../src/game/engine/stateProjector';
test('protocol rejects malformed, binary, oversized, unknown and prototype character input',()=>{
 for(const raw of ['null','{}','{',JSON.stringify({type:'HACK',payload:{}}),JSON.stringify({type:'SUBMIT_MOVE',payload:{cardId:'x',claimedCharacter:'__proto__'}}),'x'.repeat(2049),new ArrayBuffer(2)])assert.throws(()=>parseEvent(raw));
});
test('capacity, names and chat are bounded and reject markup, links and control characters',()=>{
 for(const n of [2,9,3.5,'4',null])assert.throws(()=>capacity(n));
 assert.equal(capacity(8),8);
 for(const s of ['', '<script>', 'a'.repeat(25),'abc\u202etest'])assert.throws(()=>cleanText(s,24));
 for(const text of ['https://example.com','www.example.com','<img src=x>','x'.repeat(141)])assert.throws(()=>parseEvent(JSON.stringify({type:'SEND_CHAT',payload:{text}})));
 assert.equal(cleanText('  حي الله الشباب  '),'حي الله الشباب');
});
test('tokens are high entropy, stored hashes stable, no raw secret in hash',async()=>{
 const a=token(),b=token();assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);assert.equal(await digest(a),await digest(a));assert.notEqual(await digest(a),a);
});
test('projection excludes hands, draw pile, memories and the secret played card',()=>{
 let g=createMatch({humanPlayerName:'اختبار',botCount:2,botDifficulty:'hard'});
 const p=g.players[0];g=submitPlayerMove(g,{playerId:p.id,cardId:p.hand[0].id,claimedCharacter:'sanad'}).nextState;
 const view=projectGameStateForPlayer(g,g.players[1].id);
 assert.equal(view.myHand.length,4);assert.ok(!('drawPile' in view));assert.ok(!('botMemories' in view));
 assert.ok(view.players.every(p=>!('hand' in p)));assert.ok(view.pendingClaimPublic&&!('playedCard' in view.pendingClaimPublic));
 const resolved=resolveChallengeWindow(g,null);assert.equal(projectGameStateForPlayer(resolved,p.id).lastOutcomePublic?.revealedCard,null);
});
