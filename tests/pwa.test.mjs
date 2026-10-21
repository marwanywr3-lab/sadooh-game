import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
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

test('audio failure cannot prevent the offline shell from installing',async()=>{
 const installed=[];let install;
 const context={URL,Response,self:{registration:{scope:'https://example.test/'},addEventListener:(type,fn)=>{if(type==='install')install=fn;}},caches:{open:async()=>({addAll:async files=>{installed.push(...files);if(files.some(file=>file.includes('/audio/')))throw Error('audio unavailable');}})}};
 vm.runInNewContext(sw,context);let completion;
 install({waitUntil:value=>{completion=value;}});await completion;
 assert.ok(installed.includes('./index.html'));assert.ok(installed.every(file=>!file.includes('/audio/')));
 assert.ok(sw.includes('./assets/audio/paper-victory.wav'));
});

test('the Arabic font is local, licensed and available to the offline app',()=>{
 const html=fs.readFileSync('dist/index.html','utf8'),css=fs.readFileSync('dist/fonts.css','utf8');
 assert.ok(html.includes('./fonts.css'));assert.ok(!html.includes('fonts.googleapis.com'));
 for(const subset of ['arabic','latin']){
  const file=`assets/fonts/baloo-bhaijaan-2-${subset}.woff2`;
  assert.equal(fs.readFileSync('dist/'+file).toString('ascii',0,4),'wOF2');
  assert.ok(css.includes('./'+file));assert.ok(sw.includes('./'+file));
 }
 assert.match(fs.readFileSync('dist/assets/fonts/OFL.txt','utf8'),/SIL OPEN FONT LICENSE/);
 assert.ok(sw.includes('./fonts.css'));
});

test('natural paper feedback files match their documented licensed recordings',()=>{
 const clips=JSON.parse(fs.readFileSync('dist/assets/audio/sources.json','utf8'));
 assert.equal(clips.length,6);
 for(const clip of clips){
  assert.equal(clip.license,'CC0-1.0');assert.equal(clip.sourcePage,'https://kenney.nl/assets/casino-audio');
  assert.match(clip.originalSha256,/^[a-f0-9]{64}$/);
  const bytes=fs.readFileSync('dist/assets/audio/'+clip.file);assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),clip.sha256);
  assert.ok(clip.durationSeconds>0&&clip.durationSeconds<1.5);
 }
});
