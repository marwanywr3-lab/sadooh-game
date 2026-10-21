import {GameFeedback,RevealCard} from '../components/Feedback';
import React,{useEffect,useState} from 'react';
import {BrandLogo,ThemeToggle} from '../components/Theme';
import {CardView} from '../components/CardView';
import {createMatch,submitPlayerMove,resolveChallengeWindow,advanceToNextTurn} from '../game/engine/gameEngine';
import {CHARACTERS,CHARACTER_LIST} from '../game/rules/characters';
import type {GameState,CharacterId} from '../types/game';

export function createPassPhoneMatch(names:string[]):GameState {
 const state=createMatch({humanPlayerName:names[0],botCount:names.length-1,botDifficulty:'easy'});
 return {...state,botMemories:{},players:state.players.map((p,i)=>({...p,name:names[i],isBot:false,botDifficulty:undefined}))};
}

export function PassPhoneScreen({onBack}:{onBack:()=>void}){
 const [names,setNames]=useState(['','','']);
 const [game,setGame]=useState<GameState|null>(null);
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
 const active=game?.players[game.currentPlayerIndex];
 const openHand=()=>{
  if(!active||!game)return;
  const first=active.hand[0];setCard(first?.id||'');setClaim(first?.characterId||'sanad');
  setTarget(game.players.find(p=>p.id!==active.id)?.id||'');setSecondary(active.hand[1]?.id||'');setError('');setPrivateOpen(true);
 };
 const resolve=(id:string|null)=>{if(game){setGame(resolveChallengeWindow(game,id));setRevealOpen(false);}};
 const next=()=>{if(game){setPrivateOpen(false);setRevealOpen(false);setGame(advanceToNextTurn(game));}};
 const outcome=game?.lastOutcome;
 const owner=game?.players.find(p=>p.id===outcome?.privateReveal?.viewerPlayerId);
 return <main className="pass-phone"><GameFeedback state={game}/><header className="party-header"><BrandLogo alt="صادوه!"/><span>العب من جوال واحد</span><details><summary>المزيد</summary><ThemeToggle/><button className="btn-secondary" onClick={onBack}>القائمة الرئيسية</button></details></header>
 {!game?<section className="pass-panel"><h1>جوال واحد يكفيكم</h1><p>مرّروا الجوال لصاحب الدور. بعد ما يلعب، يحطه بالنص وتقررون: صادوه أو عدّيها.</p><p>اكتبوا أسماءكم حسب ترتيب جلستكم.</p>
 {names.map((name,i)=><label className="form-field" key={i}><span>اللاعب {i+1}</span><input maxLength={20} value={name} placeholder={`اسم اللاعب ${i+1}`} onChange={e=>setNames(names.map((n,j)=>j===i?e.target.value:n))}/></label>)}
 <div className="pass-actions">{names.length<8&&<button className="btn-secondary" onClick={()=>setNames([...names,''])}>إضافة لاعب</button>}{names.length>3&&<button className="btn-secondary" onClick={()=>setNames(names.slice(0,-1))}>حذف آخر لاعب</button>}</div>
 <button className="btn-primary btn-lg" onClick={()=>{const clean=names.map(n=>n.trim());if(clean.some(n=>!n)){setError('اكتب اسم كل لاعب أولًا.');return;}if(new Set(clean).size!==clean.length){setError('اختاروا أسماء مختلفة عشان نعرف دور مين.');return;}setError('');setGame(createPassPhoneMatch(clean));}}>ابدأ اللعب</button>{error&&<p role="alert">{error}</p>}<p className="party-hint">من 3 إلى 8 لاعبين · بدون إنترنت · بدون مؤقت للاستعجال</p></section>:
 <section className="pass-panel">
 {game.phase==='CHOOSING_MOVE'&&(!privateOpen?<div className="pass-handoff"><h1>عطوا الجوال {active?.name}</h1><p>البطاقات مخفية. خلّ الشاشة باتجاهك قبل ما تفتحها.</p><button className="btn-primary btn-lg" onClick={openHand}>أنا {active?.name} — ورّني بطاقاتي</button></div>:<>
 <div className="pass-actions"><h2>دورك يا {active?.name}</h2><button className="btn-secondary" onClick={()=>setPrivateOpen(false)}>إخفاء البطاقات</button></div>
 <div className="pass-cards">{active?.hand.map(c=><CardView key={c.id} characterId={c.characterId} selected={cardId===c.id} size="sm" onClick={()=>{setCard(c.id);setClaim(c.characterId);setSecondary(active.hand.find(x=>x.id!==c.id)?.id||'');}}/>)}</div>
 <label className="form-field"><span>وش بتقول إن بطاقتك؟ تقدر تصدق أو تخدعهم.</span><select value={claim} onChange={e=>setClaim(e.target.value as CharacterId)}>{CHARACTER_LIST.map(c=><option key={c.id} value={c.id}>{c.nameAr}</option>)}</select></label><p>{CHARACTERS[claim].descriptionAr}</p>
 {CHARACTERS[claim].requiresTarget&&<label className="form-field"><span>على مين؟</span><select value={target} onChange={e=>setTarget(e.target.value)}>{game.players.filter(p=>p.id!==active?.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
 {(claim==='mosarref'||claim==='mokhabbes')&&active!.hand.length>1&&<label className="form-field"><span>البطاقة الإضافية</span><select value={secondary} onChange={e=>setSecondary(e.target.value)}>{active!.hand.filter(c=>c.id!==cardId).map(c=><option key={c.id} value={c.id}>{CHARACTERS[c.characterId].nameAr}</option>)}</select></label>}
 <button className="btn-primary btn-lg" onClick={()=>{const result=submitPlayerMove(game,{playerId:active!.id,cardId,claimedCharacter:claim,targetPlayerId:CHARACTERS[claim].requiresTarget?target:null,secondaryCardId:secondary||null});if(result.errorAr){setError(result.errorAr);return;}setPrivateOpen(false);setChallenger('');setError('');setGame(result.nextState);}}>العب وأخفِ بطاقاتي</button>{error&&<p role="alert">{error}</p>}
 </>)}
 {game.phase==='CHALLENGE_WINDOW'&&<><h1>حطّوا الجوال بالنص</h1><h2>{active?.name} يقول: {CHARACTERS[game.pendingClaim!.claimedCharacter].nameAr}</h2>{game.pendingClaim?.targetPlayerId&&<p>على {game.players.find(p=>p.id===game.pendingClaim?.targetPlayerId)?.name}</p>}<p>اللي يشك يختار اسمه ويضغط صادوه. إذا اتفقتوا تعدّونها، اضغطوا عدّيها.</p><label className="form-field"><span>مين يقول صادوه؟</span><select value={challenger} onChange={e=>setChallenger(e.target.value)}><option value="">اختر اسمك</option>{game.players.filter(p=>p.id!==active?.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="pass-actions"><button className="btn-primary btn-lg" disabled={!challenger} onClick={()=>resolve(challenger)}>صادوه!</button><button className="btn-secondary btn-lg" onClick={()=>resolve(null)}>عدّيها — محد بيتحدى</button></div></>}
 {(game.phase==='RESOLVING_CHALLENGE'||game.phase==='GAME_OVER')&&<><h1 className={game.phase==='GAME_OVER'?'feedback-winner':''}>{game.phase==='GAME_OVER'?`فاز ${game.players.find(p=>p.id===game.winnerPlayerId)?.name}!`:outcome?.challenged?(outcome.wasTruthful?'طلع صادق!':'صادوه! طلع يخدعكم'):'عدّت بدون تحدي'}</h1><p>{outcome?.summaryAr}</p>{outcome?.revealedCard&&<RevealCard characterId={outcome.revealedCard.characterId} eventKey={`${game.matchId}:${game.turnNumber}:public-flip`}/>}
 {owner&&outcome?.privateReveal&&<div className="pass-secret"><p>معلومة خاصة لـ{owner.name}. عطوه الجوال قبل فتحها.</p>{revealOpen?<><p>بطاقة {game.players.find(p=>p.id===outcome.privateReveal?.targetPlayerId)?.name}: <strong>{CHARACTERS[outcome.privateReveal.revealedCard.characterId].nameAr}</strong></p><button className="btn-secondary" onClick={()=>setRevealOpen(false)}>إخفاء المعلومة</button></>:<button className="btn-secondary" onClick={()=>setRevealOpen(true)}>أنا {owner.name} — اعرض المعلومة</button>}</div>}
 {game.phase!=='GAME_OVER'?<button className="btn-primary btn-lg" onClick={next}>خلصنا قراءة — الدور التالي</button>:<button className="btn-primary btn-lg" onClick={()=>{setPrivateOpen(false);setRevealOpen(false);setGame(createPassPhoneMatch(names.map(n=>n.trim())));}}>العبوا مرة ثانية</button>}</>}
 {!privateOpen&&!revealOpen&&<div className="pass-counts">{game.players.map((p,i)=><span key={p.id} className={game.phase==='GAME_OVER'?'feedback-result-row':''} style={{'--row-delay':`${i*70}ms`} as React.CSSProperties}>{p.name}: {p.hand.length} بطاقات</span>)}</div>}
 </section>}
 </main>;
}
