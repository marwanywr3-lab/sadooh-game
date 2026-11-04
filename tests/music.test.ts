import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {transitionDuration,FEEDBACK_TIMINGS} from '../src/services/feedbackEvents';
import {createRoom,reduceEvent,projection,tick} from '../server/roomEngine';
import {SoundManager} from '../src/services/soundManager';
import {loadUserSettings,saveUserSettings} from '../src/services/storage/localSettings';

test('presentation is start 3.5s, full-roster round 3s, victory 5.5s; no pause on ordinary turns',()=>{
 const state={matchId:'x',turnNumber:1,phase:'CHOOSING_MOVE',players:[{},{},{}]};
 assert.equal(transitionDuration(null,state),3500);
 assert.equal(transitionDuration(state,{...state,turnNumber:2}),0);
 assert.equal(transitionDuration({...state,turnNumber:3},{...state,turnNumber:4}),3000);
 assert.equal(transitionDuration(state,{...state,phase:'GAME_OVER'}),0);
 assert.equal(FEEDBACK_TIMINGS.results,5500);
});

test('server protects full turn time and rejects early moves even after a client skips',()=>{
 const room=createRoom('F'.repeat(32),'host','Host',3,100000);
 for(const name of ['a','b'])reduceEvent(room,name,{type:'JOIN_ROOM',payload:{roomCode:room.room.roomCode,playerName:name}},100000);
 reduceEvent(room,'host',{type:'START_MATCH',payload:{roomCode:room.room.roomCode,turnDurationSeconds:30}},100000);
 assert.equal(room.readyAt,103500);assert.equal(room.deadline,133500);
 const g=room.game!,move={type:'SUBMIT_MOVE' as const,payload:{cardId:g.players[0].hand[0].id,claimedCharacter:'sanad' as const,targetPlayerId:null}},ctx={matchId:g.matchId,turnNumber:1};
 assert.throws(()=>reduceEvent(room,'host',move,103499,ctx),/الانتقال/);
 assert.equal(projection(room,'a',102000).view!.turnTimerSeconds,30);
 assert.equal(projection(room,'a',102000).view!.transitionRemainingMs,1500);
 assert.equal(tick(room,103499),false);
 reduceEvent(room,'host',move,103500,ctx);assert.equal(room.game!.phase,'CHALLENGE_WINDOW');
 assert.equal(room.deadline,115500); // Challenge remains 12 seconds, no music delay.
});

test('new round server pause applies once to humans and bots, old rooms remain compatible',()=>{
 const room=createRoom('F'.repeat(32),'host','Host',3,100000);
 reduceEvent(room,'host',{type:'ADD_BOT',payload:{difficulty:'easy'}},100000);
 reduceEvent(room,'host',{type:'ADD_BOT',payload:{difficulty:'easy'}},100000);
 reduceEvent(room,'host',{type:'START_MATCH',payload:{roomCode:room.room.roomCode}},100000);
 const g=room.game!;g.turnNumber=3;g.currentPlayerIndex=2;g.phase='RESOLVING_CHALLENGE';room.deadline=110000;
 tick(room,110000);assert.equal(room.game!.turnNumber,4);assert.equal(room.readyAt,113000);assert.equal(room.deadline,143000);
 assert.equal(tick(room,112999),false);assert.equal(projection(room,'host',111000).view!.turnTimerSeconds,30);
 delete room.readyAt;assert.equal(projection(room,'host',114000).view!.transitionRemainingMs,0);
});

test('music preferences are independent, bounded and persistent',()=>{
 let raw='{}';Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:()=>raw,setItem:(_k:string,v:string)=>raw=v},dispatchEvent:()=>{}}});
 saveUserSettings({musicEnabled:false,musicVolume:.2,soundEnabled:true});assert.equal(loadUserSettings().musicEnabled,false);assert.equal(loadUserSettings().soundEnabled,true);
 raw=JSON.stringify({musicVolume:7,musicEnabled:'false'});assert.equal(loadUserSettings().musicVolume,1);assert.equal(loadUserSettings().musicEnabled,true);
});

test('three distinct music excerpts retain CC0 provenance and exact hashes',()=>{
 const clips=JSON.parse(fs.readFileSync('public/assets/audio/music-sources.json','utf8'));
 assert.equal(clips.length,3);assert.equal(new Set(clips.map((c:any)=>c.originalFile)).size,3);
 for(const c of clips){assert.equal(c.license,'CC0-1.0');assert.equal(c.source,'https://opengameart.org/content/5-chiptunes-action');const bytes=fs.readFileSync('public/assets/audio/'+c.file);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),c.sha256);}
});

test('music never loops or overlaps, skip cancels pending playback, mute and effects are independent',async()=>{
 let now=1000;const nodes:any[]=[];const fades:number[]=[];
 class Context {state='running';currentTime=0;destination={};resume(){return Promise.resolve();}createGain(){return {gain:{value:0,setValueAtTime:(v:number)=>fades.push(v),linearRampToValueAtTime:(v:number)=>fades.push(v)},connect(){},disconnect(){}};}decodeAudioData(){return Promise.resolve({duration:3});}createBufferSource(){const n={buffer:null,loop:false,stopped:false,connect(){},disconnect(){},addEventListener(){},start(){nodes.push(n);},stop(){n.stopped=true;}};return n;}}
 Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:Context});Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,baseURI:'https://example.test/'}});Object.defineProperty(globalThis,'fetch',{configurable:true,value:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})});
 const flush=()=>new Promise(r=>setImmediate(r));const music=new SoundManager({start:'music-start.wav',round:'music-round.wav',end:'music-end.wav'},true),effects=new SoundManager();
 music.unlock();effects.unlock();await flush();music.play('start','one');await flush();assert.equal(nodes.length,1);music.play('start','one');await flush();assert.equal(nodes.length,1);
 now+=1000;music.play('round','two');await flush();assert.equal(nodes.length,2);assert.ok(nodes[0].stopped);assert.ok(nodes.every(n=>n.loop===false));assert.ok(fades.includes(0)&&fades.includes(1));
 now+=1000;music.play('end','pending');music.stop();await flush();assert.equal(nodes.length,2);assert.ok(nodes[1].stopped);
 music.configure(false,.3);effects.play('flip','effect');await flush();assert.equal(nodes.length,3);music.play('end','muted');await flush();assert.equal(nodes.length,3);
 (document as any).hidden=true;effects.play('victory','hidden');await flush();assert.equal(nodes.length,3);effects.stop();music.stop();
});
