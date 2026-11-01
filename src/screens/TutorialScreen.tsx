import {t,fmt,tr} from '../i18n/translate';
import {BrandLogo} from '../components/Theme';
import {CardGuide} from '../components/CardGuide';
import React,{useState} from 'react';
import {TUTORIAL_STEPS,TUTORIAL_RESULTS,TUTORIAL_PLAYER,createTutorialExample,playTutorialExample,type TutorialStepNumber} from '../game/tutorial/tutorialEngine';
import {CardView} from '../components/CardView';

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
  if(stepNum!==4&&stepNum!==5&&!selected){setError(t("اضغط على البطاقة أولًا "));return;}
  if(stepNum===3&&claim!=='alkabeer'){setError(t("في هذا المثال نجرب الخداع. اختر «أقول: الكبير»."));return;}
  setState(playTutorialExample(stepNum,state));setDone(true);setError('');
 };
 const exampleCard=stepNum===3?'malqoof':'sanad';
 return <div className="tutorial-screen" style={{backgroundImage:"url('./assets/game-table.svg')"}}>
  <div className="tutorial-backdrop simple-tutorial">
   <header className="tutorial-header"><div className="tutorial-header__brand"><BrandLogo onHome={onSkipTutorial} alt={t("صادوه!")} className="tutorial-header__logo"/><div><h2>{""+t("نجربها سوا، خطوة خطوة")+""}</h2><span className="tutorial-step-indicator">{tr(stepNum)} {" "+t("من 6 —")+" "}{tr(step.titleAr)}</span></div></div><button className="btn-ghost" onClick={onSkipTutorial}>{""+t("العودة للقائمة")+""}</button></header>
   <div className="tutorial-progress-bar" aria-label={t("تقدم التجربة")}>{tr(([1,2,3,4,5,6] as TutorialStepNumber[]).map(n=><div key={n} className={`tutorial-progress-step ${n===stepNum?'is-current':n<stepNum?'is-done':''}`}>{tr(n)}</div>))}</div>
   <div className="tutorial-mentor-box"><div className="tutorial-mentor-avatar-wrap"><img src="./assets/abu-fahad.svg" alt={t("فهد")} className="tutorial-mentor-avatar"/></div><div className="tutorial-mentor-speech"><p className="mentor-speech-main">{tr(step.speechAr)}</p><p className="mentor-instruction-pill"> {tr(done?t("شوف النتيجة تحت. خذ وقتك، وبعدها كمل."):step.instructionAr)}</p></div></div>
   <p className="practice-no-pressure">{""+t("تجربة بدون مؤقت • ما تحسب فوز أو خسارة • كل خطوة مثال جديد")+""}</p>
   <section className="tutorial-stage" aria-label={tr(step.titleAr)}>
    {tr(stepNum===1?<>
     <div className="tutorial-goal"><strong> {" "+t("تبدأ بـ4 بطاقات")+""}</strong><span aria-hidden="true"></span><strong> {" "+t("تخلصها وتفوز")+""}</strong></div>
     <p className="tutorial-short-copy">{""+t("في دورك: تلعب بطاقة وتقول اسمها. تقدر تقول الصدق أو تخدعهم.")+""}</p>
     <button className="btn-primary btn-lg" onClick={()=>change(2)}>{""+t("خلّنا نجرب أول بطاقة")+" "}</button>
    </>:<>
     <div className="tutorial-example-label">{tr(stepNum===4||stepNum===5?t("فهد يقول: ")+(stepNum===4?t("«المصرّف»"):t("«السند»")):t("بطاقتك في هذا المثال"))}</div>
     <div className="tutorial-hand-row">
      {tr(stepNum===4||stepNum===5?<CardView faceDown={!done} characterId={done?(stepNum===4?'nashal':'sanad'):undefined} size="md" badgeText={tr(done?t("البطاقة الحقيقية"):t("محد يشوفها الآن"))}/>:<CardView characterId={exampleCard} size="md" selected={selected} disabled={done} onClick={()=>{setSelected(true);setError('');}} badgeText={tr(selected?t("✓ اخترتها"):t(" اضغط هذه البطاقة"))}/>)}
     </div>
     {tr(stepNum===3&&!done&&<div className="tutorial-claim-picker"><span>{""+t("بطاقتك «الملقوف». وش بتقول لهم؟")+""}</span><div className="claim-buttons-row"><button className={`claim-chip ${claim==='malqoof'?'is-selected':''}`} aria-pressed={claim==='malqoof'} onClick={()=>setClaim('malqoof')}>{""+t("أقول: الملقوف — صدق")+""}</button><button className={`claim-chip ${claim==='alkabeer'?'is-selected':''}`} aria-pressed={claim==='alkabeer'} onClick={()=>{setClaim('alkabeer');setError('');}}>{""+t("أقول: الكبير — خداع")+""}</button></div></div>)}
     {tr(error&&<p className="tutorial-inline-error" role="alert">{tr(error)}</p>)}
     {tr(!done?<button className={stepNum===4||stepNum===5?'btn-sadooh-mega':'btn-primary btn-lg'} onClick={play}>{tr(stepNum===2?t("ألعبها وأقول: السند"):stepNum===3?t("ألعبها وأقول: الكبير"):stepNum===6?t("ألعب آخر بطاقة"): t(" صادوه! أكشف بطاقته"))}</button>:<>
      <div className="tutorial-result-note" role="status"><strong>{tr(stepNum===6?t(" فزت!"):t("وش صار؟"))}</strong><p>{tr(TUTORIAL_RESULTS[stepNum])}</p><span>{""+t("بطاقاتك الآن:")+" "}{tr(me.hand.length)} {" "+t("• بطاقات فهد:")+" "}{tr(state.players[1].hand.length)}</span></div>
      {tr(stepNum<6?<button className="btn-primary btn-lg" onClick={()=>change((stepNum+1) as TutorialStepNumber)}>{""+t("فهمت — نكمل")+" "}</button>:<><CardGuide/><p className="tutorial-short-copy">{""+t("جاهز تجرب مباراة؟ بيطلع لك شرح صغير أثناء اللعب.")+""}</p><button className="btn-primary btn-lg" onClick={onStartPractice}> {" "+t("ألعب مباراة مع الشرح")+""}</button><button className="btn-ghost" onClick={onCompleteTutorial}>{""+t("العودة للقائمة")+""}</button></>)}
     </>)}
    </>)}
   </section>
   {tr(stepNum>1&&<button className="btn-secondary tutorial-back-button" onClick={()=>change((stepNum-1) as TutorialStepNumber)}>{""+t("رجوع خطوة")+""}</button>)}
  </div>
 </div>;
};
