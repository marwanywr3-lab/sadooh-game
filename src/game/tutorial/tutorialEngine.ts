import { CardInstance, CharacterId } from '../../types/game';
import { CHARACTER_LIST, CHARACTERS } from '../rules/characters';

/**
 * الجولة التعليمية التفاعلية المحددة مسبقًا مع «أبو فهد» (6 خطوات).
 * جميع أحداثها حتمية ومحددة مسبقًا حتى لا تتعطل أبدًا، ولا تُحتسب ضمن إحصاءات اللاعب.
 */
export interface TutorialStepState {
  stepNumber: 1 | 2 | 3 | 4 | 5 | 6;
  titleAr: string;
  abuFahadSpeechAr: string;
  instructionAr: string;
  myHand: CardInstance[];
  abuFahadCardCount: number;
  azzamCardCount: number;
  tableClaim: {
    speakerName: string;
    claimedCharacter: CharacterId;
    actualCharacter?: CharacterId;
    isRevealed: boolean;
  } | null;
  expectedAction:
    | 'INSPECT_CARDS'
    | 'PLAY_TRUTHFUL_CARD'
    | 'PLAY_BLUFF_CARD'
    | 'PRESS_SADOOH_ON_ABU_FAHAD'
    | 'UNDERSTAND_PENALTY'
    | 'MINI_PRACTICE_WIN';
}

