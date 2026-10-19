import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../src/config/supabase';
const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
assert.ifError((await client.auth.signInAnonymously()).error);
let code='';
async function call(type:string,payload:unknown={}){
 const {data,error}=await client.functions.invoke('sadooh-api',{body:{type,payload,roomCode:code,requestId:crypto.randomUUID()}});
 if(error){let detail='';try{detail=JSON.stringify(await error.context.json());}catch{}throw Error(`${type}: ${detail||error.message}`);}return data;
}
const made=await call('CREATE_ROOM',{playerName:'اختبار المؤقت',maxPlayers:3});code=made.room.roomCode;
await call('ADD_BOT',{difficulty:'easy'});await call('ADD_BOT',{difficulty:'hard'});
let state=await call('START_MATCH',{roomCode:code});assert.equal(state.view.phase,'CHOOSING_MOVE');
const early=await call('TICK');assert.equal(early.view.phase,'CHOOSING_MOVE');assert.equal(early.view.turnNumber,1);
console.log('PASS early tick cannot accelerate a human turn');
// Stop sending heartbeats, then reconnect after the authoritative deadline.
await new Promise(r=>setTimeout(r,Math.max(0,state.deadline-state.serverNow+700)));
state=await call('SYNC');assert.equal(state.view.phase,'CHALLENGE_WINDOW');
console.log('PASS reconnect after silence executes the timed-out human move');
let botTurn=false,botMove=false;
for(let i=0;i<12;i++){
 if(state.view.phase==='GAME_OVER')break;
 const active=state.view.players[state.view.currentPlayerIndex];
 if(state.view.phase==='CHOOSING_MOVE'&&active.isBot)botTurn=true;
 if(state.view.phase==='CHALLENGE_WINDOW'&&state.view.players.find((p:{id:string})=>p.id===state.view.pendingClaimPublic.playerId)?.isBot)botMove=true;
 if(botTurn&&botMove)break;
 await new Promise(r=>setTimeout(r,Math.max(150,state.nextActionAt-state.serverNow+500)));
 state=await call('TICK');
}
assert.ok(botTurn&&botMove);console.log('PASS server bots progress through real timed turns');
console.log(JSON.stringify({passed:3,roomCode:code,turn:state.view.turnNumber,phase:state.view.phase}));
await client.removeAllChannels();
