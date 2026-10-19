import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sw=fs.readFileSync('dist/sw.js','utf8');
function runtime(){
 const handlers={},cached={offline:true};let networkCalls=0;
 const context={URL,Response,self:{registration:{scope:'https://example.test/sadooh-game-site/'},addEventListener:(type,fn)=>handlers[type]=fn},caches:{open:async()=>({match:async()=>cached,addAll:async()=>{}}),keys:async()=>[],delete:async()=>true},fetch:async()=>{networkCalls++;throw Error('offline');}};
 vm.runInNewContext(sw,context);
 return {handlers,cached,networkCalls:()=>networkCalls};
}
test('offline worker never handles authentication, room requests or other sites',()=>{
 const r=runtime();
 for(const request of [{method:'POST',url:'https://example.test/sadooh-game-site/'},{method:'GET',url:'https://project.supabase.co/rest/v1/sadooh_rooms'},{method:'GET',url:'https://example.test/other-project/'},{method:'GET',url:'https://example.test/sadooh-game-site/private-data'}]){
  let handled=false;r.handlers.fetch({request,respondWith:()=>{handled=true;}});assert.equal(handled,false);
 }
 assert.equal(r.networkCalls(),0);
});
test('offline navigation falls back to the static app shell',async()=>{
 const r=runtime();let response;
 r.handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://example.test/sadooh-game-site/?room=123'},respondWith:value=>{response=value;}});
 assert.equal(await response,r.cached);assert.equal(r.networkCalls(),1);
});
test('install manifest uses standalone mode and valid square logo icons',()=>{
 const m=JSON.parse(fs.readFileSync('dist/manifest.webmanifest','utf8'));
 assert.equal(m.display,'standalone');assert.equal(m.scope,'./');assert.equal(m.start_url,'./');
 for(const icon of m.icons){const b=fs.readFileSync('dist/'+icon.src);const size=Number(icon.sizes.split('x')[0]);assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);}
});
