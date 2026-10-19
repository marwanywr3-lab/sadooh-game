import { CardInstance, CharacterId } from '../../types/game';
import { ALL_CHARACTER_IDS } from './characters';

/**
 * عدد النسخ لكل شخصية في كومة السحب.
 * 8 نسخ × 6 شخصيات = 48 بطاقة (مناسب لـ 3 إلى 8 لاعبين، حيث يوزع بحد أقصى 32 بطاقة في البداية وتبقى 16 في الكومة).
 */
export const COPIES_PER_CHARACTER = 8;
export const INITIAL_HAND_SIZE = 4;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const MOVE_TIMER_SECONDS = 15;
export const CHALLENGE_TIMER_SECONDS = 5;

/**
 * خلط المصفوفة بخوارزمية Fisher-Yates مع إمكانية تمرير دالة عشوائية مخصصة للاختبارات الحتمية
 */
export function shuffleCards<T>(items: T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * إنشاء كومة سحب متوازنة (48 بطاقة: 8 من كل شخصية من الشخصيات الست)
 */
export function createBalancedDeck(
  copiesPerCharacter: number = COPIES_PER_CHARACTER,
  rng: () => number = Math.random
): CardInstance[] {
  const deck: CardInstance[] = [];
  let seq = 1;
  for (const charId of ALL_CHARACTER_IDS) {
    for (let copy = 1; copy <= copiesPerCharacter; copy++) {
      deck.push({
        id: `card_${charId}_${copy}_${seq++}`,
        characterId: charId as CharacterId,
      });
    }
  }
  return shuffleCards(deck, rng);
}

/**
 * سحب بطاقة واحدة من كومة السحب، مع إعادة خلط كومة البطاقات المستخدمة تلقائيًا عند فراغ كومة السحب
 * دون كشف أي معلومات سرية. إذا كانت الكومتان فارغتين، يعيد null بأمان دون تعطيل اللعبة.
 */
export function drawOneCardSafely(
  drawPile: CardInstance[],
  discardPile: CardInstance[],
  rng: () => number = Math.random
): {
  card: CardInstance | null;
  nextDrawPile: CardInstance[];
  nextDiscardPile: CardInstance[];
  reshuffled: boolean;
} {
  let currentDraw = [...drawPile];
  let currentDiscard = [...discardPile];
  let reshuffled = false;

  if (currentDraw.length === 0 && currentDiscard.length > 0) {
    currentDraw = shuffleCards(currentDiscard, rng);
    currentDiscard = [];
    reshuffled = true;
  }

  if (currentDraw.length === 0) {
    return {
      card: null,
      nextDrawPile: currentDraw,
      nextDiscardPile: currentDiscard,
      reshuffled,
    };
  }

  const card = currentDraw[0];
  return {
    card,
    nextDrawPile: currentDraw.slice(1),
    nextDiscardPile: currentDiscard,
    reshuffled,
  };
}
