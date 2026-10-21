import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const files=['./index.html','./manifest.webmanifest','./fonts.css'];
function walk(dir){for(const item of fs.readdirSync('dist/'+dir,{withFileTypes:true})){const file=path.posix.join(dir,item.name);if(item.isDirectory())walk(file);else if(!file.endsWith('.png')||file.startsWith('icons/'))files.push('./'+file);}}
walk('assets');walk('icons');
const optional=files.filter(file=>file.startsWith('./assets/audio/'));
const required=files.filter(file=>!optional.includes(file));
const version=crypto.createHash('sha256');for(const file of files)version.update(fs.readFileSync('dist/'+file.slice(2)));
const cache='sadooh-app-v1-'+version.digest('hex').slice(0,16);
const worker=`const PREFIX='sadooh-app-v1:'+new URL(self.registration.scope).pathname+':',CACHE=PREFIX+${JSON.stringify(cache)},FILES=${JSON.stringify(files)},REQUIRED=${JSON.stringify(required)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(REQUIRED))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match(new URL('index.html',scope).href)).then(response=>response||Response.error())));return;
 }
 const relative='./'+url.pathname.slice(scope.pathname.length);
 if(!FILES.includes(relative))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const saved=await cache.match(request);if(saved)return saved;
  const response=await fetch(request);if(response.ok&&relative.startsWith('./assets/audio/'))void cache.put(request,response.clone()).catch(()=>{});return response;
 }));
});
`;
fs.writeFileSync('dist/sw.js',worker);
console.log(`PWA: ${files.length} static files, ${cache}`);
