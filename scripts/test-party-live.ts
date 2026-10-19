import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../src/config/supabase';
import {CHARACTERS} from '../src/game/rules/characters';
import type {CharacterId} from '../src/types/game';
const clients=await Promise.all(Array.from({length:4},async()=>{
 const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const r=await client.auth.signInAnonymously();assert.ifError(r.error);return{client,token:r.data.session!.access_token,id:r.data.user!.id};
}));
let code='';const [display,host,b,c]=clients;
async function call(user:typeof display,type:string,payload:unknown={},context?:unknown){
 const r=await fetch(`${SUPABASE_URL}/functions/v1/sadooh-api`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${user.token}`,Origin:'https://sadoh.marwanbarbood.com','Content-Type':'application/json'},body:JSON.stringify({type,roomCode:code,payload,context,requestId:crypto.randomUUID()})});
 return {status:r.status,body:await r.json()};
}
let channel:ReturnType<typeof display.client.channel>|undefined;
try{
 const made=await call(display,'CREATE_PARTY_ROOM',{maxPlayers:8});assert.equal(made.status,200,JSON.stringify(made.body));
 code=made.body.room.roomCode;assert.equal(made.body.room.members.length,0);assert.equal(made.body.room.partyMode,true);
 assert.notEqual((await call(display,'JOIN_ROOM',{roomCode:code,playerName:'غير مسموح'})).status,200);
 let updates=0;
 channel=display.client.channel('party-live-'+crypto.randomUUID()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'sadooh_player_views',filter:`user_id=eq.${display.id}`},p=>{const data=(p.new as any).payload;assert.equal(data.view?.myHand.length||0,0);updates++;});
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('realtime timeout')),15000);channel!.subscribe(s=>{if(s==='SUBSCRIBED'){clearTimeout(timer);resolve();}});});
 for(const [user,name] of [[host,'سلطان'],[b,'ماجد'],[c,'فهد']] as const)assert.equal((await call(user,'JOIN_ROOM',{roomCode:code,playerName:name})).status,200);
 const start=await call(host,'START_MATCH',{roomCode:code});assert.equal(start.status,200);assert.equal(start.body.room.hostPlayerId,host.id);
 const privateIds=start.body.view.myHand.map((v:any)=>v.id);
 let publicState=(await call(display,'SYNC')).body;assert.deepEqual(publicState.view.myHand,[]);assert.ok(privateIds.every((id:string)=>!JSON.stringify(publicState).includes(id)));
 assert.equal(publicState.room.members.length,3);
 const denied=await display.client.from('sadooh_player_views').select('*').eq('user_id',host.id);assert.ifError(denied.error);assert.deepEqual(denied.data,[]);
 const hidden=await display.client.from('sadooh_rooms').select('*');assert.ok(hidden.error);
 const card=start.body.view.myHand[0];const context={matchId:start.body.view.matchId,turnNumber:1};
 assert.notEqual((await call(display,'SUBMIT_MOVE',{cardId:card.id,claimedCharacter:card.characterId,targetPlayerId:b.id},context)).status,200);
 const move=await call(host,'SUBMIT_MOVE',{cardId:card.id,claimedCharacter:card.characterId,targetPlayerId:CHARACTERS[card.characterId as CharacterId].requiresTarget?b.id:null,secondaryCardId:start.body.view.myHand[1].id},context);assert.equal(move.status,200,JSON.stringify(move.body));
 const pub=(await call(display,'SYNC')).body;assert.equal(pub.view.phase,'CHALLENGE_WINDOW');assert.ok(!JSON.stringify(pub).includes(card.id));
 const challenge=await call(b,'PRESS_SADOOH',context);assert.equal(challenge.status,200);
 publicState=(await call(display,'SYNC')).body;assert.equal(publicState.view.lastOutcomePublic.wasTruthful,true);assert.equal(publicState.view.lastOutcomePublic.myPrivateReveal,null);assert.deepEqual(publicState.view.myHand,[]);
 const until=Date.now()+6000;while(!updates&&Date.now()<until)await new Promise(r=>setTimeout(r,150));assert.ok(updates>0);
 console.log('PASS: display-only authority, private phone hands, isolated RLS, truthful challenge result and live display updates.');
}finally{
 if(channel)await display.client.removeChannel(channel);
 for(const user of clients.slice(1))if(code)await call(user,'LEAVE_ROOM',{roomCode:code});
 for(const user of clients)await user.client.auth.signOut();
}
