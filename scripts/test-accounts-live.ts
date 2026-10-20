import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../src/config/supabase';
const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`sadooh-test-${crypto.randomUUID()}@example.com`,password=crypto.randomUUID()+'aA!';
let roomCode='';
async function call(type:string,payload:unknown={},extra:object={}){
 const r=await client.functions.invoke('sadooh-api',{body:{type,payload,roomCode,requestId:crypto.randomUUID(),...extra}});assert.ifError(r.error);return r.data;
}
try{
 const made=await client.auth.signUp({email,password});assert.ifError(made.error);assert.ok(made.data.session,'registration must return a session without email verification');
 let account=await call('ACCOUNT',{}, {action:'GET'});assert.equal(account.isPro,false);assert.equal(account.remaining,8);assert.equal(account.enforced,true);
 await call('ACCOUNT',{}, {action:'SAVE_NAME',value:{username:'اختبار حساب'}});
 const room=await call('CREATE_ROOM',{maxPlayers:3,playerName:'ignored'});roomCode=room.room.roomCode;assert.equal(room.room.members[0].name,'اختبار حساب');
 await call('ADD_BOT',{difficulty:'easy'});await call('ADD_BOT',{difficulty:'easy'});await call('START_MATCH',{roomCode});
 account=await call('ACCOUNT',{}, {action:'GET'});assert.equal(account.used,1);assert.equal(account.remaining,7);
 const denied=await client.functions.invoke('sadooh-api',{body:{type:'ACCOUNT',action:'ADMIN_SETUP',value:{code:'Abcdefgh1234567!'},requestId:crypto.randomUUID()}});assert.ok(denied.error);
 const rpc=await client.rpc('sadooh_account',{p_uid:made.data.user!.id});assert.ok(rpc.error);
 await client.auth.signOut();const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);assert.ok(login.data.session);
 account=await call('ACCOUNT',{}, {action:'GET'});assert.equal(account.username,'اختبار حساب');assert.equal(account.used,1);
 console.log('PASS: signup without confirmation, password login, saved username, host round charged once, quota persisted and admin operations denied to ordinary account.');
}finally{if(roomCode){try{await call('LEAVE_ROOM',{roomCode});}catch{}}await client.auth.signOut();await client.removeAllChannels();}
