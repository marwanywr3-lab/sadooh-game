export type FeedbackState = {matchId:string; turnNumber:number; phase:string; players:readonly unknown[]};
/** A round is one complete rotation of the fixed match roster. Keep turnNumber unchanged for server validation. */
export function getRoundNumber(turnNumber:number,playerCount:number):number {
 return Math.floor((Math.max(1,turnNumber)-1)/Math.max(1,playerCount))+1;
}
export type FeedbackEvent = 'start'|'turn'|'results';
export const FEEDBACK_TIMINGS={opening:2200,start:2000,roundWords:1900,roundNumber:750,results:1200} as const;
/** Only semantic transitions trigger feedback; timer snapshots are deliberately ignored. */
export class FeedbackEvents {
  private previous: FeedbackState|null = null;
  observe(next:FeedbackState|null, remote=false, freshRemoteStart=false):FeedbackEvent[] {
    if(!next){this.previous=null;return [];}
    const prev=this.previous;this.previous={...next};
    if(!prev || prev.matchId!==next.matchId){
      if(remote && ((!prev&&!freshRemoteStart) || next.turnNumber!==1 || next.phase!=='CHOOSING_MOVE'))return [];
      return next.phase==='GAME_OVER'?[]:['start'];
    }
    if(prev.phase!==next.phase && next.phase==='GAME_OVER')return ['results'];
    if(getRoundNumber(next.turnNumber,next.players.length)>getRoundNumber(prev.turnNumber,prev.players.length) && next.phase==='CHOOSING_MOVE')return ['turn'];
    return [];
  }
}
