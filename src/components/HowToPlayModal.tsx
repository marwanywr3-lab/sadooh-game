import React from 'react';
import { CHARACTER_LIST } from '../game/rules/characters';
import { CardView } from './CardView';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTutorial: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  isOpen,
  onClose,
  onStartTutorial,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="كيف تلعب صادوه!"
      >
        <div className="modal-card__header">
          <h2>📖 كيف تلعب «صادوه!» في 30 ثانية؟</h2>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-card__body">
          <div className="rules-grid">
            <div className="rule-box">
              <h4>1. البداية والهدف 🎯</h4>
              <p>
                يبدأ كل لاعب بـ <strong>4 بطاقات عشوائية</strong>. أول لاعب يتخلص من جميع
                بطاقاته بصورة قانونية في نهاية دوره يفوز بالمباراة فورًا!
              </p>
            </div>
            <div className="rule-box">
              <h4>2. الصدق أو الكذب 🎭</h4>
              <p>
                في دورك (خلال 15 ثانية)، اختر بطاقة من يدك وضعها مقلوبة، ثم أعلن أنك تلعب
                إحدى الشخصيات الست — يمكنك قول الحقيقة أو الكذب!
              </p>
            </div>
            <div className="rule-box">
              <h4>3. تحدي «صادوه!» 🚨</h4>
              <p>
                أمام الخصوم 5 ثوانٍ لضغط زر <strong>«صادوه!»</strong>. إذا لم يتحدَّك أحد،
                تنفذ القدرة المعلنة وتظل بطاقتك سرية!
              </p>
            </div>
            <div className="rule-box">
              <h4>4. عقوبة التحدي ⚖️</h4>
              <p>
                إذا تحدّاك خصم وكُنت كاذبًا: تُلغى القدرة وتسحب أنت{' '}
                <strong>بطاقة عقوبة واحدة فقط</strong>. وإذا كنت صادقًا: تُنفذ القدرة ويسحب
                المتحدي <strong>بطاقة عقوبة واحدة فقط</strong>!
              </p>
            </div>
          </div>

          <h3 className="section-subtitle">الشخصيات الست وقدراتها</h3>
          <div className="characters-showcase-grid">
            {CHARACTER_LIST.map((char) => (
              <div key={char.id} className="character-showcase-item">
                <CardView characterId={char.id} size="sm" />
              </div>
            ))}
          </div>

          <div className="special-rules-callout">
            <h4>📌 قواعد ذهبية مهمة:</h4>
            <ul>
              <li>
                <strong>المصرّف:</strong> لا يستطيع تحقيق الفوز باستخدام البطاقة الإضافية
                وحدها؛ يجب أن تكون البطاقة الأخيرة التي تُنهي المباراة هي البطاقة الأساسية
                التي لعبها اللاعب في دوره.
              </li>
              <li>
                <strong>السند:</strong> يحميك تلقائيًا من أول قدرة تستهدفك حتى دورك القادم،
                لكنه لا يمنع تحدي «صادوه!».
              </li>
              <li>
                <strong>إفراغ اليد بقدرة خصم:</strong> إذا سحب خصم آخر بطاقة من يدك بقدرة
                «النشّال»، لا يُعد ذلك فوزًا خارج دورك.
              </li>
            </ul>
          </div>
        </div>

        <div className="modal-card__footer">
          <button type="button" className="btn-secondary" onClick={onStartTutorial}>
            🎓 جرب الجولة التعليمية مع أبو فهد
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            واضح، يلا نلعب!
          </button>
        </div>
      </div>
    </div>
  );
};
