import React,{useState} from 'react';
import {TUTORIAL_STEPS,TUTORIAL_RESULTS,TUTORIAL_PLAYER,createTutorialExample,playTutorialExample,type TutorialStepNumber} from '../game/tutorial/tutorialEngine';
import {CardView} from '../components/CardView';
import {soundManager} from '../services/audio/soundEffects';

interface TutorialScreenProps{onCompleteTutorial:()=>void;onSkipTutorial:()=>void;onStartPractice:()=>void;}
export const TutorialScreen:React.FC<TutorialScreenProps>=({onCompleteTutorial,onSkipTutorial,onStartPractice})=>{
 const [stepNum,setStepNum]=useState<TutorialStepNumber>(1);
 const [state,setState]=useState(()=>createTutorialExample(1));
 const [selected,setSelected]=useState(false);
 const [claim,setClaim]=useState<'malqoof'|'alkabeer'|null>(null);
 const [done,setDone]=useState(false);
 const [error,setError]=useState('');
 const step=TUTORIAL_STEPS[stepNum];
 const me=state.players.find(p=>p.id===TUTORIAL_PLAYER)!;
 const change=(number:TutorialStepNumber)=>{setStepNum(number);setState(createTutorialExample(number));setSelected(false);setClaim(null);setDone(false);setError('');};
 const play=()=>{
  if(stepNum!==4&&stepNum!==5&&!selected){setError('اضغط على البطاقة أولًا ');return;}
  if(stepNum===3&&claim!=='alkabeer'){setError('في هذا المثال نجرب الخداع. اختر «أقول: الكبير».');return;}
  setState(playTutorialExample(stepNum,state));setDone(true);setError('');
  if(stepNum===6)soundManager.playWinFanfare();else if(stepNum===4||stepNum===5)soundManager.playSadoohAlert();else soundManager.playCardPlace();
 };
 const exampleCard=stepNum===3?'malqoof':'sanad';
 return <div className="tutorial-screen" style={{backgroundImage:"url('./assets/game-table.svg')"}}>
  <div className="tutorial-backdrop simple-tutorial">
   <header className="tutorial-header"><div className="tutorial-header__brand"><img src="./assets/logo.svg" alt="صادوه!" className="tutorial-header__logo"/><div><h2>نجربها سوا، خطوة خطوة</h2><span className="tutorial-step-indicator">{stepNum} من 6 — {step.titleAr}</span></div></div><button className="btn-ghost" onClick={onSkipTutorial}>العودة للقائمة</button></header>
   <div className="tutorial-progress-bar" aria-label="تقدم التجربة">{([1,2,3,4,5,6] as TutorialStepNumber[]).map(n=><div key={n} className={`tutorial-progress-step ${n===stepNum?'is-current':n<stepNum?'is-done':''}`}>{n}</div>)}</div>
   <div className="tutorial-mentor-box"><div className="tutorial-mentor-avatar-wrap"><img src="./assets/abu-fahad.svg" alt="أبو فهد" className="tutorial-mentor-avatar"/></div><div className="tutorial-mentor-speech"><p className="mentor-speech-main">{step.speechAr}</p><p className="mentor-instruction-pill"> {done?'شوف النتيجة تحت. خذ وقتك، وبعدها كمل.':step.instructionAr}</p></div></div>
   <p className="practice-no-pressure">تجربة بدون مؤقت • ما تحسب فوز أو خسارة • كل خطوة مثال جديد</p>
   <section className="tutorial-stage" aria-label={step.titleAr}>
    {stepNum===1?<>
     <div className="tutorial-goal"><strong> تبدأ بـ4 بطاقات</strong><span aria-hidden="true"></span><strong> تخلصها وتفوز</strong></div>
     <p className="tutorial-short-copy">في دورك: تلعب بطاقة وتقول اسمها. تقدر تقول الصدق أو تخدعهم.</p>
     <button className="btn-primary btn-lg" onClick={()=>change(2)}>خلّنا نجرب أول بطاقة </button>
    </>:<>
     <div className="tutorial-example-label">{stepNum===4||stepNum===5?'أبو فهد يقول: '+(stepNum===4?'«المصرّف»':'«السند»'):'بطاقتك في هذا المثال'}</div>
     <div className="tutorial-hand-row">
      {stepNum===4||stepNum===5?<CardView faceDown={!done} characterId={done?(stepNum===4?'nashal':'sanad'):undefined} size="md" badgeText={done?'البطاقة الحقيقية':'محد يشوفها الآن'}/>:<CardView characterId={exampleCard} size="md" selected={selected} disabled={done} onClick={()=>{setSelected(true);setError('');}} badgeText={selected?'✓ اخترتها':' اضغط هذه البطاقة'}/>}
     </div>
     {stepNum===3&&!done&&<div className="tutorial-claim-picker"><span>بطاقتك «الملقوف». وش بتقول لهم؟</span><div className="claim-buttons-row"><button className={`claim-chip ${claim==='malqoof'?'is-selected':''}`} aria-pressed={claim==='malqoof'} onClick={()=>setClaim('malqoof')}>أقول: الملقوف — صدق</button><button className={`claim-chip ${claim==='alkabeer'?'is-selected':''}`} aria-pressed={claim==='alkabeer'} onClick={()=>{setClaim('alkabeer');setError('');}}>أقول: الكبير — خداع</button></div></div>}
     {error&&<p className="tutorial-inline-error" role="alert">{error}</p>}
     {!done?<button className={stepNum===4||stepNum===5?'btn-sadooh-mega':'btn-primary btn-lg'} onClick={play}>{stepNum===2?'ألعبها وأقول: السند':stepNum===3?'ألعبها وأقول: الكبير':stepNum===6?'ألعب آخر بطاقة': ' صادوه! أكشف بطاقته'}</button>:<>
      <div className="tutorial-result-note" role="status"><strong>{stepNum===6?' فزت!':'وش صار؟'}</strong><p>{TUTORIAL_RESULTS[stepNum]}</p><span>بطاقاتك الآن: {me.hand.length} • بطاقات أبو فهد: {state.players[1].hand.length}</span></div>
      {stepNum<6?<button className="btn-primary btn-lg" onClick={()=>change((stepNum+1) as TutorialStepNumber)}>فهمت — نكمل </button>:<><p className="tutorial-short-copy">جاهز تجرب مباراة؟ بيطلع لك شرح صغير أثناء اللعب.</p><button className="btn-primary btn-lg" onClick={onStartPractice}> ألعب مباراة مع الشرح</button><button className="btn-ghost" onClick={onCompleteTutorial}>العودة للقائمة</button></>}
     </>}
    </>}
   </section>
   {stepNum>1&&<button className="btn-secondary tutorial-back-button" onClick={()=>change((stepNum-1) as TutorialStepNumber)}>رجوع خطوة</button>}
  </div>
 </div>;
};
