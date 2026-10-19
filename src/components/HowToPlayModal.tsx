import {CardGuide} from './CardGuide';
import React from 'react';
interface HowToPlayModalProps{isOpen:boolean;onClose:()=>void;onStartTutorial:()=>void;}
export const HowToPlayModal:React.FC<HowToPlayModalProps>=({isOpen,onClose,onStartTutorial})=>{
 if(!isOpen)return null;
 return <div className="modal-backdrop" onClick={onClose}><div className="modal-card modal-card--wide" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="كيف ألعب صادوه؟">
  <div className="modal-card__header"><h2>الفكرة بسيطة </h2><button className="btn-icon-close" aria-label="إغلاق الشرح" onClick={onClose}>✕</button></div>
  <div className="modal-card__body simple-rules">
   <p className="simple-rules-goal"> هدفك: تخلّص بطاقاتك قبل الباقين.</p>
   <ol className="simple-rules-list"><li><strong>العب بطاقة.</strong> قل اسمها أو اخدعهم باسم ثاني.</li><li><strong>تشك في لاعب؟ صادوه!</strong> الكاذب يسحب بطاقة. وإذا طلع صادق، أنت تسحب.</li><li><strong>خلّص ورقك أول واحد وتفوز.</strong></li></ol>
   <p className="simple-rules-note">إذا محد ضغط «صادوه!»، نطبق حركة الشخصية اللي قالها اللاعب.</p>
   <button className="btn-primary btn-lg" onClick={onStartTutorial}> جرّبها مع شرح خطوة بخطوة</button>

   <details className="simple-rules-details"><summary>قواعد إضافية، إذا احتجتها</summary><p>تبدأ بـ4 بطاقات. تفوز لما تلعب آخر بطاقة في دورك.</p><p>ما تفوز ببطاقة «المصرّف» الإضافية، ولا إذا أخذ خصم آخر بطاقة من يدك.</p><p>درع «السند» يحميك من أول قدرة تستهدفك حتى دورك القادم، لكنه ما يمنع «صادوه!».</p></details>
   <CardGuide/>
  </div>
 </div></div>;
};
