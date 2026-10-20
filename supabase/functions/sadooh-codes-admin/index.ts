import {createClient} from '@supabase/supabase-js';
const url=Deno.env.get('SUPABASE_URL')!;
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const allowedOrigin='https://marwanywr3-lab.github.io';
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')||'';
 const headers={'Access-Control-Allow-Origin':allowedOrigin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&origin!==allowedOrigin)return reply({error:'غير مصرح.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'طريقة غير مسموحة.'},405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'')||'';
  if(!token||token.length>8192)return reply({error:'سجّل دخول الإدارة.'},401);
  const reader=req.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
  if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024){await reader.cancel();return reply({error:'طلب كبير.'},413);}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  if(!['STATUS','ISSUE'].includes(body.action))return reply({error:'طلب غير صالح.'},400);
  const scoped=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const verified=await scoped.auth.getClaims(token);if(verified.error||!verified.data?.claims)return reply({error:'سجّل دخول الإدارة.'},401);
  const claims=verified.data.claims;const uid=claims.sub,session=claims.session_id;
  if(typeof uid!=='string'||typeof session!=='string'||claims.is_anonymous)return reply({error:'غير مصرح.'},403);
  const user=await service.auth.getUser(token);if(user.error||user.data.user?.id!==uid)return reply({error:'جلسة غير صالحة.'},401);
  const limit=await service.rpc('sadooh_allow',{p_key:'codes-admin:'+uid,p_window:60,p_max:20});if(limit.error||!limit.data)return reply({error:'انتظر دقيقة قبل المحاولة.'},429);
  const methods=Array.isArray(claims.amr)?claims.amr:[];
  const mfaAt=Math.max(0,...methods.filter((m:any)=>m.method==='totp'&&Number.isFinite(m.timestamp)).map((m:any)=>m.timestamp));
  if(body.action==='ISSUE'&&(!['monthly','permanent'].includes(body.kind)||typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.requestId)))return reply({error:'طلب غير صالح.'},400);
  const r=await service.rpc('sadooh_codes_admin',{p_uid:uid,p_session:session,p_action:body.action,p_aal:claims.aal||'aal1',p_mfa_at:mfaAt,p_request:body.action==='ISSUE'?body.requestId:null,p_kind:body.action==='ISSUE'?body.kind:null});
  if(r.error){const e=r.error.message;return reply({error:e==='MFA_REQUIRED'?'أكّد رمز تطبيق المصادقة مجددًا.':e==='RATE_LIMIT'?'بلغت حد الإصدار؛ حاول لاحقًا.':e==='ALREADY_ISSUED'?'سبق تنفيذ هذا الطلب.':'غير مصرح.',code:e==='MFA_REQUIRED'?'MFA_REQUIRED':undefined},e==='RATE_LIMIT'?429:403);}
  return reply(r.data);
 }catch{return reply({error:'تعذر تنفيذ الطلب.'},400);}
});
