export interface InstallPrompt extends Event {
 prompt:()=>Promise<void>;
 userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
}
let pending:InstallPrompt|null=null;
const listeners=new Set<()=>void>();
export const getInstallPrompt=()=>pending;
export function subscribeInstall(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event as InstallPrompt;listeners.forEach(fn=>fn());});
window.addEventListener('appinstalled',()=>{pending=null;listeners.forEach(fn=>fn());});
export async function promptInstall(){
 const event=pending;if(!event)return false;
 pending=null;listeners.forEach(fn=>fn());
 await event.prompt();return (await event.userChoice).outcome==='accepted';
}
if(import.meta.env.PROD&&'serviceWorker' in navigator){
 window.addEventListener('load',()=>{void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL,updateViaCache:'none'}).catch(()=>{/* The online game still works when offline storage is unavailable. */});});
}
