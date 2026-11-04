import {t,fmt,tr} from '../i18n/translate';
import {GameFeedback,RevealCard,useJoinFeedback,useDrawFeedback} from '../components/Feedback';
import React,{useEffect,useRef,useState} from 'react';
import {SupabaseRoomService} from '../services/multiplayer/roomClient';
import {BrandLogo,ThemeToggle} from '../components/Theme';
import type {ClientProjectedGameState} from '../types/game';
import {CHARACTERS} from '../game/rules/characters';

export const PartyScreen:React.FC<{onBack:()=>void;onJoin:()=>void}>=({onBack,onJoin})=>{
 const [service]=useState(()=>new SupabaseRoomService(t("شاشة العرض"),true));
 const [room,setRoom]=useState(()=>service.getState());
 const [view,setView]=useState<ClientProjectedGameState|null>(null);
 const seenWaiting=useRef(false);
 if(room.roomCode&&room.status==='waiting'&&room.connectionStatus==='connected')seenWaiting.current=true;
 const joined=useJoinFeedback(room.members.map(m=>m.id),room.roomCode||'');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [copied,setCopied]=useState(false);
 useEffect(()=>{
  const off=service.subscribe((next,banner)=>{setRoom({...next});if(banner)setMessage(banner);if(banner||next.roomCode)setBusy(false);});
  const offMatch=service.subscribeMatch(setView);service.reconnect();
  return()=>{off();offMatch();service.disconnect();};
 },[service]);
 const inviteInput=useRef<HTMLInputElement>(null);
 const [copyError,setCopyError]=useState('');
 useEffect(()=>{setCopied(false);setCopyError('');},[room.inviteUrl]);
 const copyInvite=async()=>{setCopyError('');try{await navigator.clipboard.writeText(room.inviteUrl);setCopied(true);}catch{setCopied(false);inviteInput.current?.focus();inviteInput.current?.select();setCopyError(t('تعذر النسخ التلقائي. الرابط محدد؛ انسخه وأرسله للاعبين.'));}};
 const leave=()=>{service.disconnect();onBack();};
 const name=(id:string|null|undefined)=>view?.players.find(p=>p.id===id)?.name||room.members.find(p=>p.id===id)?.name||t("اللاعب");
 useDrawFeedback(view?.drawPileCount,view?.matchId);
 const phase=view?.phase;
 const claim=view?.pendingClaimPublic;
 const result=view?.lastOutcomePublic;
 const title=!view?t("اجمعوا الربع"):phase==='CHOOSING_MOVE'?fmt("دور {0}",[name(view.players[view.currentPlayerIndex]?.id)]):phase==='CHALLENGE_WINDOW'&&claim?fmt("{0} يقول: {1}",[name(claim.playerId),CHARACTERS[claim.claimedCharacter].nameAr]):phase==='GAME_OVER'?fmt("فاز {0}!",[name(view.winnerPlayerId)]):result?.challenged?(result.wasTruthful?t("طلع صادق — التحدي غلط!"):t("صادوه! انكشفت الكذبة")):t("عدّت بدون تحدي");
 return <main className="party-screen">
  <GameFeedback state={view} remote freshRemoteStart={seenWaiting.current}/><header className="party-header"><BrandLogo onHome={leave} alt={t("صادوه!")}/><span>{""+t("العب مع بعض · شاشة العرض")+""}</span><details><summary>{""+t("المزيد")+""}</summary><ThemeToggle/><button className="btn-secondary btn-sm" onClick={leave}>{""+t("القائمة الرئيسية")+""}</button></details></header>
  {tr(!room.roomCode?<section className="party-intro"><span className="party-kicker">{""+t("شاشة تجمعكم. وجوال لكل لاعب.")+""}</span><h1>{""+t("العب مع بعض")+""}</h1><p>{""+t("افتح شاشة العرض على التلفزيون أو اللابتوب. يدخل كل لاعب من جواله، وتبقى بطاقاته عنده.")+""}</p><div className="party-setup-actions"><button disabled={busy} className="btn-primary btn-lg" onClick={()=>{setBusy(true);setMessage(t("جاري تجهيز الشاشة…"));service.sendEvent({type:'CREATE_PARTY_ROOM',payload:{maxPlayers:8}});}}>{tr(busy?t("جاري التجهيز…"):t("ابدأ شاشة العرض"))}</button><button className="btn-secondary btn-lg" onClick={onJoin}>{""+t("انضم من جوالك")+""}</button></div><p className="party-hint">{""+t("من 3 إلى 8 لاعبين. شاشة العرض لا تُحسب لاعبًا.")+""}</p>{tr(message&&<p role="status">{tr(message)}</p>)}</section>:<>
   {tr(room.connectionStatus!=='connected'&&<p className="party-connection" role="status">{tr(room.connectionStatus==='connecting'?t("جاري الاتصال…"):t("انقطع التزامن — نحاول استعادة الاتصال. لا تعتمدوا على الحالة حتى يعود."))}</p>)}
   <section className={`party-stage ${view?'is-playing':''}`} aria-live="polite">
    <div className="party-status"><span className="party-kicker">{tr(!view?t("بانتظار اللاعبين"):phase==='CHOOSING_MOVE'?t("وقت اختيار البطاقة"):phase==='CHALLENGE_WINDOW'?t("وقت التحدي"):phase==='GAME_OVER'?t("انتهت المباراة"):t("نتيجة الحركة"))}</span><h1 className={phase==='GAME_OVER'?'feedback-winner':''}>{tr(title)}</h1>
     {tr(phase==='CHALLENGE_WINDOW'&&claim&&<p>{tr(claim.targetPlayerId?fmt("على {0}. ",[name(claim.targetPlayerId)]):'')}{""+t("على جوالاتكم: «صادوه!» أو «عدّيها».")+""}</p>)}
     {tr(phase==='CHOOSING_MOVE'&&<p>{""+t("اختيار البطاقة والاسم من جوال صاحب الدور فقط.")+""}</p>)}
     {tr(result&&(phase==='RESOLVING_CHALLENGE'||phase==='GAME_OVER')&&<p className="party-result">{tr(result.summaryAr)}</p>)}
     {tr(result?.revealedCard&&(phase==='RESOLVING_CHALLENGE'||phase==='GAME_OVER')&&<RevealCard characterId={result.revealedCard.characterId} eventKey={`${view!.matchId}:${view!.turnNumber}:public-flip`}/>)}
     {tr(!view&&<p>{""+t("المقدّم ينسخ الرابط ويرسله للاعبين. افتحوا الرابط من جوالاتكم وانضموا. أول لاعب ينضم هو المضيف ويبدأ المباراة من جواله.")+""}</p>)}
     {tr(view&&phase!=='GAME_OVER'&&<div className="party-clock"><strong>{tr(view.turnTimerSeconds)}</strong><span>{tr(phase==='RESOLVING_CHALLENGE'?t("ثانية لقراءة النتيجة"):t("ثانية"))}</span></div>)}
    </div>
    {tr(!view&&<aside className="party-join"><h2>{t('رابط اللاعبين')}</h2><p>{t('انسخ الرابط وأرسله للربع؛ كل لاعب يفتحه من جواله وينضم.')}</p><input ref={inviteInput} readOnly aria-label={t('رابط انضمام اللاعبين')} value={room.inviteUrl} onFocus={e=>e.target.select()}/><button className="btn-primary" onClick={()=>void copyInvite()}>{copied?t('تم نسخ الرابط'):t('نسخ رابط اللاعبين')}</button><a href={room.inviteUrl} target="_blank" rel="noreferrer">{t('افتح رابط اللاعبين')}</a>{copyError&&<p role="status">{copyError}</p>}</aside>)}
   </section>
   <section className="party-roster" aria-label={t("اللاعبون")}>{tr(room.members.map(p=><article key={p.id} className={`${view?.players[view.currentPlayerIndex]?.id===p.id&&phase==='CHOOSING_MOVE'?'is-current':''} ${joined.has(p.id)?'feedback-join':''} ${phase==='GAME_OVER'?'feedback-result-row':''}`} style={{'--row-delay':`${room.members.indexOf(p)*70}ms`} as React.CSSProperties}><img src={p.avatarAsset.replace(/\.png$/,'.svg')} alt=""/><strong>{p.name}</strong>{tr(view&&<span>{tr(view.players.find(v=>v.id===p.id)?.cardCount||0)} {" "+t("بطاقات")+""}</span>)}{tr(p.isHost&&!view&&<span>{""+t("المضيف")+""}</span>)}</article>))}{tr(!room.members.length&&<p>{""+t("بانتظار أول لاعب…")+""}</p>)}</section>
   {tr(view&&<section className="party-events" aria-label={t("آخر أحداث المباراة")}>{tr(view.logs.slice(0,4).map(log=><p key={log.id}>{tr(log.messageAr)}</p>))}</section>)}
  </>)}
 </main>;
};
