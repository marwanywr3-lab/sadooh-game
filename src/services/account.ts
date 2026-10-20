import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../config/supabase';
export const accountClient=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:'sadooh.account.v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export type Account={username:string;isPro:boolean;permanent:boolean;proUntil:string|null;isAdmin:boolean;used:number;remaining:number;month:string;prefs:{background?:string;position?:string};enforced:boolean};
export async function accountRequest(action='GET',value:unknown={}):Promise<any>{
 const r=await accountClient.functions.invoke('sadooh-api',{body:{type:'ACCOUNT',action,value,requestId:crypto.randomUUID()}});
 if(r.error){let message='تعذر الاتصال بحسابك.';try{message=(await r.error.context.json()).error||message;}catch{}throw Error(message);}return r.data;
}
export async function proSettings(){const r=await fetch(`${SUPABASE_URL}/functions/v1/sadooh-api`);if(!r.ok)throw Error('تعذر التحقق من الاتصال.');return r.json();}
