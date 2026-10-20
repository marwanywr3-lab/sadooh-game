import {ProBadge} from '../components/ProBadge';
import React,{useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {SupabaseRoomService} from '../services/multiplayer/roomClient';
import {BrandLogo,ThemeToggle} from '../components/Theme';
import type {ClientProjectedGameState} from '../types/game';
import {CHARACTERS} from '../game/rules/characters';

export const PartyScreen:React.FC<{onBack:()=>void;onJoin:()=>void}>=({onBack,onJoin})=>{
 const [service]=useState(()=>new SupabaseRoomService('شاشة العرض',true));
 const [room,setRoom]=useState(()=>service.getState());
 const [view,setView]=useState<ClientProjectedGameState|null>(null);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [qr,setQr]=useState('');
 const [copied,setCopied]=useState(false);
 useEffect(()=>{
  const off=service.subscribe((next,banner)=>{setRoom({...next});if(banner)setMessage(banner);if(banner||next.roomCode)setBusy(false);});
  const offMatch=service.subscribeMatch(setView);service.reconnect();
  return()=>{off();offMatch();service.disconnect();};
 },[service]);
 useEffect(()=>{
  let active=true;
  if(room.inviteUrl)void QRCode.toDataURL(room.inviteUrl,{width:320,margin:2,color:{dark:'#252722',light:'#ffffff'},errorCorrectionLevel:'M'}).then(data=>{if(active)setQr(data);}).catch(()=>{if(active)setMessage('استخدم رابط اللاعبين إذا لم يظهر رمز QR.');});
  return()=>{active=false;};
 },[room.inviteUrl]);
 const leave=()=>{service.disconnect();onBack();};
 const name=(id:string|null|undefined)=>view?.players.find(p=>p.id===id)?.name||room.members.find(p=>p.id===id)?.name||'اللاعب';
 const phase=view?.phase;
 const claim=view?.pendingClaimPublic;
 const result=view?.lastOutcomePublic;
 const title=!view?'اجمعوا الربع':phase==='CHOOSING_MOVE'?`دور ${name(view.players[view.currentPlayerIndex]?.id)}`:phase==='CHALLENGE_WINDOW'&&claim?`${name(claim.playerId)} يقول: ${CHARACTERS[claim.claimedCharacter].nameAr}`:phase==='GAME_OVER'?`فاز ${name(view.winnerPlayerId)}!`:result?.challenged?(result.wasTruthful?'طلع صادق — التحدي غلط!':'صادوه! انكشفت الكذبة'):'عدّت بدون تحدي';
 return <main className="party-screen">
  <header className="party-header"><BrandLogo alt="صادوه!"/><span>العب مع بعض · شاشة العرض</span><details><summary>المزيد</summary><ThemeToggle/><button className="btn-secondary btn-sm" onClick={leave}>القائمة الرئيسية</button></details></header>
  {!room.roomCode?<section className="party-intro"><span className="party-kicker">شاشة تجمعكم. وجوال لكل لاعب.</span><h1>العب مع بعض</h1><p>افتح شاشة العرض على التلفزيون أو اللابتوب. يدخل كل لاعب من جواله، وتبقى بطاقاته عنده.</p><div className="party-setup-actions"><button disabled={busy} className="btn-primary btn-lg" onClick={()=>{setBusy(true);setMessage('جاري تجهيز الشاشة…');service.sendEvent({type:'CREATE_PARTY_ROOM',payload:{maxPlayers:8}});}}>{busy?'جاري التجهيز…':'ابدأ شاشة العرض'}</button><button className="btn-secondary btn-lg" onClick={onJoin}>انضم من جوالك</button></div><p className="party-hint">من 3 إلى 8 لاعبين. شاشة العرض لا تُحسب لاعبًا.</p>{message&&<p role="status">{message}</p>}</section>:<>
   {room.connectionStatus!=='connected'&&<p className="party-connection" role="status">{room.connectionStatus==='connecting'?'جاري الاتصال…':'انقطع التزامن — نحاول استعادة الاتصال. لا تعتمدوا على الحالة حتى يعود.'}</p>}
   <section className={`party-stage ${view?'is-playing':''}`} aria-live="polite">
    <div className="party-status"><span className="party-kicker">{!view?'بانتظار اللاعبين':phase==='CHOOSING_MOVE'?'وقت اختيار البطاقة':phase==='CHALLENGE_WINDOW'?'وقت التحدي':phase==='GAME_OVER'?'انتهت المباراة':'نتيجة الحركة'}</span><h1>{title}</h1>
     {phase==='CHALLENGE_WINDOW'&&claim&&<p>{claim.targetPlayerId?`على ${name(claim.targetPlayerId)}. `:''}على جوالاتكم: «صادوه!» أو «عدّيها».</p>}
     {phase==='CHOOSING_MOVE'&&<p>اختيار البطاقة والاسم من جوال صاحب الدور فقط.</p>}
     {result&&(phase==='RESOLVING_CHALLENGE'||phase==='GAME_OVER')&&<p className="party-result">{result.summaryAr}</p>}
     {!view&&<p>امسح الرمز بجوالك، واكتب اسمك، ثم انضم. أول لاعب يدخل هو المضيف ويبدأ المباراة من جواله.</p>}
     {view&&phase!=='GAME_OVER'&&<div className="party-clock"><strong>{view.turnTimerSeconds}</strong><span>{phase==='RESOLVING_CHALLENGE'?'ثانية لقراءة النتيجة':'ثانية'}</span></div>}
    </div>
    {!view&&<aside className="party-join"><img src={qr||undefined} alt="امسح رمز QR للانضمام من جوالك"/><a href={room.inviteUrl} target="_blank" rel="noreferrer">افتح رابط اللاعبين</a><button className="btn-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(room.inviteUrl);setCopied(true);}catch{setMessage('انسخ الرابط الظاهر أسفل الرمز.');}}}>{copied?'تم نسخ الرابط':'نسخ رابط اللاعبين'}</button><input readOnly aria-label="رابط انضمام اللاعبين" value={room.inviteUrl} onFocus={e=>e.target.select()}/></aside>}
   </section>
   <section className="party-roster" aria-label="اللاعبون">{room.members.map(p=><article key={p.id} className={view?.players[view.currentPlayerIndex]?.id===p.id&&phase==='CHOOSING_MOVE'?'is-current':''}><img src={p.avatarAsset.replace(/\.png$/,'.svg')} alt=""/><strong>{p.name}</strong>{p.isPro&&<ProBadge color={p.proBadgeColor}/>}{view&&<span>{view.players.find(v=>v.id===p.id)?.cardCount||0} بطاقات</span>}{p.isHost&&!view&&<span>المضيف</span>}</article>)}{!room.members.length&&<p>بانتظار أول لاعب…</p>}</section>
   {view&&<section className="party-events" aria-label="آخر أحداث المباراة">{view.logs.slice(0,4).map(log=><p key={log.id}>{log.messageAr}</p>)}</section>}
  </>}
 </main>;
};
