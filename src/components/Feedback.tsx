import {getLanguage,t,fmt,tr} from '../i18n/translate';
import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {BrandLogo,ThemeContext} from './Theme';
import {CardView} from './CardView';
import type {CharacterId} from '../types/game';
import {loadUserSettings,saveUserSettings} from '../services/storage/localSettings';
import {SoundManager,type SoundName} from '../services/soundManager';
import {useTransitionPause} from '../services/useTransitionPause';
import {FeedbackEvents,firstMatchScene,getRoundNumber,FEEDBACK_TIMINGS,type FeedbackState} from '../services/feedbackEvents';

const sound=new SoundManager();
type MusicName='startMusic'|'roundMusic'|'endMusic';
const music=new SoundManager<MusicName>({startMusic:'selected-start.mp3',roundMusic:'selected-start.mp3',endMusic:'selected-end.mp3'},true);
let openingDismissed=false;
const Context=createContext({reduced:false,play:(_name:SoundName,_key:string)=>{}});
export function FeedbackProvider({children}:{children:React.ReactNode}){
 const [settings,setSettings]=useState(loadUserSettings);
 const [osReduced,setOsReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{
  const refresh=()=>setSettings(loadUserSettings());
  const media=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setOsReduced(media.matches);
  const unlock=()=>{sound.unlock();if(loadUserSettings().musicEnabled)music.unlock();};const hide=()=>{if(document.hidden){sound.stop();music.stop();}};
  window.addEventListener('sadooh-settings',refresh);window.addEventListener('storage',refresh);
  media.addEventListener('change',change);window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);document.addEventListener('visibilitychange',hide);
  return()=>{window.removeEventListener('sadooh-settings',refresh);window.removeEventListener('storage',refresh);media.removeEventListener('change',change);window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',hide);sound.stop();music.stop();};
 },[]);
 useEffect(()=>sound.configure(settings.soundEnabled,settings.soundVolume),[settings.soundEnabled,settings.soundVolume]);
 useEffect(()=>music.configure(settings.musicEnabled,settings.musicVolume),[settings.musicEnabled,settings.musicVolume]);
 const reduced=settings.reduceMotion||osReduced;
 return <Context.Provider value={{reduced,play:(n,k)=>sound.play(n,k)}}><div className={reduced?'feedback-root feedback-reduced':'feedback-root'}>{tr(children)}<ThemeContext.Provider value={{dark:settings.darkMode,toggle:()=>{}}}><OpeningFeedback/></ThemeContext.Provider></div></Context.Provider>;
}
export function SoundControls(){
 const [settings,setSettings]=useState(loadUserSettings);
 useEffect(()=>{const refresh=()=>setSettings(loadUserSettings());window.addEventListener('sadooh-settings',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('sadooh-settings',refresh);window.removeEventListener('storage',refresh);};},[]);
 return <div className="feedback-sound-controls"><label className="toggle-row"><span>{""+t("المؤثرات الصوتية")+""}</span><input type="checkbox" checked={settings.soundEnabled} onChange={e=>setSettings(saveUserSettings({soundEnabled:e.target.checked}))}/></label><label className="form-field"><span>{""+t("مستوى الصوت")+" "}{tr(Math.round(settings.soundVolume*100))}{""+t("٪")+""}</span><input aria-label={t("مستوى المؤثرات الصوتية")} type="range" min="0" max="100" value={Math.round(settings.soundVolume*100)} onChange={e=>setSettings(saveUserSettings({soundVolume:Number(e.target.value)/100}))}/></label><label className="toggle-row"><span>{t('موسيقى الافتتاح والبداية والجولات والنهاية')}</span><input type="checkbox" checked={settings.musicEnabled} onChange={e=>setSettings(saveUserSettings({musicEnabled:e.target.checked}))}/></label><label className="form-field"><span>{t('مستوى الموسيقى')} {Math.round(settings.musicVolume*100)}%</span><input aria-label={t('مستوى الموسيقى')} type="range" min="0" max="100" value={Math.round(settings.musicVolume*100)} onChange={e=>setSettings(saveUserSettings({musicVolume:Number(e.target.value)/100}))}/></label></div>;
}
function OpeningFeedback(){
 const [open,setOpen]=useState(false),[started,setStarted]=useState(false),[loading,setLoading]=useState(false);const active=useRef(true);const {reduced}=useContext(Context);
 const close=()=>{active.current=false;music.stop();setOpen(false);};
 useEffect(()=>{active.current=true;if(!openingDismissed&&!reduced){setOpen(true);if(!loadUserSettings().musicEnabled)setStarted(true);}return()=>{active.current=false;};},[]);
 useEffect(()=>{const dismiss=()=>{active.current=false;music.stop();setOpen(false);};window.addEventListener('sadooh-feedback-start',dismiss);const hide=()=>{if(document.hidden)dismiss();};document.addEventListener('visibilitychange',hide);return()=>{window.removeEventListener('sadooh-feedback-start',dismiss);document.removeEventListener('visibilitychange',hide);};},[]);
 useEffect(()=>{if(reduced){setOpen(false);return;}if(!open||!started)return;const end=setTimeout(close,FEEDBACK_TIMINGS.opening);return()=>clearTimeout(end);},[reduced,open,started]);
 const begin=async()=>{if(loading)return;setLoading(true);await music.prepare();if(!active.current)return;setLoading(false);setStarted(true);music.play('startMusic','app:opening');};
 if(!open||reduced)return null;
 if(started)return <LogoScene opening onSkip={close}/>;
 return <div className="feedback-opening-ready"><ThemeContext.Provider value={{dark:false,toggle:()=>{}}}><BrandLogo interactive={false} hideProBadge alt={t('صادوه!')}/></ThemeContext.Provider><button className="btn-primary" disabled={loading} onClick={()=>void begin()}>{t(loading?'لحظة…':'اضغط للبدء')}</button><button className="btn-secondary btn-sm feedback-skip" onClick={close}>{t('تجاوز الحركة')}</button></div>;
}
function LogoScene({opening=false,onSkip,elapsed=0}:{opening?:boolean;onSkip:()=>void;elapsed?:number}){
 return <div className={`feedback-logo-scene ${opening?'feedback-opening':''}`} style={{'--feedback-elapsed':`${-elapsed}ms`,'--feedback-logo-duration':`${opening?FEEDBACK_TIMINGS.opening:FEEDBACK_TIMINGS.start}ms`} as React.CSSProperties}><div className="feedback-logo"><ThemeContext.Provider value={{dark:false,toggle:()=>{}}}><BrandLogo interactive={false} hideProBadge alt={t("صادوه!")}/></ThemeContext.Provider></div><button className="btn-secondary btn-sm feedback-skip" onClick={onSkip}>{""+t("تجاوز الحركة")+""}</button></div>;
}
export function GameFeedback({state,remote=false,silent=false,freshRemoteStart=false}:{state:(FeedbackState&{transitionRemainingMs?:number})|null;remote?:boolean;silent?:boolean;freshRemoteStart?:boolean}){
 const events=useRef(new FeedbackEvents());const {reduced,play}=useContext(Context);
 const paused=useTransitionPause(state,remote);
 const [scene,setScene]=useState<{kind:string;key:string;turn:number;duration:number;firstRoundEndsAt?:number}|null>(null);
 const actionPhase=useRef<string|null>(null);
 useEffect(()=>{const previous=actionPhase.current;actionPhase.current=state?.phase||null;if(previous==='CHOOSING_MOVE'&&state?.phase==='CHALLENGE_WINDOW'&&!silent&&!document.hidden)play('flip',`${state.matchId}:${state.turnNumber}:play-card`);},[state?.matchId,state?.turnNumber,state?.phase,silent]);
 useEffect(()=>{
  const event=events.current.observe(state,remote,freshRemoteStart)[0];if(!event||!state)return;
  music.stop();
  const key=`${state.matchId}:${state.turnNumber}:${event}`;
  if(event==='start'){openingDismissed=true;window.dispatchEvent(new Event('sadooh-feedback-start'));}
  if(document.hidden)return;
  const duration=event==='results'?FEEDBACK_TIMINGS.results:remote?(state.transitionRemainingMs||0):event==='start'?FEEDBACK_TIMINGS.start+FEEDBACK_TIMINGS.roundWords+FEEDBACK_TIMINGS.roundNumber:FEEDBACK_TIMINGS.roundWords+FEEDBACK_TIMINGS.roundNumber;
  if(!duration)return;
  const initial=event==='start'?firstMatchScene(duration):null;
  const kind=initial?.kind||event,sceneDuration=initial?.duration||duration;
  setScene({kind,key,turn:getRoundNumber(state.turnNumber,state.players.length),duration:sceneDuration,firstRoundEndsAt:initial?.hasFirstRound?Date.now()+duration:undefined});
  // Reconnects may show the remaining animation, but never start a late musical cue.
  if(!silent&&(!remote||sceneDuration>=(kind==='start'?FEEDBACK_TIMINGS.start:FEEDBACK_TIMINGS.roundWords+FEEDBACK_TIMINGS.roundNumber)-500||event==='results'))music.play(kind==='start'?'startMusic':kind==='turn'?'roundMusic':'endMusic',key);
 },[state?.matchId,state?.turnNumber,state?.phase,remote,silent,freshRemoteStart]);
 useEffect(()=>{if(!scene)return;const timer=setTimeout(()=>{music.stop();const remaining=scene.firstRoundEndsAt?Math.max(0,scene.firstRoundEndsAt-Date.now()):0;if(remaining>0&&!document.hidden){const key=scene.key+':first-round';setScene({kind:'turn',key,turn:1,duration:remaining});if(!silent)music.play('roundMusic',key);}else setScene(null);},scene.duration);return()=>clearTimeout(timer);},[scene]);
 useEffect(()=>{if(state?.phase==='GAME_OVER')return;if((scene?.kind==='start'||scene?.kind==='turn')&&state?.phase!=='CHOOSING_MOVE'){setScene(null);music.stop();}},[state?.phase,scene?.kind]);
 useEffect(()=>{const hide=()=>{if(document.hidden){setScene(null);music.stop();}};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);music.stop();sound.stop();};},[]);
 const skip=()=>{music.stop();setScene(null);};
 if(reduced&&scene?.kind==='results')return <div className="feedback-static-result"><button className="btn-secondary btn-sm" onClick={skip}>{t('تجاوز الحركة')}</button></div>;
 if(!scene||reduced)return paused?<div className="feedback-wait" role="status"><span>{t('تبدأ الجولة بعد لحظات…')}</span>{scene&&<button className="btn-secondary btn-sm feedback-skip" onClick={skip}>{t('تجاوز الحركة')}</button>}</div>:null;
 if(scene.kind==='start')return <div className="feedback-transition-block"><LogoScene onSkip={skip} elapsed={Math.max(0,FEEDBACK_TIMINGS.start-scene.duration)}/></div>;
 if(scene.kind==='turn')return <div key={scene.key} className="feedback-round-scene feedback-transition-block" role="status" aria-label={fmt('جولة جديدة، الجولة {0}',[scene.turn])} style={{'--feedback-elapsed':`${-Math.max(0,FEEDBACK_TIMINGS.roundWords+FEEDBACK_TIMINGS.roundNumber-scene.duration)}ms`,'--round-words-duration':`${FEEDBACK_TIMINGS.roundWords}ms`,'--round-number-duration':`${FEEDBACK_TIMINGS.roundNumber}ms`,'--round-total-duration':`${FEEDBACK_TIMINGS.roundWords+FEEDBACK_TIMINGS.roundNumber}ms`} as React.CSSProperties}><div className="feedback-round-words" aria-hidden="true"><span>{t('جولة')}</span><span>{t('جديدة')}</span></div><div className="feedback-round-number" aria-hidden="true"><small>{t('الجولة')}</small><strong>{new Intl.NumberFormat(getLanguage()==='ar'?'ar-SA':'en',{numberingSystem:getLanguage()==='ar'?'arab':'latn'}).format(scene.turn)}</strong></div><button className="btn-secondary btn-sm feedback-skip" onClick={skip}>{t('تجاوز الحركة')}</button></div>;
 return <div key={scene.key} className="feedback-confetti"><div aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div><button className="btn-secondary btn-sm feedback-skip" onClick={skip}>{t('تجاوز الحركة')}</button></div>;
}
/** Receives only an already-authorized public character. Never accepts a hidden hand. */
export function RevealCard({characterId,eventKey,badgeText,silent=false}:{characterId:CharacterId;eventKey:string;badgeText?:string;silent?:boolean}){
 const {reduced,play}=useContext(Context);
 useEffect(()=>{if(!silent)play('flip',eventKey);},[eventKey,silent]);
 return <div key={eventKey} className={reduced?'feedback-card-static':'feedback-card-flip'}><div className="feedback-card-back" aria-hidden="true"><img src="./assets/card-back.svg" alt=""/></div><div className="feedback-card-front"><CardView characterId={characterId} size="sm" badgeText={tr(badgeText)}/></div></div>;
}
export function useJoinFeedback(ids:string[],scope:string,silent=false){
 const previous=useRef<{scope:string;ids:Set<string>}|null>(null);const [joined,setJoined]=useState<Set<string>>(()=>new Set());const {play}=useContext(Context);
 const signature=JSON.stringify(ids);
 useEffect(()=>{
  const before=previous.current;previous.current={scope,ids:new Set(ids)};
  if(!before||before.scope!==scope||!before.ids.size||document.hidden)return;
  const added=ids.filter(id=>!before.ids.has(id));if(!added.length)return;
  setJoined(new Set(added));if(!silent)play('whoosh',`join:${scope}:${added.join(',')}:${Date.now()}`);
  const timer=setTimeout(()=>setJoined(new Set()),400);return()=>{clearTimeout(timer);setJoined(new Set());};
 },[signature,scope,silent]);
 return joined;
}

/** Public pile counts are sufficient for drawing feedback; no card identity is inspected. */
export function useDrawFeedback(count:number|undefined,matchId:string|undefined,silent=false){
 const previous=useRef<{count:number;matchId:string}|null>(null);const {play}=useContext(Context);
 useEffect(()=>{if(count===undefined||!matchId){previous.current=null;return;}const before=previous.current;previous.current={count,matchId};if(before?.matchId===matchId&&count<before.count&&!silent&&!document.hidden)play('turn',`${matchId}:draw:${Date.now()}`);},[count,matchId,silent]);
}
