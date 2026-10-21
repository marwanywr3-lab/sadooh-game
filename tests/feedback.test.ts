import test from 'node:test';
import assert from 'node:assert/strict';
import {FeedbackEvents,getRoundNumber} from '../src/services/feedbackEvents';
import {SoundManager} from '../src/services/soundManager';
import {loadUserSettings,saveUserSettings} from '../src/services/storage/localSettings';

test('timer snapshots and duplicate notifications never replay feedback',()=>{
 const events=new FeedbackEvents();const state={matchId:'one',turnNumber:1,phase:'CHOOSING_MOVE',players:[{},{},{}]};
 assert.deepEqual(events.observe(state),['start']);
 for(let i=0;i<40;i++)assert.deepEqual(events.observe({...state}),[]);
 assert.deepEqual(events.observe({...state,phase:'CHALLENGE_WINDOW'}),[]);
 assert.deepEqual(events.observe({...state,turnNumber:2}),[]);
 assert.deepEqual(events.observe({...state,turnNumber:3}),[]);
 assert.deepEqual(events.observe({...state,turnNumber:4}),['turn']);
 assert.deepEqual(events.observe({...state,turnNumber:2,phase:'GAME_OVER'}),['results']);
 assert.deepEqual(events.observe({...state,turnNumber:2,phase:'GAME_OVER'}),[]);
});
test('reconnection skips intro, fresh online starts and new local matches still animate',()=>{
 const state={matchId:'one',turnNumber:1,phase:'CHOOSING_MOVE',players:[{},{},{}]};
 assert.deepEqual(new FeedbackEvents().observe(state,true),[]);
 assert.deepEqual(new FeedbackEvents().observe({...state,turnNumber:9},true,true),[]);
 assert.deepEqual(new FeedbackEvents().observe(state,true,true),['start']);
 const events=new FeedbackEvents();events.observe(state);
 assert.deepEqual(events.observe({...state,matchId:'two'}),['start']);
});
test('sound preferences migrate safely and persist mute and volume',()=>{
 let raw=JSON.stringify({playerName:'اختبار',soundEnabled:false,soundVolume:4});let notifications=0;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}},dispatchEvent:()=>{notifications++;}}});
 assert.equal(loadUserSettings().soundEnabled,false);assert.equal(loadUserSettings().soundVolume,1);
 saveUserSettings({soundVolume:.2});assert.equal(loadUserSettings().soundVolume,.2);assert.equal(loadUserSettings().soundEnabled,false);assert.equal(notifications,1);
 raw='null';assert.equal(loadUserSettings().soundVolume,.35);
 raw=JSON.stringify({soundVolume:'bad'});assert.equal(loadUserSettings().soundVolume,.35);
});
test('audio respects autoplay, mute, gain volume, duplicate events and hidden tabs',async()=>{
 let now=1000,attempts=0;const nodes:Array<{stopped:boolean}>=[];const gain={gain:{value:0},connect:()=>{}};
 class FakeContext {state='running';destination={};createGain(){return gain;}resume(){return Promise.resolve();}decodeAudioData(){return Promise.resolve({});}createBufferSource(){const source={buffer:null,onended:null,stopped:false,connect:()=>{},disconnect:()=>{},start:()=>{attempts++;},stop:()=>{source.stopped=true;}};nodes.push(source);return source;}}
 Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:FakeContext});
 Object.defineProperty(globalThis,'fetch',{configurable:true,value:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,baseURI:'https://example.test/game/'}});
 Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const sound=new SoundManager();sound.play('whoosh','locked');await flush();assert.equal(attempts,0);
 sound.unlock();await flush();sound.play('whoosh','start');sound.play('whoosh','start');await flush();assert.equal(attempts,1);
 sound.configure(false,.2);assert.equal(gain.gain.value,.2);assert.ok(nodes.every(n=>n.stopped));now+=500;sound.play('flip','muted');await flush();assert.equal(attempts,1);
 sound.configure(true,.35);(document as {hidden:boolean}).hidden=true;sound.play('flip','hidden');await flush();assert.equal(attempts,1);(document as {hidden:boolean}).hidden=false;
 sound.play('victory','winner');await flush();assert.equal(attempts,2);sound.stop();assert.ok(nodes.every(n=>n.stopped));
});
test('failed audio downloads and pending playback after leaving remain silent',async()=>{
 Object.defineProperty(globalThis,'fetch',{configurable:true,value:async()=>{throw Error('offline');}});
 const sound=new SoundManager();sound.unlock();sound.play('flip','missing');sound.stop();await new Promise(resolve=>setImmediate(resolve));
});

test('a new round starts only after every player has played, for all supported roster sizes',()=>{
 for(let count=3;count<=8;count++){
  const events=new FeedbackEvents();
  for(let turn=1;turn<=count*4;turn++){
   const round=Math.floor((turn-1)/count)+1;
   assert.equal(getRoundNumber(turn,count),round);
   const state={matchId:'lap',turnNumber:turn,phase:'CHOOSING_MOVE',players:Array(count).fill({})};
   assert.deepEqual(events.observe(state),turn===1?['start']:(turn-1)%count===0?['turn']:[]);
   assert.deepEqual(events.observe(state),[]);
  }
 }
});
