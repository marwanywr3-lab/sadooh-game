import {
  BotDifficulty,
  BotLegalMemory,
  CharacterId,
  ClientProjectedGameState,
  MoveSubmission,
} from '../../types/game';
import { ALL_CHARACTER_IDS, CHARACTERS } from '../rules/characters';

/**
 * محرك قرارات الخصوم الآليين المحلي (Local Bot Engine)
 *
 * تنبيه معماري صارم:
 * يستقبل هذا المحرك فقط `ClientProjectedGameState` (الحالة المرئية للبوت كأي لاعب عادي)
 * بالإضافة إلى `BotLegalMemory` (ما اكتشفه البوت قانونيًا بقدرة الملقوف أو المخبّص).
 * لا يمكن للبوت أبدًا الاطلاع على بطاقات اللاعب السرية أو البطاقة المقلوبة على الطاولة.
 */
export function decideBotMove(
  projectedState: ClientProjectedGameState,
  memory: BotLegalMemory | undefined,
  difficulty: BotDifficulty = 'medium',
  rng: () => number = Math.random
): MoveSubmission {
  const myHand = projectedState.myHand;
  if (myHand.length === 0) {
    throw new Error('لا يملك البوت بطاقات للعب.');
  }

  // اختيار البطاقة الفعلية التي سيضعها مقلوبة
  let chosenCard = myHand[Math.floor(rng() * myHand.length)];

  // في المستوى الصعب أو المتوسط: إذا كان البوت يمتلك بطاقة واحدة فقط، يلعبها بصدق دائمًا ليفوز بأمان حتى لو تحدّاه أحد!
  if (myHand.length === 1 && difficulty !== 'easy') {
    const lastCard = myHand[0];
    const targetId = pickBestTarget(
      projectedState,
      projectedState.viewerPlayerId,
      lastCard.characterId,
      difficulty,
      rng
    );
    return {
      playerId: projectedState.viewerPlayerId,
      cardId: lastCard.id,
      claimedCharacter: lastCard.characterId,
      targetPlayerId: targetId,
    };
  }

  // تحديد احتمالية الكذب حسب مستوى الصعوبة
  // سهل: يكذب بعشوائية (40%)، متوسط: يكذب بذكاء (28%)، صعب: يكذب تكتيكيًا (22%)
  const bluffChance =
    difficulty === 'easy' ? 0.4 : difficulty === 'medium' ? 0.28 : 0.22;
  const shouldBluff = rng() < bluffChance;

  let claimedCharacter: CharacterId = chosenCard.characterId;

  if (!shouldBluff) {
    // في المستوى الصعب، يفضل لعب «المصرّف» إن كان لديه 3 بطاقات فأكثر، أو «الكبير» ضد أقرب لاعب للفوز
    if (difficulty === 'hard') {
      const mosarrefCard = myHand.find((c) => c.characterId === 'mosarref');
      const alkabeerCard = myHand.find((c) => c.characterId === 'alkabeer');
      const sanadCard = myHand.find((c) => c.characterId === 'sanad');
      const me = projectedState.players.find(
        (p) => p.id === projectedState.viewerPlayerId
      );

      if (mosarrefCard && myHand.length >= 3) {
        chosenCard = mosarrefCard;
        claimedCharacter = 'mosarref';
      } else if (alkabeerCard) {
        chosenCard = alkabeerCard;
        claimedCharacter = 'alkabeer';
      } else if (sanadCard && me && !me.hasSanadShield) {
        chosenCard = sanadCard;
        claimedCharacter = 'sanad';
      } else {
        claimedCharacter = chosenCard.characterId;
      }
    } else {
      claimedCharacter = chosenCard.characterId;
    }
  } else {
    // الكذب: ادعاء شخصية مختلفة عن البطاقة الحقيقية
    const otherCharacters = ALL_CHARACTER_IDS.filter(
      (cid) => cid !== chosenCard.characterId
    );
    if (difficulty === 'hard' && myHand.length >= 3) {
      // في المستوى الصعب يدّعي «المصرّف» أو «الكبير» أو «السند» لتحقيق مكسب تكتيكي
      const tacticalBluffs: CharacterId[] = ['mosarref', 'alkabeer', 'sanad'];
      const availableTactical = tacticalBluffs.filter(
        (cid) => cid !== chosenCard.characterId
      );
      claimedCharacter =
        availableTactical[Math.floor(rng() * availableTactical.length)];
    } else {
      claimedCharacter =
        otherCharacters[Math.floor(rng() * otherCharacters.length)];
    }
  }

  const targetPlayerId = pickBestTarget(
    projectedState,
    projectedState.viewerPlayerId,
    claimedCharacter,
    difficulty,
    rng
  );

  // إذا كان يلعب «المصرّف» أو «المخبّص» ولديه بطاقة إضافية، يختار بطاقة ثانوية غير البطاقة الملعوبة
  const remainingHand = myHand.filter((c) => c.id !== chosenCard.id);
  const secondaryCardId =
    remainingHand.length > 0 ? remainingHand[0].id : null;

  return {
    playerId: projectedState.viewerPlayerId,
    cardId: chosenCard.id,
    claimedCharacter,
    targetPlayerId,
    secondaryCardId,
  };
}

