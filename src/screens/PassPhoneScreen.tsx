import {useTransitionPause} from '../services/useTransitionPause';
import {loadUserSettings} from '../services/storage/localSettings';
import {t,fmt,tr} from '../i18n/translate';
import {GameFeedback,RevealCard} from '../components/Feedback';
import React,{useEffect,useState} from 'react';
import {BrandLogo,ThemeToggle} from '../components/Theme';
import {CardView} from '../components/CardView';
import {createMatch,submitPlayerMove,resolveChallengeWindow,advanceToNextTurn,executeAutoTimeoutMove} from '../game/engine/gameEngine';
import {CHARACTERS,CHARACTER_LIST} from '../game/rules/characters';
import type {GameState,CharacterId} from '../types/game';

export function createPassPhoneMatch(names:string[]):GameState {
 const state=createMatch({moveDurationSeconds:loadUserSettings().turnDurationSeconds,humanPlayerName:names[0],botCount:names.length-1,botDifficulty:'easy'});
 return {...state,botMemories:{},players:state.players.map((p,i)=>({...p,name:names[i],isBot:false,botDifficulty:undefined}))};
}

export function PassPhoneScreen({onBack}:{onBack:()=>void}){
 const [names,setNames]=useState(['','','']);
 const [game,setGame]=useState<GameState|null>(null);
 const transitionPaused=useTransitionPause(game);
 const [privateOpen,setPrivateOpen]=useState(false);
 const [cardId,setCard]=useState('');
 const [claim,setClaim]=useState<CharacterId>('sanad');
 const [target,setTarget]=useState('');
 const [secondary,setSecondary]=useState('');
 const [challenger,setChallenger]=useState('');
 const [revealOpen,setRevealOpen]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  const hide=()=>{if(document.hidden){setPrivateOpen(false);setRevealOpen(false);}};
  document.addEventListener('visibilitychange',hide);
  return()=>document.removeEventListener('visibilitychange',hide);
 },[]);
 useEffect(()=>{if(transitionPaused||!privateOpen||!game||game.phase!=='CHOOSING_MOVE')return;const timer=setTimeout(()=>{if(game.turnTimerSeconds<=1){setGame(executeAutoTimeoutMove(game));setPrivateOpen(false);}else setGame({...game,turnTimerSeconds:game.turnTimerSeconds-1});},1000);return()=>clearTimeout(timer);},[privateOpen,game,transitionPaused]);
 const active=game?.players[game.currentPlayerIndex];
 const openHand=()=>{
  if(transitionPaused||!active||!game)return;
  const first=active.hand[0];setCard(first?.id||'');setClaim(first?.characterId||'sanad');
  setTarget(game.players.find(p=>p.id!==active.id)?.id||'');setSecondary(active.hand[1]?.id||'');setError('');setPrivateOpen(true);
 };
 const resolve=(id:string|null)=>{if(game){setGame(resolveChallengeWindow(game,id));setRevealOpen(false);}};
 const next=()=>{if(game){setPrivateOpen(false);setRevealOpen(false);setGame(advanceToNextTurn(game));}};
 const outcome=game?.lastOutcome;
 const owner=game?.players.find(p=>p.id===outcome?.privateReveal?.viewerPlayerId);
 return <main className="pass-phone"><GameFeedback state={game}/><header className="party-header"><BrandLogo onHome={onBack} alt={t("صادوه!")}/><span>{""+t("العب من جوال واحد")+""}</span><details><summary>{""+t("المزيد")+""}</summary><ThemeToggle/><button className="btn-secondary" onClick={onBack}>{""+t("القائمة الرئيسية")+""}</button></details></header>
 {tr(!game?<section className="pass-panel"><h1>{""+t("جوال واحد يكفيكم")+""}</h1><p>{""+t("مرّروا الجوال لصاحب الدور. بعد ما يلعب، يحطه بالنص وتقررون: صادوه أو عدّيها.")+""}</p><p>{""+t("اكتبوا أسماءكم حسب ترتيب جلستكم.")+""}</p>
 {tr(names.map((name,i)=><label className="form-field" key={i}><span>{""+t("اللاعب")+" "}{tr(i+1)}</span><input maxLength={20} value={name} placeholder={tr(fmt("اسم اللاعب {0}",[i+1]))} onChange={e=>setNames(names.map((n,j)=>j===i?e.target.value:n))}/></label>))}
 <div className="pass-actions">{tr(names.length<8&&<button className="btn-secondary" onClick={()=>setNames([...names,''])}>{""+t("إضافة لاعب")+""}</button>)}{tr(names.length>3&&<button className="btn-secondary" onClick={()=>setNames(names.slice(0,-1))}>{""+t("حذف آخر لاعب")+""}</button>)}</div>
 <button className="btn-primary btn-lg" onClick={()=>{const clean=names.map(n=>n.trim());if(clean.some(n=>!n)){setError(t("اكتب اسم كل لاعب أولًا."));return;}if(new Set(clean).size!==clean.length){setError(t("اختاروا أسماء مختلفة عشان نعرف دور مين."));return;}setError('');setGame(createPassPhoneMatch(clean));}}>{""+t("ابدأ اللعب")+""}</button>{tr(error&&<p role="alert">{tr(error)}</p>)}<p className="party-hint">{""+t("من 3 إلى 8 لاعبين · بدون إنترنت · يبدأ الوقت بعد فتح البطاقات")+""}</p></section>:
 <section className="pass-panel">
 {tr(game.phase==='CHOOSING_MOVE'&&(!privateOpen?<div className="pass-handoff"><h1>{""+t("عطوا الجوال")+" "}{active?.name}</h1><p>{""+t("البطاقات مخفية. خلّ الشاشة باتجاهك قبل ما تفتحها.")+""}</p><button className="btn-primary btn-lg" onClick={openHand}>{""+t("أنا")+" "}{active?.name} {" "+t("— ورّني بطاقاتي")+""}</button></div>:<>
 <div className="pass-actions"><h2>{""+t("دورك يا")+" "}{active?.name} · {game.turnTimerSeconds} {t("ثانية")}</h2><button className="btn-secondary" onClick={()=>setPrivateOpen(false)}>{""+t("إخفاء البطاقات")+""}</button></div>
 <div className="pass-cards">{tr(active?.hand.map(c=><CardView key={c.id} characterId={c.characterId} selected={cardId===c.id} size="sm" onClick={()=>{setCard(c.id);setClaim(c.characterId);setSecondary(active.hand.find(x=>x.id!==c.id)?.id||'');}}/>))}</div>
 <label className="form-field"><span>{""+t("وش بتقول إن بطاقتك؟ تقدر تصدق أو تخدعهم.")+""}</span><select value={claim} onChange={e=>setClaim(e.target.value as CharacterId)}>{tr(CHARACTER_LIST.map(c=><option key={c.id} value={c.id}>{tr(c.nameAr)}</option>))}</select></label><p>{tr(CHARACTERS[claim].descriptionAr)}</p>
 {tr(CHARACTERS[claim].requiresTarget&&<label className="form-field"><span>{""+t("على مين؟")+""}</span><select value={target} onChange={e=>setTarget(e.target.value)}>{tr(game.players.filter(p=>p.id!==active?.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>))}</select></label>)}
 {tr((claim==='mosarref'||claim==='mokhabbes')&&active!.hand.length>1&&<label className="form-field"><span>{""+t("البطاقة الإضافية")+""}</span><select value={secondary} onChange={e=>setSecondary(e.target.value)}>{tr(active!.hand.filter(c=>c.id!==cardId).map(c=><option key={c.id} value={c.id}>{tr(CHARACTERS[c.characterId].nameAr)}</option>))}</select></label>)}
 <button className="btn-primary btn-lg" onClick={()=>{const result=submitPlayerMove(game,{playerId:active!.id,cardId,claimedCharacter:claim,targetPlayerId:CHARACTERS[claim].requiresTarget?target:null,secondaryCardId:secondary||null});if(result.errorAr){setError(result.errorAr);return;}setPrivateOpen(false);setChallenger('');setError('');setGame(result.nextState);}}>{""+t("العب وأخفِ بطاقاتي")+""}</button>{tr(error&&<p role="alert">{tr(error)}</p>)}
 </>))}
 {tr(game.phase==='CHALLENGE_WINDOW'&&<><h1>{""+t("حطّوا الجوال بالنص")+""}</h1><h2>{active?.name} {" "+t("يقول:")+" "}{tr(CHARACTERS[game.pendingClaim!.claimedCharacter].nameAr)}</h2>{tr(game.pendingClaim?.targetPlayerId&&<p>{""+t("على")+" "}{tr(game.players.find(p=>p.id===game.pendingClaim?.targetPlayerId)?.name)}</p>)}<p>{""+t("اللي يشك يختار اسمه ويضغط صادوه. إذا اتفقتوا تعدّونها، اضغطوا عدّيها.")+""}</p><label className="form-field"><span>{""+t("مين يقول صادوه؟")+""}</span><select value={challenger} onChange={e=>setChallenger(e.target.value)}><option value="">{""+t("اختر اسمك")+""}</option>{tr(game.players.filter(p=>p.id!==active?.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>))}</select></label><div className="pass-actions"><button className="btn-primary btn-lg" disabled={!challenger} onClick={()=>resolve(challenger)}>{""+t("صادوه!")+""}</button><button className="btn-secondary btn-lg" onClick={()=>resolve(null)}>{""+t("عدّيها — محد بيتحدى")+""}</button></div></>)}
 {tr((game.phase==='RESOLVING_CHALLENGE'||game.phase==='GAME_OVER')&&<><h1 className={game.phase==='GAME_OVER'?'feedback-winner':''}>{tr(game.phase==='GAME_OVER'?fmt("فاز {0}!",[game.players.find(p=>p.id===game.winnerPlayerId)?.name]):outcome?.challenged?(outcome.wasTruthful?t("طلع صادق!"):t("صادوه! طلع يخدعكم")):t("عدّت بدون تحدي"))}</h1><p>{tr(outcome?.summaryAr)}</p>{tr(outcome?.revealedCard&&<RevealCard characterId={outcome.revealedCard.characterId} eventKey={`${game.matchId}:${game.turnNumber}:public-flip`}/>)}
 {tr(owner&&outcome?.privateReveal&&<div className="pass-secret"><p>{""+t("معلومة خاصة لـ")+""}{owner.name}{""+t(". عطوه الجوال قبل فتحها.")+""}</p>{tr(revealOpen?<><p>{""+t("بطاقة")+" "}{tr(game.players.find(p=>p.id===outcome.privateReveal?.targetPlayerId)?.name)}: <strong>{tr(CHARACTERS[outcome.privateReveal.revealedCard.characterId].nameAr)}</strong></p><button className="btn-secondary" onClick={()=>setRevealOpen(false)}>{""+t("إخفاء المعلومة")+""}</button></>:<button className="btn-secondary" onClick={()=>setRevealOpen(true)}>{""+t("أنا")+" "}{owner.name} {" "+t("— اعرض المعلومة")+""}</button>)}</div>)}
 {tr(game.phase!=='GAME_OVER'?<button className="btn-primary btn-lg" onClick={next}>{""+t("خلصنا قراءة — الدور التالي")+""}</button>:<button className="btn-primary btn-lg" onClick={()=>{setPrivateOpen(false);setRevealOpen(false);setGame(createPassPhoneMatch(names.map(n=>n.trim())));}}>{""+t("العبوا مرة ثانية")+""}</button>)}</>)}
 {tr(!privateOpen&&!revealOpen&&<div className="pass-counts">{tr(game.players.map((p,i)=><span key={p.id} className={game.phase==='GAME_OVER'?'feedback-result-row':''} style={{'--row-delay':`${i*70}ms`} as React.CSSProperties}>{p.name}: {tr(p.hand.length)} {" "+t("بطاقات")+""}</span>))}</div>)}
 </section>)}
 </main>;
}
