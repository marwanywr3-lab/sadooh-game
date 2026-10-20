import { createClient } from '@supabase/supabase-js';
import { createRoom, createPartyRoom, isDisplay, tick, reduceEvent, projection, allProjections, type SavedRoom } from '../../../server/roomEngine';
import { parseEvent, digest, cleanText, capacity } from '../../../server/security';

const url=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=['https://sadoh.marwanbarbood.com','https://marwanywr3-lab.github.io','http://localhost:5173','http://127.0.0.1:5173'];
async function rpc(name:string,args:Record<string,unknown>){const r=await admin.rpc(name,args);if(r.error)throw Error('تعذر حفظ حالة الغرفة.');return r.data;}

Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')||'';
 const cors={'Access-Control-Allow-Origin':origins.includes(origin)?origin:origins[0],'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','X-Content-Type-Options':'nosniff'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method==='GET')return reply({ok:true,service:'sadooh-api',backend:'supabase'});
 if(req.method!=='POST')return reply({error:'طريقة غير مسموحة.'},405);
 if(origin&&!origins.includes(origin))return reply({error:'Origin غير مسموح.'},403);
 try{
  const reader=req.body?.getReader();let total=0;const chunks:Uint8Array[]=[];
  if(reader)while(true){const r=await reader.read();if(r.done)break;total+=r.value.length;if(total>4096){await reader.cancel();return reply({error:'طلب كبير.'},413);}chunks.push(r.value);}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  if(body.type==='SCHEDULED_TICK'){
   if(typeof body.scheduler!=='string'||body.scheduler.length!==64||!await rpc('sadooh_scheduler_authorize',{p_hash:await digest(body.scheduler)}))return reply({error:'غير مصرح.'},401);
   if(typeof body.roomCode!=='string'||!/^[A-F0-9]{32}$/.test(body.roomCode))return reply({error:'طلب غير صالح.'},400);
   for(let i=0;i<4;i++){
    const loaded=await rpc('sadooh_load',{p_code:body.roomCode});if(!loaded)return reply({ok:true});
    const s=loaded.state as SavedRoom,now=Number(loaded.now);
    if(!tick(s,now))return reply({ok:true});
    if(await rpc('sadooh_commit',{p_code:body.roomCode,p_revision:loaded.revision,p_state:s,p_views:allProjections(s,now),p_report:null}))return reply({ok:true});
   }
   return reply({error:'busy'},409);
  }
  const jwt=req.headers.get('Authorization')?.replace(/^Bearer /i,'')||'';
  const {data:{user},error:authError}=await admin.auth.getUser(jwt);
  if(authError||!user)return reply({error:'سجّل دخولك أولًا.'},401);
  const uid=user.id;
  if(!await rpc('sadooh_allow',{p_key:`request:${uid}`,p_window:10,p_max:30}))return reply({error:'طلبات كثيرة؛ انتظر قليلًا.'},429);
  const requestId=cleanText(body.requestId,64);
  if(!/^[a-f0-9-]{36}$/i.test(requestId))return reply({error:'معرف الطلب غير صالح.'},400);
  if(body.type==='CREATE_ROOM'||body.type==='CREATE_PARTY_ROOM'){
   // Room creation has no hourly quota. The general request throttle above still applies.
   const code=crypto.randomUUID().replaceAll('-','').toUpperCase(),now=Date.now();
   const s=body.type==='CREATE_PARTY_ROOM'?createPartyRoom(code,uid,capacity(body.payload?.maxPlayers),now):createRoom(code,uid,cleanText(body.payload?.playerName,24),capacity(body.payload?.maxPlayers),now);
   s.receipts.push(`${uid}:${requestId}`);
   const ok=await rpc('sadooh_commit',{p_code:code,p_revision:-1,p_state:s,p_views:allProjections(s,now),p_report:null});
   if(!ok)throw Error('تعذر إنشاء الغرفة.');return reply({...projection(s,uid,now),revision:0});
  }
  const code=body.roomCode;if(typeof code!=='string'||!/^[A-F0-9]{32}$/.test(code))return reply({error:'رمز غرفة غير صالح.'},400);
  const event=['TICK','SYNC'].includes(body.type)?null:parseEvent(JSON.stringify({type:body.type,payload:body.payload}));
  for(let attempt=0;attempt<4;attempt++){
   const loaded=await rpc('sadooh_load',{p_code:code});if(!loaded)return reply({error:'الغرفة غير موجودة أو انتهت.'},404);
   const s=loaded.state as SavedRoom,now=Number(loaded.now),revision=Number(loaded.revision);
   const isMember=s.room.members.some(m=>m.id===uid&&!m.isBot);
   if(!isMember&&!isDisplay(s,uid)&&event?.type!=='JOIN_ROOM')return reply({error:'لست عضوًا في الغرفة.'},403);
   if(s.receipts.includes(`${uid}:${requestId}`))return reply({...projection(s,uid,now),revision});
   let changed=tick(s,now),report=null,errorAr:string|null=null;
   if(event){try{report=reduceEvent(s,uid,event,now,body.context);changed=true;}catch(e){errorAr=e instanceof Error?e.message:'طلب غير صالح.';}}
   else if(now-(s.lastSeen[uid]||0)>15000){s.lastSeen[uid]=now;changed=true;}
   if(!changed){if(errorAr)return reply({error:errorAr},400);return reply({...projection(s,uid,now),revision});}
   s.receipts=[...s.receipts,`${uid}:${requestId}`].slice(-100);
   const ok=await rpc('sadooh_commit',{p_code:code,p_revision:revision,p_state:s,p_views:allProjections(s,now),p_report:report});
   if(ok){
    if(errorAr)return reply({error:errorAr},400);
    if(event?.type==='LEAVE_ROOM')return reply({left:true});
    return reply({...projection(s,uid,now),revision:revision+1,reportId:report?.id,notice:report?'حُفظ البلاغ للمراجعة؛ لا توجد مراجعة بشرية تلقائية.':undefined});
   }
  }
  return reply({error:'تغيّرت حالة الغرفة؛ أعد المحاولة.'},409);
 }catch(e){return reply({error:e instanceof Error?e.message:'تعذر تنفيذ الطلب.'},400);}
});
