import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const files=['./index.html','./manifest.webmanifest'];
function walk(dir){for(const item of fs.readdirSync('dist/'+dir,{withFileTypes:true})){const file=path.posix.join(dir,item.name);if(item.isDirectory())walk(file);else if(!file.endsWith('.png')||file.startsWith('icons/'))files.push('./'+file);}}
walk('assets');walk('icons');
const version=crypto.createHash('sha256');for(const file of files)version.update(fs.readFileSync('dist/'+file.slice(2)));
const cache='sadooh-app-v1-'+version.digest('hex').slice(0,16);
const worker=`const PREFIX='sadooh-app-v1:'+new URL(self.registration.scope).pathname+':',CACHE=PREFIX+${JSON.stringify(cache)},FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match(new URL('index.html',scope).href)).then(response=>response||Response.error())));return;
 }
 const relative='./'+url.pathname.slice(scope.pathname.length);
 if(!FILES.includes(relative))return;
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request))||fetch(request)));
});
`;
fs.writeFileSync('dist/sw.js',worker);
console.log(`PWA: ${files.length} static files, ${cache}`);
