import {useEffect,useRef,useState} from 'react';
import {transitionDuration,type FeedbackState} from './feedbackEvents';
/** Local games pause their clock/bots. Remote games use the server's remaining pause. */
export function useTransitionPause(state:(FeedbackState&{transitionRemainingMs?:number})|null,remote=false){
 const previous=useRef<FeedbackState|null>(null),until=useRef(0),remoteSnapshot=useRef<FeedbackState|null>(null);const [,refresh]=useState(0);
 if(state){if(remote){if(remoteSnapshot.current!==state){until.current=Date.now()+(state.transitionRemainingMs||0);remoteSnapshot.current=state;}}else {const delay=transitionDuration(previous.current,state);if(delay)until.current=Date.now()+delay;}previous.current={...state};}else{previous.current=null;until.current=0;}
 const remaining=state?.phase==='CHOOSING_MOVE'?Math.max(0,until.current-Date.now()):0;
 useEffect(()=>{if(!remaining)return;const timer=setTimeout(()=>refresh(x=>x+1),remaining+5);return()=>clearTimeout(timer);},[state?.matchId,state?.turnNumber,remaining>0]);
 return remaining>0;
}
