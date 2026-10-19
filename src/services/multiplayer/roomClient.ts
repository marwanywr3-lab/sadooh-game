import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { ClientProjectedGameState } from '../../types/game';
import type { ClientToServerEvent, RoomState, ConnectionStatus } from '../../types/multiplayer';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../config/supabase';
type Projection={room:RoomState;view:ClientProjectedGameState|null;revision:number;deadline:number;nextActionAt:number;serverNow:number;notice?:string};
const KEY='sadooh.room.v2';
// One Auth client per tab also survives React remounts and avoids competing token refreshes.
let sharedClient:SupabaseClient|undefined;
function getClient(){
 return sharedClient??=createClient(import.meta.env.VITE_SUPABASE_URL||SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||SUPABASE_PUBLISHABLE_KEY,{auth:{storage:sessionStorage,storageKey:'sadooh.auth.v1',persistSession:true,autoRefreshToken:true}});
}
export class SupabaseRoomService {
 private state:RoomState={roomCode:'',inviteUrl:'',hostPlayerId:'',maxPlayers:4,status:'waiting',connectionStatus:'disconnected',members:[],chatHistory:[]};
 private listeners=new Set<(state:RoomState,banner:string|null)=>void>();
 private matchListeners=new Set<(view:ClientProjectedGameState)=>void>();
 private client:SupabaseClient;private channel:RealtimeChannel|null=null;
 private userId='';private code='';private revision=-1;private stopped=false;
 private timeout:ReturnType<typeof setTimeout>|undefined;private heartbeat:ReturnType<typeof setInterval>|undefined;private uiTimer:ReturnType<typeof setInterval>|undefined;
 private deadline=0;private offset=0;private nextActionAt=0;private queue:Promise<void>=Promise.resolve();
 view:ClientProjectedGameState|null=null;
 constructor(_name:string){
  this.client=getClient();
  try{this.code=sessionStorage.getItem(KEY)||'';}catch{/* storage disabled */}
 }
 get playerId(){return this.userId;}
 getState(){return this.state;}
 subscribe(fn:(state:RoomState,banner:string|null)=>void){this.listeners.add(fn);fn(this.state,null);return()=>{this.listeners.delete(fn);};}
 subscribeMatch(fn:(view:ClientProjectedGameState)=>void){this.matchListeners.add(fn);if(this.view)fn(this.view);return()=>{this.matchListeners.delete(fn);};}
 private emit(banner:string|null=null){for(const fn of this.listeners)fn(this.state,banner);}
 private status(connectionStatus:ConnectionStatus,banner:string|null=null){this.state={...this.state,connectionStatus};this.emit(banner);}
 setPlayerName(_name:string){this.emit('يُعتمد الاسم عند إنشاء الغرفة أو الانضمام إليها.');}
 simulateConnectionToggle(_status:ConnectionStatus){this.reconnect();}
 reconnect(){if(this.code)this.sendEvent({type:'RECONNECT_MATCH',payload:{roomCode:this.code,playerId:this.userId,reconnectToken:''}});else this.emit('أنشئ غرفة أو انضم عبر الدعوة.');}
 private async authenticate(){
  const current=await this.client.auth.getSession();
  if(!current.data.session){const r=await this.client.auth.signInAnonymously();if(r.error)throw Error('تعذر دخول الضيف. تحقق من الاتصال أو إعدادات Supabase.');this.userId=r.data.user!.id;}
  else this.userId=current.data.session.user.id;
 }
 private async call(type:string,payload:unknown={},context?:unknown):Promise<Projection>{
  const result=await this.client.functions.invoke('sadooh-api',{body:{type,payload,context,roomCode:this.code,requestId:crypto.randomUUID()}});
  if(result.error){let msg='تعذر الوصول إلى خادم اللعبة.';try{const response=(result.error as {context?:Response}).context;if(response){const body=await response.json();msg=body.error||msg;}}catch{/* network error */}throw Error(msg);}
  return result.data;
 }
 private accept(p:Projection){
  if(!p?.room||p.room.roomCode!==this.code||p.revision<this.revision)return;
  this.revision=p.revision;this.offset=p.serverNow-Date.now();this.deadline=p.deadline;this.nextActionAt=p.nextActionAt;
  this.state={...p.room,connectionStatus:this.state.connectionStatus==='reconnecting'?'reconnecting':'connected'};
  this.view=p.view;this.emit(p.notice||null);if(this.view)for(const fn of this.matchListeners)fn(this.view);this.scheduleTick();
 }
 private scheduleTick(){
  clearTimeout(this.timeout);
  if(!this.stopped&&this.nextActionAt){const delay=Math.max(120,this.nextActionAt-Date.now()-this.offset+100+Math.random()*120);this.timeout=setTimeout(()=>{void this.sync('TICK');},delay);}
 }
 private async sync(type='SYNC'){
  if(this.stopped||!this.code)return;
  try{const p=await this.call(type);if(this.stopped)return;this.accept(p);}catch(e){this.status('reconnecting',e instanceof Error?e.message:'انقطع الاتصال.');this.timeout=setTimeout(()=>{void this.sync();},3000);}
 }
 private async connect(p:Projection){
  this.stopped=false;this.code=p.room.roomCode;this.revision=-1;try{sessionStorage.setItem(KEY,this.code);}catch{/* storage disabled */}
  if(this.channel)await this.client.removeChannel(this.channel);
  clearInterval(this.heartbeat);clearInterval(this.uiTimer);this.status('connecting');this.accept(p);
  this.channel=this.client.channel(`sadooh:${this.code}:${this.userId}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'sadooh_player_views',filter:`user_id=eq.${this.userId}`},event=>{
    const row=event.new as {payload?:Projection;revision?:number;room_code?:string};if(row.payload&&row.room_code===this.code)this.accept({...row.payload,revision:Number(row.revision)});
   }).subscribe(status=>{
    if(this.stopped)return;
    if(status==='SUBSCRIBED'){this.status('connected','متصل بالغرفة.');void this.sync();}
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')this.status('reconnecting','انقطع التزامن؛ نحاول استعادة الاتصال.');
   });
  this.heartbeat=setInterval(()=>{void this.sync();},20000);
  this.uiTimer=setInterval(()=>{if(this.view){this.view={...this.view,turnTimerSeconds:Math.max(0,Math.ceil((this.deadline-Date.now()-this.offset)/1000))};for(const fn of this.matchListeners)fn(this.view);}},250);
 }
 sendEvent(event:ClientToServerEvent){this.queue=this.queue.then(()=>this.dispatch(event)).catch(e=>this.emit(e instanceof Error?e.message:'تعذر تنفيذ الطلب.'));}
 private async dispatch(event:ClientToServerEvent){
  if(event.type==='UPDATE_MAX_PLAYERS'&&!this.code){this.state={...this.state,maxPlayers:event.payload.maxPlayers};this.emit();return;}
  await this.authenticate();
  if(event.type==='CREATE_ROOM'){
   this.disconnect();this.view=null;this.status('connecting');const p=await this.call(event.type,event.payload);await this.connect(p);return;
  }
  if(event.type==='JOIN_ROOM'){
   const code=event.payload.roomCode.trim().toUpperCase();if(!/^[A-F0-9]{32}$/.test(code))throw Error('رمز الغرفة غير صالح. استخدم رابط الدعوة.');
   this.disconnect();this.view=null;this.code=code;this.status('connecting');const p=await this.call(event.type,event.payload);await this.connect(p);return;
  }
  if(event.type==='RECONNECT_MATCH'){this.status('reconnecting');const p=await this.call('SYNC');await this.connect(p);return;}
  if(this.stopped||!this.code)throw Error('انضم إلى غرفة أولًا.');
  const p=await this.call(event.type,event.payload,{matchId:this.view?.matchId,turnNumber:this.view?.turnNumber});if(event.type!=='LEAVE_ROOM')this.accept(p);
 }
 disconnect(){this.stopped=true;clearTimeout(this.timeout);clearInterval(this.heartbeat);clearInterval(this.uiTimer);if(this.channel){void this.client.removeChannel(this.channel);this.channel=null;}}
 leave(){this.queue=this.queue.then(async()=>{if(this.code&&this.userId)await this.call('LEAVE_ROOM',{roomCode:this.code});}).catch(()=>{}).finally(()=>{this.disconnect();this.code='';this.view=null;try{sessionStorage.removeItem(KEY);}catch{/* storage disabled */}});}
}
