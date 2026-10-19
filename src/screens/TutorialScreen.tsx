import React, { useState } from 'react';
import { CHARACTER_LIST, CHARACTERS, TUTORIAL_STEPS } from '../game/tutorial/tutorialEngine';
import { CardView } from '../components/CardView';
import { CharacterId } from '../types/game';
import { soundManager } from '../services/audio/soundEffects';

interface TutorialScreenProps {
  onCompleteTutorial: () => void;
  onSkipTutorial: () => void;
}

/**
 * شاشة الجولة التعليمية التفاعلية المحددة مسبقًا مع شخصية «أبو فهد» (6 خطوات):
 * 1. التعرف على البطاقات.
 * 2. لعب بطاقة حقيقية.
 * 3. ادعاء شخصية مختلفة عن البطاقة.
 * 4. استخدام زر «صادوه!» ضد أبو فهد.
 * 5. فهم عقوبة التحدي.
 * 6. تجربة قصيرة مستقلة.
 */
export const TutorialScreen: React.FC<TutorialScreenProps> = ({
  onCompleteTutorial,
  onSkipTutorial,
}) => {
  const [stepNum, setStepNum] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedClaimChar, setSelectedClaimChar] = useState<CharacterId>('alkabeer');
  const [selectedTarget, setSelectedTarget] = useState<'abu_fahad' | 'azzam'>('abu_fahad');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [tutorialFinished, setTutorialFinished] = useState(false);

  const step = TUTORIAL_STEPS[stepNum];

  const advanceStep = (next: 1 | 2 | 3 | 4 | 5 | 6, toastMessage?: string) => {
    setSelectedCardId(null);
    setFeedbackToast(toastMessage ?? null);
    setStepNum(next);
  };

  const handleStep2PlayTruthful = () => {
    if (selectedCardId !== 'tut_c1') {
      setFeedbackToast('اختر بطاقة «السند» أولًا من يدك بالأسفل!');
      return;
    }
    soundManager.playCardPlace();
    advanceStep(
      3,
      'يا ساتر، شكلك بتصير محترف! لعبت «السند» بصدق وتفعّل درع الحماية!'
    );
  };

  const handleStep3PlayBluff = () => {
    if (selectedCardId !== 'tut_c3') {
      setFeedbackToast('اختر بطاقة «الملقوف» من يدك عشان نجرب نخدع بها!');
      return;
    }
    if (selectedClaimChar === 'malqoof') {
      setFeedbackToast('اختر شخصية مختلفة عن «الملقوف» (مثل «الكبير») لتجربة الخداع!');
      return;
    }
    soundManager.playCardPlace();
    advanceStep(
      4,
      'حركة معلم! حطيت «الملقوف» مقلوبة وادعيت أنها «الكبير» ومشت عليهم بدون محد يتحدى!'
    );
  };

  const handleStep4PressSadooh = () => {
    soundManager.playSadoohAlert();
    advanceStep(5, 'قفطناك يا وحش! كشفت كذبة أبو فهد بالوقت المناسب!');
  };

  const handleStep6WinPractice = () => {
    if (selectedCardId !== 'tut_c2') {
      setFeedbackToast('اختر بطاقتك الأخيرة «الكبير» من يدك أولًا!');
      return;
    }
    soundManager.playWinFanfare();
    setTutorialFinished(true);
    setFeedbackToast(
      'يا ساتر، شكلك بتصير محترف! تخلصت من آخر بطاقة في دورك الأساسي وفزت بالجولة!'
    );
  };

  return (
    <div
      className="tutorial-screen"
      style={{ backgroundImage: `url('./assets/game-table.png')` }}
    >
      <div className="tutorial-backdrop">
        {/* الشريط العلوي مع زر التخطي الفوري */}
        <header className="tutorial-header">
          <div className="tutorial-header__brand">
            <img src="./assets/logo.png" alt="صادوه!" className="tutorial-header__logo" />
            <div>
              <h2>🎓 الجولة التعليمية مع أبو فهد</h2>
              <span className="tutorial-step-indicator">
                الخطوة {stepNum} من 6 — {step.titleAr} (لا تُحتسب ضمن الإحصاءات)
              </span>
            </div>
          </div>

          <button type="button" className="btn-secondary" onClick={onSkipTutorial}>
            ⏭️ تخطي الجولة التعليمية فورًا
          </button>
        </header>

        {/* شريط التقدم للخطوات الـ6 */}
        <div className="tutorial-progress-bar">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={`tutorial-progress-step ${
                n === stepNum ? 'is-current' : n < stepNum ? 'is-done' : ''
              }`}
            >
              <span>{n}</span>
            </div>
          ))}
        </div>

        {/* منطقة حوار أبو فهد */}
        <div className="tutorial-mentor-box">
          <div className="tutorial-mentor-avatar-wrap">
            <img
              src="./assets/abu-fahad.png"
              alt="أبو فهد"
              className="tutorial-mentor-avatar"
            />
            <span className="mentor-badge">المرشد: أبو فهد</span>
          </div>
          <div className="tutorial-mentor-speech">
            <p className="mentor-speech-main">«{step.abuFahadSpeechAr}»</p>
            <div className="mentor-instruction-pill">💡 المطلوب: {step.instructionAr}</div>
          </div>
        </div>

        {feedbackToast && (
          <div className="tutorial-toast" role="status">
            {feedbackToast}
          </div>
        )}

        {/* محتوى الخطوة التفاعلي */}
        {!tutorialFinished ? (
          <div className="tutorial-stage">
            {stepNum === 1 && (
              <div className="tutorial-step1-grid">
                <div className="characters-showcase-grid">
                  {CHARACTER_LIST.map((char) => (
                    <div key={char.id} className="character-showcase-item">
                      <CardView characterId={char.id} size="sm" />
                    </div>
                  ))}
                </div>
                <div className="tutorial-cta-row">
                  <button
                    type="button"
                    className="btn-primary btn-lg"
                    onClick={() =>
                      advanceStep(2, 'ممتاز! الحين خلنا نجرب نلعب أول بطاقة بصدق.')
                    }
                  >
                    فهمت الشخصيات الست — التالي ⬅️
                  </button>
                </div>
              </div>
            )}

            {stepNum === 2 && (
              <div className="tutorial-interactive-area">
                <div className="tutorial-hand-row">
                  {step.myHand.map((card) => (
                    <CardView
                      key={card.id}
                      characterId={card.characterId}
                      selected={selectedCardId === card.id}
                      onClick={() => setSelectedCardId(card.id)}
                    />
                  ))}
                </div>
                <div className="tutorial-cta-row">
                  <button
                    type="button"
                    className="btn-primary btn-lg"
                    onClick={handleStep2PlayTruthful}
                  >
                    ✅ العب البطاقة مقلوبة بصدق (إعلان: السند)
                  </button>
                </div>
              </div>
            )}

            {stepNum === 3 && (
              <div className="tutorial-interactive-area">
                <div className="tutorial-hand-row">
                  {step.myHand.map((card) => (
                    <CardView
                      key={card.id}
                      characterId={card.characterId}
                      selected={selectedCardId === card.id}
                      onClick={() => setSelectedCardId(card.id)}
                      badgeText={
                        card.id === 'tut_c3' ? 'اختر هذه للخداع' : undefined
                      }
                    />
                  ))}
                </div>

                <div className="tutorial-claim-picker">
                  <span>اختر الشخصية التي ستدّعيها كذبًا أمام الطاولة:</span>
                  <div className="claim-buttons-row">
                    {CHARACTER_LIST.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`claim-chip ${
                          selectedClaimChar === c.id ? 'is-selected' : ''
                        }`}
                        onClick={() => setSelectedClaimChar(c.id)}
                      >
                        {c.nameAr} {c.id === 'alkabeer' ? '(مقترح)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="tutorial-cta-row">
                  <button
                    type="button"
                    className="btn-primary btn-lg"
                    onClick={handleStep3PlayBluff}
                  >
                    🎭 ضع البطاقة مقلوبة وادّعِ «{CHARACTERS[selectedClaimChar].nameAr}» ضد أبو فهد
                  </button>
                </div>
              </div>
            )}

            {stepNum === 4 && (
              <div className="tutorial-challenge-stage">
                <div className="tutorial-table-center-card">
                  <CardView faceDown size="md" badgeText="بطاقة أبو فهد المقلوبة" />
                  <div className="tutorial-claim-banner">
                    <strong>أبو فهد يعلن:</strong> «ألعب بطاقة <span>المصرّف</span>!»
                    <p className="funny-hint">«هاه؟ تصدقه ولا تصيده؟»</p>
                  </div>
                </div>

                <div className="tutorial-cta-row">
                  <button
                    type="button"
                    className="btn-sadooh-mega"
                    onClick={handleStep4PressSadooh}
                  >
                    🚨 صادوه! (اكشف كذبة أبو فهد)
                  </button>
                </div>
              </div>
            )}

            {stepNum === 5 && (
              <div className="tutorial-penalty-explanation">
                <div className="revealed-comparison-row">
                  <div className="revealed-card-box">
                    <span>البطاقة الحقيقية التي انكشفت:</span>
                    <CardView characterId="nashal" size="sm" badgeText="كانت النشّال!" />
                  </div>
                  <div className="penalty-rules-summary">
                    <h3>⚖️ نتيجة التحدي: «قفطناك يا وحش!»</h3>
                    <ul>
                      <li>
                        لأن أبو فهد كان <strong>كاذبًا</strong>: أُلغيت قدرة المصرّف وسحب أبو
                        فهد <strong>بطاقة عقوبة واحدة فقط</strong> (أصبح معه 4 بطاقات).
                      </li>
                      <li>
                        لو كان أبو فهد <strong>صادقًا</strong>: تنفذ قدرته وتسحب أنت (المتحدي)
                        <strong> بطاقة عقوبة واحدة فقط</strong>!
                      </li>
                      <li>
                        <strong>قاعدة المصرّف المهمة:</strong> لا يمكن الفوز ببطاقة المصرّف
                        الإضافية وحدها؛ يجب أن تكون البطاقة الأخيرة التي تنهي المباراة هي
                        البطاقة الأساسية التي تلعبها في دورك.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="tutorial-cta-row">
                  <button
                    type="button"
                    className="btn-primary btn-lg"
                    onClick={() =>
                      advanceStep(6, 'لا تستعجل، فكر قبل تتهم! الحين احسم الجولة ببطاقتك الأخيرة!')
                    }
                  >
                    جاهز للتجربة الأخيرة ⬅️
                  </button>
                </div>
              </div>
            )}

            {stepNum === 6 && (
              <div className="tutorial-interactive-area">
                <div className="tutorial-hand-row">
                  {step.myHand.map((card) => (
                    <CardView
                      key={card.id}
                      characterId={card.characterId}
                      selected={selectedCardId === card.id}
                      onClick={() => setSelectedCardId(card.id)}
                      badgeText="بطاقتك الأخيرة للفوز!"
                    />
                  ))}
                </div>

                <div className="tutorial-claim-picker">
                  <span>اختر الخصم المستهدف بقدرة «الكبير»:</span>
                  <div className="claim-buttons-row">
                    <button
                      type="button"
                      className={`claim-chip ${
                        selectedTarget === 'abu_fahad' ? 'is-selected' : ''
                      }`}
                      onClick={() => setSelectedTarget('abu_fahad')}
                    >
                      🎯 أبو فهد (4 بطاقات)
                    </button>
                    <button
                      type="button"
                      className={`claim-chip ${
                        selectedTarget === 'azzam' ? 'is-selected' : ''
                      }`}
                      onClick={() => setSelectedTarget('azzam')}
                    >
                      🎯 عزّام (4 بطاقات)
                    </button>
                  </div>
                </div>

                <div className="tutorial-cta-row">
                  <button
                    type="button"
                    className="btn-primary btn-lg"
                    onClick={handleStep6WinPractice}
                  >
                    🏆 العب البطاقة الأخيرة بصدق واحسم الفوز!
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="tutorial-complete-card">
            <img
              src="./assets/abu-fahad.png"
              alt="أبو فهد"
              className="tutorial-complete-avatar"
            />
            <h2>🎉 كفو والله! ختمت الجولة التعليمية!</h2>
            <p>
              أبو فهد: «يا ساتر، شكلك بتصير محترف! الحين صرت جاهز تدخل طاولة الاستراحة
              وتلعب ضدنا!»
            </p>
            <div className="tutorial-cta-row">
              <button
                type="button"
                className="btn-primary btn-lg"
                onClick={onCompleteTutorial}
              >
                🚀 انطلق إلى القائمة الرئيسية والعب الآن
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
