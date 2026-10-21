import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {BrandLogo,ThemeContext} from './Theme';
import {CardView} from './CardView';
import type {CharacterId} from '../types/game';
import {loadUserSettings,saveUserSettings} from '../services/storage/localSettings';
import {SoundManager,type SoundName} from '../services/soundManager';
import {FeedbackEvents,getRoundNumber,FEEDBACK_TIMINGS,type FeedbackState} from '../services/feedbackEvents';

const sound=new SoundManager();
let openingDismissed=false;
const Context=createContext({reduced:false,play:(_name:SoundName,_key:string)=>{}});
export function FeedbackProvider({children}:{children:React.ReactNode}){
 const [settings,setSettings]=useState(loadUserSettings);
 const [osReduced,setOsReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{
  const refresh=()=>setSettings(loadUserSettings());
  const media=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setOsReduced(media.matches);
  const unlock=()=>sound.unlock();const hide=()=>{if(document.hidden)sound.stop();};
  window.addEventListener('sadooh-settings',refresh);window.addEventListener('storage',refresh);
  media.addEventListener('change',change);window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);document.addEventListener('visibilitychange',hide);
  return()=>{window.removeEventListener('sadooh-settings',refresh);window.removeEventListener('storage',refresh);media.removeEventListener('change',change);window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);document.removeEventListener('visibilitychange',hide);sound.stop();};
 },[]);
 useEffect(()=>sound.configure(settings.soundEnabled,settings.soundVolume),[settings.soundEnabled,settings.soundVolume]);
 const reduced=settings.reduceMotion||osReduced;
 return <Context.Provider value={{reduced,play:(n,k)=>sound.play(n,k)}}><div className={reduced?'feedback-root feedback-reduced':'feedback-root'}>{children}<ThemeContext.Provider value={{dark:settings.darkMode,toggle:()=>{}}}><OpeningFeedback/></ThemeContext.Provider></div></Context.Provider>;
}
export function SoundControls(){
 const [settings,setSettings]=useState(loadUserSettings);
 useEffect(()=>{const refresh=()=>setSettings(loadUserSettings());window.addEventListener('sadooh-settings',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('sadooh-settings',refresh);window.removeEventListener('storage',refresh);};},[]);
 return <div className="feedback-sound-controls"><label className="toggle-row"><span>المؤثرات الصوتية</span><input type="checkbox" checked={settings.soundEnabled} onChange={e=>setSettings(saveUserSettings({soundEnabled:e.target.checked}))}/></label><label className="form-field"><span>مستوى الصوت {Math.round(settings.soundVolume*100)}٪</span><input aria-label="مستوى المؤثرات الصوتية" type="range" min="0" max="100" value={Math.round(settings.soundVolume*100)} onChange={e=>setSettings(saveUserSettings({soundVolume:Number(e.target.value)/100}))}/></label></div>;
}
function OpeningFeedback(){
 const [open,setOpen]=useState(false);const {reduced,play}=useContext(Context);
 useEffect(()=>{if(!openingDismissed&&!reduced)setOpen(true);},[]);
 useEffect(()=>{const dismiss=()=>setOpen(false);window.addEventListener('sadooh-feedback-start',dismiss);return()=>window.removeEventListener('sadooh-feedback-start',dismiss);},[]);
 useEffect(()=>{if(reduced){setOpen(false);return;}if(!open)return;play('whoosh','app:open');const pop=setTimeout(()=>play('pop','app:pop'),850);const end=setTimeout(()=>setOpen(false),FEEDBACK_TIMINGS.opening);return()=>{clearTimeout(pop);clearTimeout(end);};},[reduced,open]);
 return open&&!reduced?<LogoScene opening onSkip={()=>setOpen(false)}/>:null;
}
function LogoScene({opening=false,onSkip}:{opening?:boolean;onSkip:()=>void}){
 return <div className={`feedback-logo-scene ${opening?'feedback-opening':''}`} style={{'--feedback-logo-duration':`${opening?FEEDBACK_TIMINGS.opening:FEEDBACK_TIMINGS.start}ms`} as React.CSSProperties}><div className="feedback-logo"><ThemeContext.Provider value={{dark:false,toggle:()=>{}}}><BrandLogo interactive={false} hideProBadge alt="صادوه!"/></ThemeContext.Provider></div><button className="btn-secondary btn-sm feedback-skip" onClick={onSkip}>تجاوز الحركة</button></div>;
}
export function GameFeedback({state,remote=false,silent=false,freshRemoteStart=false}:{state:FeedbackState|null;remote?:boolean;silent?:boolean;freshRemoteStart?:boolean}){
 const events=useRef(new FeedbackEvents());const {reduced,play}=useContext(Context);
 const [scene,setScene]=useState<{kind:string;key:string;turn:number}|null>(null);
 const popTimer=useRef<ReturnType<typeof setTimeout>>();
 useEffect(()=>{
  const event=events.current.observe(state,remote,freshRemoteStart)[0];if(!event||!state)return;
  clearTimeout(popTimer.current);
  const key=`${state.matchId}:${state.turnNumber}:${event}`;
  if(event==='start'){openingDismissed=true;window.dispatchEvent(new Event('sadooh-feedback-start'));}
  if(document.hidden)return;
  setScene({kind:event,key,turn:getRoundNumber(state.turnNumber,state.players.length)});
  if(!silent){if(event==='start'){play('whoosh',key);popTimer.current=setTimeout(()=>play('pop',key+':pop'),800);}else if(event==='turn'){play('whoosh',key+':words');popTimer.current=setTimeout(()=>play('turn',key+':number'),FEEDBACK_TIMINGS.roundWords);}else{play('reveal',key+':reveal');popTimer.current=setTimeout(()=>play('victory',key+':winner'),520);}}
 },[state?.matchId,state?.turnNumber,state?.phase,remote,silent,freshRemoteStart]);
 useEffect(()=>{if(!scene)return;const duration=scene.kind==='start'?FEEDBACK_TIMINGS.start:scene.kind==='turn'?FEEDBACK_TIMINGS.roundWords+FEEDBACK_TIMINGS.roundNumber:FEEDBACK_TIMINGS.results;const timer=setTimeout(()=>setScene(null),duration);return()=>clearTimeout(timer);},[scene]);
 useEffect(()=>{if(state?.phase==='GAME_OVER')return;if((scene?.kind==='start'||scene?.kind==='turn')&&state?.phase!=='CHOOSING_MOVE'){setScene(null);clearTimeout(popTimer.current);}},[state?.phase,scene?.kind]);
 useEffect(()=>{const hide=()=>{if(document.hidden){clearTimeout(popTimer.current);setScene(null);}};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);clearTimeout(popTimer.current);sound.stop();};},[]);
 if(!scene||reduced)return null;
 if(scene.kind==='start')return <LogoScene onSkip={()=>{setScene(null);clearTimeout(popTimer.current);}}/>;
 if(scene.kind==='turn')return <div key={scene.key} className="feedback-round-scene" role="status" aria-label={`جولة جديدة، الجولة ${scene.turn}`} style={{'--round-words-duration':`${FEEDBACK_TIMINGS.roundWords}ms`,'--round-number-duration':`${FEEDBACK_TIMINGS.roundNumber}ms`,'--round-total-duration':`${FEEDBACK_TIMINGS.roundWords+FEEDBACK_TIMINGS.roundNumber}ms`} as React.CSSProperties}><div className="feedback-round-words" aria-hidden="true"><span>جولة</span><span>جديدة</span></div><div className="feedback-round-number" aria-hidden="true"><small>الجولة</small><strong>{new Intl.NumberFormat('ar-SA',{numberingSystem:'arab'}).format(scene.turn)}</strong></div></div>;
 return <div key={scene.key} className="feedback-confetti" aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>;
}
/** Receives only an already-authorized public character. Never accepts a hidden hand. */
export function RevealCard({characterId,eventKey,badgeText,silent=false}:{characterId:CharacterId;eventKey:string;badgeText?:string;silent?:boolean}){
 const {reduced,play}=useContext(Context);
 useEffect(()=>{if(!silent)play('flip',eventKey);},[eventKey,silent]);
 return <div key={eventKey} className={reduced?'feedback-card-static':'feedback-card-flip'}><div className="feedback-card-back" aria-hidden="true"><img src="./assets/card-back.svg" alt=""/></div><div className="feedback-card-front"><CardView characterId={characterId} size="sm" badgeText={badgeText}/></div></div>;
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
