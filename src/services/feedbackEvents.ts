export type FeedbackState = {matchId:string; turnNumber:number; phase:string};
export type FeedbackEvent = 'start'|'turn'|'results';
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
    if(prev.turnNumber!==next.turnNumber && next.phase==='CHOOSING_MOVE')return ['turn'];
    return [];
  }
}
