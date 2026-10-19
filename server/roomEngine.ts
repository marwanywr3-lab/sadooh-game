import {pickBotNames} from '../src/game/bots/names';
import type { GameState, BotDifficulty } from '../src/types/game';
import type { RoomState, ClientToServerEvent } from '../src/types/multiplayer';
import { createBalancedDeck, MOVE_TIMER_SECONDS, CHALLENGE_TIMER_SECONDS, OUTCOME_READING_SECONDS, BOT_MOVE_DELAY_MS, BOT_CHALLENGE_DELAY_MS } from '../src/game/rules/deck';
import { createMatch, submitPlayerMove, resolveChallengeWindow, executeAutoTimeoutMove, advanceToNextTurn } from '../src/game/engine/gameEngine';
import { projectGameStateForPlayer } from '../src/game/engine/stateProjector';
import { decideBotMove, decideBotChallenge } from '../src/game/bots/localBotEngine';
import { secureRandom, cleanText, capacity } from '../server/security';

export type SavedRoom={room:RoomState;game:GameState|null;muted:Record<string,string[]>;lastSeen:Record<string,number>;chatAt:Record<string,number>;deadline:number;nextBot:number;expires:number;receipts:string[]};
export type Report={id:string;reporter:string;target:string;reason:string;evidence:unknown};
export type Projection={room:RoomState;view:ReturnType<typeof projectGameStateForPlayer>|null;deadline:number;nextActionAt:number;serverNow:number;revision?:number};
const BOT_AVATARS=['abu-fahad','alkabeer','malqoof','nashal','sanad','mosarref','mokhabbes'];
function member(id:string,name:string,host=false,isBot=false,difficulty:BotDifficulty='medium') {
 return {id,name,isHost:host,isBot,botDifficulty:isBot?difficulty:undefined,avatarAsset:isBot?'./assets/abu-fahad.png':'./assets/sanad.png',isConnected:true,isReady:true};
}
export function createRoom(code:string,userId:string,name:string,max:number,now:number):SavedRoom {
 return {room:{roomCode:code,inviteUrl:`https://marwanywr3-lab.github.io/sadooh-game-site/?room=${code}`,hostPlayerId:userId,maxPlayers:capacity(max),status:'waiting',connectionStatus:'connected',members:[member(userId,cleanText(name,24),true)],chatHistory:[]},game:null,muted:{},lastSeen:{[userId]:now},chatAt:{},deadline:0,nextBot:0,expires:now+86400000,receipts:[]};
}
function phaseChanged(s:SavedRoom,g:GameState,now:number){
 s.game={...g,logs:g.logs.slice(0,100),chatMessages:[]};
 s.deadline=now+1000*(g.phase==='CHOOSING_MOVE'?MOVE_TIMER_SECONDS:g.phase==='CHALLENGE_WINDOW'?CHALLENGE_TIMER_SECONDS:g.phase==='RESOLVING_CHALLENGE'?OUTCOME_READING_SECONDS:0);
 s.nextBot=g.phase==='CHALLENGE_WINDOW'?now+BOT_CHALLENGE_DELAY_MS:g.phase==='CHOOSING_MOVE'&&g.players[g.currentPlayerIndex].isBot?now+BOT_MOVE_DELAY_MS:0;
 if(g.phase==='GAME_OVER')s.room.status='finished';
}
export function tick(s:SavedRoom,now:number):boolean {
 const g=s.game;if(!g||g.phase==='GAME_OVER')return false;
 if(now>=s.deadline){
  if(g.phase==='CHOOSING_MOVE')phaseChanged(s,executeAutoTimeoutMove(g,secureRandom),now);
  else if(g.phase==='CHALLENGE_WINDOW')phaseChanged(s,resolveChallengeWindow(g,null,secureRandom),now);
  else phaseChanged(s,advanceToNextTurn(g,secureRandom),now);
  return true;
 }
 if(s.nextBot && now>=s.nextBot){
  s.nextBot=0;
  if(g.phase==='CHOOSING_MOVE'){
   const p=g.players[g.currentPlayerIndex];
   const result=submitPlayerMove(g,decideBotMove(projectGameStateForPlayer(g,p.id),g.botMemories[p.id],p.botDifficulty||'medium',secureRandom));
   if(result.errorAr)throw Error(result.errorAr);phaseChanged(s,result.nextState,now);
  }else if(g.phase==='CHALLENGE_WINDOW')for(const p of g.players.filter(p=>p.isBot&&p.id!==g.pendingClaim?.playerId)){
   if(decideBotChallenge(projectGameStateForPlayer(g,p.id),g.botMemories[p.id],p.botDifficulty||'medium',secureRandom)){phaseChanged(s,resolveChallengeWindow(g,p.id,secureRandom),now);break;}
  }
  return true;
 }
 return false;
}
export function projection(s:SavedRoom,userId:string,now:number):Projection {
 if(!s.room.members.some(m=>m.id===userId&&!m.isBot))throw Error('لست عضوًا في الغرفة.');
 const muted=s.muted[userId]||[];
 const room={...s.room,members:s.room.members.map(m=>({...m,isConnected:m.isBot||now-(s.lastSeen[m.id]||0)<45000,isMuted:muted.includes(m.id)})),chatHistory:s.room.chatHistory.filter(m=>!muted.includes(m.senderId))};
 const view=s.game?projectGameStateForPlayer(s.game,userId):null;
 if(view){view.turnTimerSeconds=Math.max(0,Math.ceil((s.deadline-now)/1000));view.chatMessages=room.chatHistory;view.players=view.players.map(p=>({...p,isConnected:room.members.find(m=>m.id===p.id)?.isConnected||false,isMuted:muted.includes(p.id)}));}
 return {room,view,deadline:s.deadline,nextActionAt:s.game&&s.game.phase!=='GAME_OVER'?Math.min(s.deadline,s.nextBot||Infinity):0,serverNow:now};
}
export function allProjections(s:SavedRoom,now:number){return s.room.members.filter(m=>!m.isBot).map(m=>({userId:m.id,payload:projection(s,m.id,now)}));}
export function reduceEvent(s:SavedRoom,userId:string,event:ClientToServerEvent,now:number,context?:{matchId?:string;turnNumber?:number}):Report|null {
 const e=event;
 if(e.type==='JOIN_ROOM'){
  if(s.room.members.some(m=>m.id===userId&&!m.isBot)){s.lastSeen[userId]=now;return null;}
  if(s.room.status!=='waiting'||s.room.members.length>=s.room.maxPlayers)throw Error('الغرفة ممتلئة أو بدأت المباراة.');
  s.room.members.push(member(userId,cleanText(e.payload.playerName,24)));s.lastSeen[userId]=now;return null;
 }
 const me=s.room.members.find(m=>m.id===userId&&!m.isBot);if(!me)throw Error('لست عضوًا في الغرفة.');
 const host=()=>{if(s.room.hostPlayerId!==userId)throw Error('للمضيف فقط.');};
 const waiting=()=>{host();if(s.room.status!=='waiting')throw Error('بدأت المباراة.');};
 s.lastSeen[userId]=now;
 switch(e.type){
 case 'ADD_BOT':{
  waiting();if(s.room.members.length>=s.room.maxPlayers)throw Error('الغرفة ممتلئة.');
  const name=pickBotNames(1,secureRandom,s.room.members.map(m=>m.name))[0];
  const avatar=BOT_AVATARS[Math.floor(secureRandom()*BOT_AVATARS.length)];
  s.room.members.push({...member(crypto.randomUUID(),name,false,true,e.payload.difficulty),avatarAsset:`./assets/${avatar}.svg`});break;
 }
 case 'REMOVE_BOT':waiting();s.room.members=s.room.members.filter(m=>m.id!==e.payload.botId||!m.isBot);break;
 case 'UPDATE_MAX_PLAYERS':waiting();if(e.payload.maxPlayers<s.room.members.length)throw Error('السعة أصغر من عدد الأعضاء.');s.room.maxPlayers=capacity(e.payload.maxPlayers);break;
 case 'START_MATCH':{
  host();if(s.room.status==='in_progress')throw Error('المباراة قائمة.');if(s.room.members.length<3)throw Error('أضف لاعبين أو خصومًا آليين ليصبح العدد 3 على الأقل.');
  const names=pickBotNames(s.room.members.filter(m=>m.isBot).length,secureRandom,s.room.members.filter(m=>!m.isBot).map(m=>m.name));
  let ni=0;s.room.members=s.room.members.map(m=>m.isBot?{...m,name:names[ni++]}:m);
  const deck=createBalancedDeck(8,secureRandom).map(c=>({...c,id:crypto.randomUUID()}));
  const players=s.room.members.map(m=>({...m,hand:deck.splice(0,4),hasSanadShield:false}));
  const g=createMatch({matchId:crypto.randomUUID(),mode:'multiplayer',humanPlayerName:me.name,botCount:2,botDifficulty:'medium',customPlayers:players,customDrawPile:deck,rng:secureRandom});
  s.room.status='in_progress';phaseChanged(s,g,now);break;
 }
 case 'SUBMIT_MOVE':{
  const g=s.game;if(!g)throw Error('المباراة لم تبدأ.');
  if(context?.matchId!==g.matchId||context?.turnNumber!==g.turnNumber)throw Error('الحركة من دور قديم.');
  const r=submitPlayerMove(g,{...e.payload,playerId:userId});if(r.errorAr)throw Error(r.errorAr);phaseChanged(s,r.nextState,now);break;
 }
 case 'PRESS_SADOOH':case 'PASS_CHALLENGE':{
  const g=s.game;if(!g||g.phase!=='CHALLENGE_WINDOW'||g.matchId!==e.payload.matchId||g.turnNumber!==e.payload.turnNumber||g.pendingClaim?.playerId===userId)throw Error('انتهت نافذة التحدي أو الطلب غير صالح.');
  if(e.type==='PRESS_SADOOH')phaseChanged(s,resolveChallengeWindow(g,userId,secureRandom),now);break;
 }
 case 'SEND_CHAT':{
  if(now-(s.chatAt[userId]||0)<1000)throw Error('انتظر ثانية بين الرسائل.');s.chatAt[userId]=now;
  s.room.chatHistory=[...s.room.chatHistory,{id:crypto.randomUUID(),senderId:userId,senderName:me.name,text:cleanText(e.payload.text),timestamp:now,isQuickReaction:!!e.payload.isQuickReaction}].slice(-100);break;
 }
 case 'MUTE_PLAYER':if(!s.room.members.some(m=>m.id===e.payload.targetPlayerId))throw Error('لاعب غير موجود.');s.muted[userId]=[...new Set([...(s.muted[userId]||[]).filter(id=>id!==e.payload.targetPlayerId),...(e.payload.muted?[e.payload.targetPlayerId]:[])])];break;
 case 'REPORT_ABUSE':{
  if(!s.room.members.some(m=>m.id===e.payload.targetPlayerId)||e.payload.targetPlayerId===userId)throw Error('بلاغ غير صالح.');
  const evidence=s.room.chatHistory.filter(m=>m.senderId===e.payload.targetPlayerId&&(!e.payload.messageId||m.id===e.payload.messageId)).slice(-10);
  return {id:crypto.randomUUID(),reporter:userId,target:e.payload.targetPlayerId,reason:cleanText(e.payload.reason,300),evidence};
 }
 case 'LEAVE_ROOM':
  if(s.room.status==='waiting'){
   s.room.members=s.room.members.filter(m=>m.id!==userId);delete s.lastSeen[userId];
   if(me.isHost){const next=s.room.members.find(m=>!m.isBot);if(next){next.isHost=true;s.room.hostPlayerId=next.id;}else s.expires=now;}
  }else{s.lastSeen[userId]=0;}
  break;
 case 'RECONNECT_MATCH':break;
 default:throw Error('حدث غير مسموح.');
 }
 return null;
}
