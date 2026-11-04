import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {googleCallbackStatus,googleRedirectUrl} from '../src/services/googleAuth';

test('Google returns only to the game, preserves valid phone invites and drops untrusted destinations',()=>{
 const room='A'.repeat(32);
 const result=new URL(googleRedirectUrl(`https://evil.example/?room=${room}&party=1&next=https://evil.example&code=old#access_token=private`));
 assert.equal(result.origin,'https://sadoh.marwanbarbood.com');
 assert.equal(result.searchParams.get('room'),room);
 assert.equal(result.searchParams.get('party'),'1');
 assert.equal(result.searchParams.get('auth'),'google');
 assert.equal(result.searchParams.has('next'),false);
 assert.equal(result.searchParams.has('code'),false);
 assert.equal(result.hash,'');
 assert.equal(googleRedirectUrl('https://sadoh.marwanbarbood.com/?room=invalid&party=1'),'https://sadoh.marwanbarbood.com/?auth=google');
});

test('cancelled OAuth is recognized without exposing provider error descriptions',()=>{
 assert.deepEqual(googleCallbackStatus('https://sadoh.marwanbarbood.com/?auth=google#error=access_denied&error_description=private'),{active:true,failed:true});
 assert.deepEqual(googleCallbackStatus('https://sadoh.marwanbarbood.com/?auth=google&code=one-use'),{active:true,failed:false});
});

test('Supabase builds a Google PKCE authorization request without requesting extra Google data',async()=>{
 const values=new Map<string,string>();
 const client=createClient('https://example.supabase.co','public-test-key',{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storage:{getItem:(key)=>values.get(key)||null,setItem:(key,value)=>{values.set(key,value);},removeItem:(key)=>{values.delete(key);}}}});
 const result=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:googleRedirectUrl('https://sadoh.marwanbarbood.com/'),skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
 assert.equal(result.error,null);
 const url=new URL(result.data.url!);
 assert.equal(url.searchParams.get('provider'),'google');
 assert.equal(url.searchParams.get('code_challenge_method'),'s256');
 assert.ok(url.searchParams.get('code_challenge'));
 assert.equal(url.searchParams.get('prompt'),'select_account');
 assert.equal(url.searchParams.has('scopes'),false);
 assert.ok([...values.keys()].some(key=>key.endsWith('-code-verifier')));
});
