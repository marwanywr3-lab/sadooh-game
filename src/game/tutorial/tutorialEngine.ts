import type { CardInstance, GameState, MoveSubmission, PlayerState } from '../../types/game';
import { createMatch, submitPlayerMove, resolveChallengeWindow } from '../engine/gameEngine';
export { CHARACTER_LIST, CHARACTERS } from '../rules/characters';

export type TutorialStepNumber=1|2|3|4|5|6;
export const TUTORIAL_STEPS:Record<TutorialStepNumber,{titleAr:string;speechAr:string;instructionAr:string}>={
  1:{titleAr:'وش الهدف؟',speechAr:'تبدأ ومعك 4 بطاقات. حاول تخلّصها قبل الباقين.',instructionAr:'ما تحتاج تحفظ الشخصيات الآن. خلّنا نجرب بطاقة واحدة.'},
  2:{titleAr:'جرّب تقول الصدق',speechAr:'هذه بطاقة «السند». بنلعبها ونقول: «السند». هذا اسمه صدق.',instructionAr:'اضغط البطاقة، ثم اضغط «ألعبها وأقول: السند».'},
  3:{titleAr:'جرّب تخدعهم',speechAr:'بطاقتك «الملقوف»، لكن تقدر تقول إنها «الكبير». هذا اسمه خداع.',instructionAr:'اضغط البطاقة، واختر «أقول: الكبير»، ثم العبها.'},
  4:{titleAr:'وش يعني صادوه؟',speechAr:'أبو فهد يقول: «بطاقتي المصرّف». زر «صادوه!» يكشف بطاقته.',instructionAr:'اضغط «صادوه!» وشوف هل كلامه صحيح.'},
  5:{titleAr:'وإذا طلع صادق؟',speechAr:'نجرب مثالًا ثانيًا: أبو فهد يقول «السند». خلّنا نكشف بطاقته.',instructionAr:'اضغط «صادوه!» مرة ثانية، وانتبه مين يسحب البطاقة.'},
  6:{titleAr:'جرّب تفوز',speechAr:'مثال أخير: بقيت لك بطاقة واحدة. العبها في دورك حتى تفوز.',instructionAr:'اضغط بطاقة «السند»، ثم العب آخر بطاقة.'},
};
export const TUTORIAL_PLAYER='tutorial_you';
const ABU='tutorial_abu', AZZAM='tutorial_azzam';
function card(id:string,characterId:CardInstance['characterId']):CardInstance{return{id,characterId};}
function player(id:string,name:string,hand:CardInstance[],isBot=false):PlayerState{
 return {id,name,hand,isBot,botDifficulty:'easy',avatarAsset:isBot?'./assets/abu-fahad.svg':'./assets/sanad.svg',isConnected:true,hasSanadShield:false};
}
// Each clearly labelled example is independent and uses the real game rules.
export function createTutorialExample(step:TutorialStepNumber):GameState{
 const myHand=step===6?[card('learn_sanad','sanad')]:step===3?
  [card('learn_malqoof','malqoof'),card('learn_large','alkabeer'),card('learn_spare','sanad')]:
  [card('learn_sanad','sanad'),card('learn_large','alkabeer'),card('learn_malqoof','malqoof'),card('learn_spare','mosarref')];
 const abuHand=[card('abu_main',step===5?'sanad':'nashal'),card('abu_spare','malqoof'),card('abu_other','alkabeer'),card('abu_last','mokhabbes')];
 let state=createMatch({mode:'tutorial',matchId:`lesson_${step}`,humanPlayerName:'أنت',botCount:2,botDifficulty:'easy',rng:()=>0.2,
  customPlayers:[player(TUTORIAL_PLAYER,'أنت',myHand),player(ABU,'أبو فهد',abuHand,true),player(AZZAM,'عزّام',[card('azzam_sanad','sanad'),card('azzam_large','alkabeer')],true)],
  customDrawPile:[card('draw_1','mokhabbes'),card('draw_2','sanad'),card('draw_3','malqoof')]});
 if(step===4||step===5){
  state={...state,currentPlayerIndex:1};
  state=submitPlayerMove(state,{playerId:ABU,cardId:'abu_main',claimedCharacter:step===5?'sanad':'mosarref',targetPlayerId:null}).nextState;
 }
 return state;
}
export function playTutorialExample(step:TutorialStepNumber,state:GameState):GameState{
 if(step===4||step===5)return resolveChallengeWindow(state,TUTORIAL_PLAYER,()=>0.2);
 const move:MoveSubmission={playerId:TUTORIAL_PLAYER,cardId:step===3?'learn_malqoof':'learn_sanad',claimedCharacter:step===3?'alkabeer':'sanad',targetPlayerId:step===3?ABU:null};
 const result=submitPlayerMove(state,move);if(result.errorAr)throw Error(result.errorAr);
 return resolveChallengeWindow(result.nextState,null,()=>0.2);
}
export const TUTORIAL_RESULTS:Partial<Record<TutorialStepNumber,string>>={
 2:'نقصت بطاقاتك من 4 إلى 3. قلت اسم بطاقتك الصحيح، و«السند» أعطاك درع حماية.',
 3:'نقصت بطاقاتك من 3 إلى 2. ما أحد تحدّاك، فاشتغلت قدرة «الكبير» وسحب أبو فهد بطاقة.',
 4:'طلع معه «النشّال»، مو «المصرّف»! أبو فهد يسحب بطاقة، وحركته ما تشتغل.',
 5:'هذه المرة معه «السند» فعلًا. أنت تسحب بطاقة لأنك تحدّيت لاعبًا صادقًا. اضغط «صادوه!» إذا شكّيت، مو كل مرة.',
 6:'خلصت بطاقاتك! لعبت آخر بطاقة في دورك وفزت.',
};