export const TUTORIAL_STEPS: Record<1 | 2 | 3 | 4 | 5 | 6, TutorialStepState> = {
  1: {
    stepNumber: 1,
    titleAr: '1. التعرّف على البطاقات الست',
    abuFahadSpeechAr:
      'يا هلا والله في استراحة «صادوه!».. أنا أبو فهد! فكرة لعبتنا تتعلمها في 30 ثانية: كل لاعب يبدأ بـ 4 بطاقات، واللي يفضي يده أول بصورة نظامية يفوز! اضغط على البطاقات اللي قدامك عشان تتعرف على الشخصيات الست، ثم اضغط «فهمت الشخصيات».',
    instructionAr: 'استعرض الشخصيات الست وقدرة كل شخصية في سطر واحد، ثم انتقل للخطوة التالية.',
    myHand: [
      { id: 'tut_c1', characterId: 'sanad' },
      { id: 'tut_c2', characterId: 'alkabeer' },
      { id: 'tut_c3', characterId: 'malqoof' },
      { id: 'tut_c4', characterId: 'mosarref' },
    ],
    abuFahadCardCount: 4,
    azzamCardCount: 4,
    tableClaim: null,
    expectedAction: 'INSPECT_CARDS',
  },
  2: {
    stepNumber: 2,
    titleAr: '2. لعب بطاقة حقيقية (الصدق)',
    abuFahadSpeechAr:
      'الحين دورك! عندك بطاقة «السند» في يدك. اختر بطاقة «السند» وأعلن بصدق أنك تلعب «السند» عشان تحمي نفسك من أول قدرة تستهدفك حتى دورك القادم!',
    instructionAr: 'اضغط على بطاقة «السند» من يدك ثم اضغط زر «العب البطاقة بصدق (السند)».',
    myHand: [
      { id: 'tut_c1', characterId: 'sanad' },
      { id: 'tut_c2', characterId: 'alkabeer' },
      { id: 'tut_c3', characterId: 'malqoof' },
    ],
    abuFahadCardCount: 4,
    azzamCardCount: 4,
    tableClaim: null,
    expectedAction: 'PLAY_TRUTHFUL_CARD',
  },
  3: {
    stepNumber: 3,
    titleAr: '3. ادعاء شخصية مختلفة عن البطاقة (الخداع)',
    abuFahadSpeechAr:
      'كفو! درع السند اشتغل. بس حلاوة «صادوه!» في الخداع! الحين بنجرب نكذب: اختر بطاقة «الملقوف» من يدك، لكن أعلن قدامنا إنك تلعب «الكبير» على أبو فهد عشان تخليني أسحب بطاقة!',
    instructionAr:
      'اختر بطاقة «الملقوف» من يدك، ثم اختر الادعاء الكاذب «الكبير» ضد أبو فهد وضعها مقلوبة.',
    myHand: [
      { id: 'tut_c2', characterId: 'alkabeer' },
      { id: 'tut_c3', characterId: 'malqoof' },
    ],
    abuFahadCardCount: 4,
    azzamCardCount: 4,
    tableClaim: null,
    expectedAction: 'PLAY_BLUFF_CARD',
  },
  4: {
    stepNumber: 4,
    titleAr: '4. استخدام زر «صادوه!» ضد أبو فهد',
    abuFahadSpeechAr:
      'هاه؟ تصدقه ولا تصيده؟ الحين دوري أنا يا أبو فهد! حطيت بطاقة مقلوبة وأدّعي إنها «المصرّف» عشان أتخلص من بطاقة إضافية.. بس عيوني تفضحني! اضغط زر «صادوه!» الكبير واكشف كذبتي!',
    instructionAr: 'اضغط على زر «صادوه!» الأحمر الكبير لتحدي ادعاء أبو فهد قبل انتهاء الوقت.',
    myHand: [{ id: 'tut_c2', characterId: 'alkabeer' }],
    abuFahadCardCount: 3,
    azzamCardCount: 4,
    tableClaim: {
      speakerName: 'أبو فهد',
      claimedCharacter: 'mosarref',
      actualCharacter: 'nashal',
      isRevealed: false,
    },
    expectedAction: 'PRESS_SADOOH_ON_ABU_FAHAD',
  },
  5: {
    stepNumber: 5,
    titleAr: '5. فهم عقوبة التحدي وقواعد الفوز',
    abuFahadSpeechAr:
      'قفطناك يا وحش! بطاقتي الحقيقية كانت «النشّال» مو «المصرّف»! لأنك صدتني وأنا أكذب، التغت قدرتي وسحبت أنا بطاقة عقوبة واحدة فقط. وتذكّر: لو كنت أنا صادق وتحديتني، تنفذ قدرتي وتسحب أنت بطاقة عقوبة واحدة! ولا تنسَ: لا تستعجل، فكر قبل تتهم!',
    instructionAr:
      'راجع ملخص عقوبة التحدي وقاعدة المصرّف (لا يمكن الفوز بالبطاقة الإضافية للمصرّف وحدها)، ثم اضغط «جاهز للتجربة الأخيرة».',
    myHand: [{ id: 'tut_c2', characterId: 'alkabeer' }],
    abuFahadCardCount: 4,
    azzamCardCount: 4,
    tableClaim: {
      speakerName: 'أبو فهد',
      claimedCharacter: 'mosarref',
      actualCharacter: 'nashal',
      isRevealed: true,
    },
    expectedAction: 'UNDERSTAND_PENALTY',
  },
  6: {
    stepNumber: 6,
    titleAr: '6. تجربة قصيرة مستقلة لحسم الفوز',
    abuFahadSpeechAr:
      'يا ساتر، شكلك بتصير محترف! بقيت في يدك بطاقة واحدة أخيرة («الكبير»). العبها كحركة أساسية في دورك ضد عزّام أو أبو فهد لتتخلص من آخر بطاقة وتفوز بالجولة التعليمية!',
    instructionAr:
      'العب بطاقتك الأخيرة «الكبير» وحدد الهدف لحسم الجولة التعليمية بالفوز القانوني.',
    myHand: [{ id: 'tut_c2', characterId: 'alkabeer' }],
    abuFahadCardCount: 4,
    azzamCardCount: 4,
    tableClaim: null,
    expectedAction: 'MINI_PRACTICE_WIN',
  },
};

export { CHARACTER_LIST, CHARACTERS };