/**
 * اختيار أفضل هدف للقدرات الموجهة ضد الخصوم
 */
function pickBestTarget(
  projectedState: ClientProjectedGameState,
  myPlayerId: string,
  claimedCharacter: CharacterId,
  difficulty: BotDifficulty,
  rng: () => number
): string | null {
  const charDef = CHARACTERS[claimedCharacter];
  if (!charDef.requiresTarget) {
    return null;
  }

  const opponents = projectedState.players.filter((p) => p.id !== myPlayerId);
  if (opponents.length === 0) return null;

  // تجنب الخصوم المحميين بـ«السند» في المستوى المتوسط والصعب إن وجد غيرهم
  const unshielded = opponents.filter((p) => !p.hasSanadShield);
  const pool =
    difficulty !== 'easy' && unshielded.length > 0 ? unshielded : opponents;

  const withCards = pool.filter((p) => p.cardCount > 0);
  const candidates = withCards.length > 0 ? withCards : pool;

  if (difficulty === 'hard' || difficulty === 'medium') {
    if (claimedCharacter === 'alkabeer') {
      // استهداف اللاعب صاحب أقل عدد من البطاقات لإبعاده عن الفوز!
      const sorted = [...candidates].sort((a, b) => a.cardCount - b.cardCount);
      return sorted[0].id;
    }
    if (claimedCharacter === 'nashal' || claimedCharacter === 'malqoof') {
      const sorted = [...candidates].sort((a, b) => a.cardCount - b.cardCount);
      return sorted[0].id;
    }
  }

  return candidates[Math.floor(rng() * candidates.length)].id;
}

/**
 * قرار البوت: هل يضغط زر «صادوه!» لتحدي اللاعب الحالي؟
 * يعتمد فقط على المعلومات العامة القانونية وذاكرة البوت القانونية (`BotLegalMemory`).
 */
export function decideBotChallenge(
  projectedState: ClientProjectedGameState,
  memory: BotLegalMemory | undefined,
  difficulty: BotDifficulty = 'medium',
  rng: () => number = Math.random
): boolean {
  const pending = projectedState.pendingClaimPublic;
  if (!pending || pending.playerId === projectedState.viewerPlayerId) {
    return false;
  }

  const activePlayerPublic = projectedState.players.find(
    (p) => p.id === pending.playerId
  );
  if (!activePlayerPublic) return false;

  // 1) استنتاج قانوني ذكي: إذا كان البوت قد كشف سابقًا بـ«الملقوف» بطاقة اللاعب الوحيدة ويعرف أنها تختلف عن الادعاء!
  if (memory && difficulty !== 'easy') {
    const knownForPlayer = memory.knownOpponentCards.filter(
      (k) => k.playerId === pending.playerId
    );
    // إذا كان لدى اللاعب بطاقة واحدة فقط قبل الحركة (أي 0 الآن) وكنا نعرف تلك البطاقة الوحيدة وهي لا تطابق الادعاء
    if (activePlayerPublic.cardCount === 0 && knownForPlayer.length === 1) {
      if (knownForPlayer[0].characterId !== pending.claimedCharacter) {
        return true; // صيدة مضمونة قانونيًا!
      } else {
        return false; // نعلم قانونيًا أنه صادق!
      }
    }
  }

  // 2) إذا كان اللاعب على وشك الفوز (cardCount === 0 بعد وضع البطاقة المقلوبة):
  // في المستوى المتوسط والصعب، تزداد رغبة الخصوم في تحديه لمنعه من الفوز السهل بالكذب!
  if (activePlayerPublic.cardCount === 0) {
    const lastCardChallengeProb =
      difficulty === 'easy' ? 0.25 : difficulty === 'medium' ? 0.45 : 0.6;
    return rng() < lastCardChallengeProb;
  }

  // 3) حساب احتمالية التحدي بناءً على سمعة اللاعب المعلنة (كم مرة انقفط يكذب سابقًا) ونوع الشخصية المعلنة
  const caughtCount = memory?.caughtLyingCount[pending.playerId] ?? 0;
  const highValueClaim =
    pending.claimedCharacter === 'mosarref' ||
    pending.claimedCharacter === 'alkabeer';
  const targetsMe = pending.targetPlayerId === projectedState.viewerPlayerId;

  let baseProb =
    difficulty === 'easy' ? 0.14 : difficulty === 'medium' ? 0.18 : 0.22;

  if (highValueClaim) baseProb += 0.08;
  if (targetsMe) baseProb += 0.1;
  if (caughtCount > 0 && difficulty !== 'easy') {
    baseProb += Math.min(0.2, caughtCount * 0.08);
  }

  return rng() < baseProb;
}
