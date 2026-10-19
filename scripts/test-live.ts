import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../src/config/supabase';
const clients:SupabaseClient[]=[];const passed:string[]=[];
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function ok(name:string){passed.push(name);console.log('PASS '+name);}
async function user(){const c=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const r=await c.auth.signInAnonymously();assert.ifError(r.error);clients.push(c);return c;}
async function call(c:SupabaseClient,type:string,roomCode='',payload:unknown={},context?:unknown,requestId=crypto.randomUUID()){
 const {data:{session}}=await c.auth.getSession();
 const r=await fetch(`${SUPABASE_URL}/functions/v1/sadooh-api`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session!.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({type,roomCode,payload,context,requestId})});
 return {status:r.status,body:await r.json()};
}
try{
 const [a,b,c,outsider]=await Promise.all([user(),user(),user(),user()]);ok('anonymous Auth sessions');
 const aid=(await a.auth.getSession()).data.session!.user.id,bid=(await b.auth.getSession()).data.session!.user.id;
 const made=await call(a,'CREATE_ROOM','',{playerName:'اختبار المضيف',maxPlayers:4});assert.equal(made.status,200,JSON.stringify(made.body));const code=made.body.room.roomCode;assert.match(code,/^[A-F0-9]{32}$/);ok('create authoritative room');
 assert.equal((await call(b,'JOIN_ROOM',code,{roomCode:code,playerName:'اختبار الضيف'})).status,200);
 assert.equal((await call(c,'JOIN_ROOM',code,{roomCode:code,playerName:'اختبار الثالث'})).status,200);ok('join distinct player sessions');
 assert.equal((await call(outsider,'SYNC',code)).status,403);assert.equal((await call(b,'ADD_BOT',code,{difficulty:'hard'})).status,400);ok('outsider and host privilege rejection');
 const own=await b.from('sadooh_player_views').select('*');assert.ifError(own.error);assert.ok(own.data.length>0&&own.data.every(r=>r.user_id===bid));
 const raw=await b.from('sadooh_rooms').select('*');assert.ok(raw.error);const rpc=await b.rpc('sadooh_load',{p_code:code});assert.ok(rpc.error);ok('RLS isolates projections and hides raw state + privileged RPC');
 let realtimePayload:Record<string,unknown>|null=null;
 const ch=b.channel('test:'+crypto.randomUUID()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'sadooh_player_views',filter:`user_id=eq.${bid}`},p=>{realtimePayload=p.new;});
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Realtime subscription timed out')),15000);ch.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}});});
 const withBot=await call(a,'ADD_BOT',code,{difficulty:'hard'});assert.equal(withBot.status,200);
 for(const bot of withBot.body.room.members.filter((m:{isBot:boolean})=>m.isBot))assert.equal((await call(a,'REMOVE_BOT',code,{botId:bot.id})).status,200);
 assert.equal((await call(a,'START_MATCH',code,{roomCode:code})).status,200);
 for(let i=0;i<50&&!realtimePayload;i++)await delay(100);assert.ok(realtimePayload);assert.equal((realtimePayload as Record<string,unknown>).user_id,bid);ok('Realtime WebSocket delivers only own row');
 let state=(await call(a,'SYNC',code)).body;assert.equal(state.view.myHand.length,4);assert.ok(state.view.players.every((p:Record<string,unknown>)=>!('hand'in p)));assert.ok(!('drawPile'in state.view));
 for(const card of state.view.myHand){assert.match(card.id,/^[a-f0-9-]{36}$/);assert.ok(!card.id.includes(card.characterId));}ok('opaque cards and secret-state projection');
 const context={matchId:state.view.matchId,turnNumber:state.view.turnNumber};
 const move={cardId:state.view.myHand[0].id,claimedCharacter:'sanad',targetPlayerId:null};
 assert.equal((await call(b,'SUBMIT_MOVE',code,move,context)).status,400);
 assert.equal((await call(a,'SUBMIT_MOVE',code,{...move,cardId:'fake'},context)).status,400);
 assert.equal((await call(a,'SUBMIT_MOVE',code,move,{...context,turnNumber:0})).status,400);ok('wrong actor, forged card and stale move rejected');
 const played=await call(a,'SUBMIT_MOVE',code,move,context);assert.equal(played.status,200);assert.ok(!('playedCard'in played.body.view.pendingClaimPublic));
 const passedChallenge=await call(b,'PASS_CHALLENGE',code,context);assert.equal(passedChallenge.status,200,JSON.stringify(passedChallenge.body));assert.equal(passedChallenge.body.view.phase,'CHALLENGE_WINDOW');ok('pass cannot cancel other players challenge window');
 const race=await Promise.all([call(b,'PRESS_SADOOH',code,context),call(c,'PRESS_SADOOH',code,context)]);assert.equal(race.filter(r=>r.status===200).length,1);ok('concurrent challenges commit exactly once');
 const id=crypto.randomUUID();let chat=await call(a,'SEND_CHAT',code,{text:'رسالة اختبار واحدة'},undefined,id);assert.equal(chat.status,200);chat=await call(a,'SEND_CHAT',code,{text:'رسالة اختبار واحدة'},undefined,id);assert.equal(chat.status,200);assert.equal(chat.body.room.chatHistory.filter((m:Record<string,unknown>)=>m.text==='رسالة اختبار واحدة').length,1);ok('request replay is idempotent');
 assert.equal((await call(b,'SEND_CHAT',code,{text:'https://example.com'})).status,400);ok('server chat validation');
 assert.equal((await call(b,'MUTE_PLAYER',code,{targetPlayerId:aid,muted:true})).status,200);
 const muted=(await call(b,'SYNC',code)).body;assert.ok(muted.room.chatHistory.every((m:Record<string,unknown>)=>m.senderId!==aid));
 const report=await call(b,'REPORT_ABUSE',code,{targetPlayerId:aid,reason:'بلاغ تحقق تجريبي'});assert.equal(report.status,200);assert.ok(report.body.reportId);ok('per-player mute and persisted abuse report');
 const session=(await a.auth.getSession()).data.session!;const fresh=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(fresh);assert.ifError((await fresh.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token})).error);
 const restored=await call(fresh,'SYNC',code);assert.equal(restored.status,200);assert.equal(restored.body.view.viewerPlayerId,aid);ok('reconnect retains player identity and cards');
 await b.removeChannel(ch);
 console.log(JSON.stringify({passed:passed.length,roomCode:code,checks:passed},null,2));
}finally{for(const c of clients)await c.removeAllChannels();}
