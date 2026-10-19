import React from 'react';
import {CHARACTER_LIST} from '../game/rules/characters';
interface HowToPlayModalProps{isOpen:boolean;onClose:()=>void;onStartTutorial:()=>void;}
export const HowToPlayModal:React.FC<HowToPlayModalProps>=({isOpen,onClose,onStartTutorial})=>{
 if(!isOpen)return null;
 return <div className="modal-backdrop" onClick={onClose}><div className="modal-card modal-card--wide" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="كيف ألعب صادوه؟">
  <div className="modal-card__header"><h2>الفكرة بسيطة </h2><button className="btn-icon-close" aria-label="إغلاق الشرح" onClick={onClose}>✕</button></div>
  <div className="modal-card__body simple-rules">
   <p className="simple-rules-goal"> هدفك: تخلّص بطاقاتك قبل الباقين.</p>
   <ol className="simple-rules-list"><li><strong>اختر بطاقة من يدك.</strong><p>حطّها مقلوبة، عشان ما يشوفها أحد.</p></li><li><strong>قل اسمها… أو اخدعهم!</strong><p>مثلًا: بطاقتك «الملقوف»، وتقول «الكبير».</p></li><li><strong>تشك في كلام لاعب؟ اضغط «صادوه!».</strong><p>لو كذب: هو يسحب بطاقة. لو صدق: أنت تسحب بطاقة.</p></li></ol>
   <p className="simple-rules-note">إذا محد ضغط «صادوه!»، نطبق حركة الشخصية اللي قالها اللاعب.</p>
   <button className="btn-primary btn-lg" onClick={onStartTutorial}> جرّبها مع شرح خطوة بخطوة</button>
   <details className="simple-rules-details"><summary>وش تسوي كل شخصية؟ (اختياري)</summary><ul>{CHARACTER_LIST.map(c=><li key={c.id}><strong>{c.nameAr}:</strong> {c.descriptionAr}</li>)}</ul></details>
   <details className="simple-rules-details"><summary>قواعد إضافية، إذا احتجتها</summary><p>تبدأ بـ4 بطاقات. تفوز لما تلعب آخر بطاقة في دورك.</p><p>ما تفوز ببطاقة «المصرّف» الإضافية، ولا إذا أخذ خصم آخر بطاقة من يدك.</p><p>درع «السند» يحميك من أول قدرة تستهدفك حتى دورك القادم، لكنه ما يمنع «صادوه!».</p></details>
  </div>
 </div></div>;
};
