import {pickBotNames} from '../bots/names';
import {
  BotDifficulty,
  BotLegalMemory,
  CardInstance,
  ChallengeOutcome,
  CharacterId,
  GameLogEntry,
  GameState,
  MoveSubmission,
  PlayerState,
} from '../../types/game';
import { ALL_CHARACTER_IDS, CHARACTERS } from '../rules/characters';
import {
  CHALLENGE_TIMER_SECONDS,
  createBalancedDeck,
  drawOneCardSafely,
  INITIAL_HAND_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MOVE_TIMER_SECONDS,
} from '../rules/deck';
import { getValidTargetPlayers, validateMoveSubmission } from '../rules/validators';

export interface CreateMatchOptions {
  matchId?: string;
  mode?: 'singleplayer' | 'tutorial' | 'multiplayer_preview' | 'multiplayer';
  humanPlayerName: string;
  botCount: number; // 2..7 (ليكون المجموع 3..8 لاعبين)
  botDifficulty: BotDifficulty;
  rng?: () => number;
  customPlayers?: PlayerState[];
  customDrawPile?: CardInstance[];
}

const BOT_AVATARS=['abu-fahad','alkabeer','malqoof','nashal','sanad','mosarref','mokhabbes'];

const FUNNY_CAUGHT_QUOTES = [
  'قفطناك يا وحش! الكذبة ما مشيت هالمرة!',
  'صادوه بالرادار! وين تبي تروح بالكذبة؟',
  'عيونك فضحتك قبل بطاقتك!',
  'هاه؟ قلنا لك الاستراحة ما يمشي فيها التلفيق!',
];

const FUNNY_WRONG_CHALLENGE_QUOTES = [
  'يا ساتر! طلع صادق وأكلت العقوبة!',
  'لا تستعجل، فكر قبل تتهم! الرجال طلع على نياته!',
  'شكيت في غير محله.. اسحب بطاقة وروق المنقا!',
  'الظليمة شينة! البطاقة طلعت صحيحة 100%!',
];

const FUNNY_NO_CHALLENGE_QUOTES = [
  'عدّت سلامات! محد تجرأ يضغط صادوه!',
  'مشيت عليهم مثل الحلاوة!',
  'هيبة في الجلسة.. الكل صدّق ومشت الحركة!',
];

function createLog(
  turnNumber: number,
  messageAr: string,
  type: GameLogEntry['type']
): GameLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    turnNumber,
    messageAr,
    type,
  };
}

/**
 * إنشاء مباراة جديدة وفق القواعد القياسية (3 إلى 8 لاعبين، 4 بطاقات لكل لاعب)
 */
export function createMatch(options: CreateMatchOptions): GameState {
  const rng = options.rng ?? Math.random;
  const clampedBots = Math.max(
    MIN_PLAYERS - 1,
    Math.min(MAX_PLAYERS - 1, options.botCount)
  );

  let deck = options.customDrawPile
    ? [...options.customDrawPile]
    : createBalancedDeck(8, rng);

  let players: PlayerState[];

  if (options.customPlayers && options.customPlayers.length >= MIN_PLAYERS) {
    players = options.customPlayers.map((p) => ({
      ...p,
      hand: [...p.hand],
    }));
  } else {
    players = [];
    const humanHand = deck.slice(0, INITIAL_HAND_SIZE);
    deck = deck.slice(INITIAL_HAND_SIZE);

    players.push({
      id: 'player_human',
      name: options.humanPlayerName.trim() || 'أنت',
      isBot: false,
      avatarAsset: './assets/sanad.svg',
      hand: humanHand,
      hasSanadShield: false,
      isConnected: true,
    });

    const names=pickBotNames(clampedBots,rng,[options.humanPlayerName.trim()]);
    for (let i = 0; i < clampedBots; i++) {
      const profile = {name:names[i],avatar:`./assets/${BOT_AVATARS[i % BOT_AVATARS.length]}.svg`};
      const botHand = deck.slice(0, INITIAL_HAND_SIZE);
      deck = deck.slice(INITIAL_HAND_SIZE);
      players.push({
        id: `player_bot_${i + 1}`,
        name: profile.name,
        isBot: true,
        botDifficulty: options.botDifficulty,
        avatarAsset: profile.avatar,
        hand: botHand,
        hasSanadShield: false,
        isConnected: true,
      });
    }
  }

  const botMemories: Record<string, BotLegalMemory> = {};
  const emptiedByMainPlayMap: Record<string, boolean> = {};

  for (const p of players) {
    emptiedByMainPlayMap[p.id] = false;
    if (p.isBot) {
      botMemories[p.id] = {
        botId: p.id,
        knownOpponentCards: [],
        observedClaimsCount: {},
        caughtLyingCount: {},
      };
    }
  }

  return {
    matchId: options.matchId ?? `match_${Date.now()}`,
    mode: options.mode ?? 'singleplayer',
    players,
    drawPile: deck,
    discardPile: [],
    currentPlayerIndex: 0,
    turnNumber: 1,
    phase: 'CHOOSING_MOVE',
    turnTimerSeconds: MOVE_TIMER_SECONDS,
    pendingClaim: null,
    lastOutcome: null,
    winnerPlayerId: null,
    logs: [
      createLog(
        1,
        `بدأت الجلسة في الاستراحة! وُزّعت 4 بطاقات لكل لاعب (${players.length} لاعبين).`,
        'system'
      ),
    ],
    chatMessages: [],
    botMemories,
    emptiedByMainPlayMap,
  };
}

/**
 * تنفيذ حركة اللاعب (وضع البطاقة مقلوبة وإعلان الشخصية والهدف)
 */
export function submitPlayerMove(
  state: GameState,
  submission: MoveSubmission
): { nextState: GameState; errorAr?: string } {
  const validation = validateMoveSubmission(state, submission);
  if (!validation.valid) {
    return { nextState: state, errorAr: validation.reasonAr };
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  const cardIndex = activePlayer.hand.findIndex((c) => c.id === submission.cardId);
  const playedCard = activePlayer.hand[cardIndex];
  const wasLastCardMainPlay = activePlayer.hand.length === 1;

  const updatedHand = activePlayer.hand.filter((_, idx) => idx !== cardIndex);
  const updatedPlayers = state.players.map((p, idx) =>
    idx === state.currentPlayerIndex ? { ...p, hand: updatedHand } : p
  );

  const charDef = CHARACTERS[submission.claimedCharacter];
  const targetPlayer = submission.targetPlayerId
    ? state.players.find((p) => p.id === submission.targetPlayerId) ?? null
    : null;

  const nextEmptiedMap = {
    ...state.emptiedByMainPlayMap,
    [activePlayer.id]: wasLastCardMainPlay && updatedHand.length === 0,
  };

  // تحديث ذاكرة الخصوم الآليين بعدد مرات الادعاء (معلومة عامة قانونية)
  const nextBotMemories: Record<string, BotLegalMemory> = {};
  for (const [botId, mem] of Object.entries(state.botMemories)) {
    // إذا لعب اللاعب بطاقة كان البوت يعرفها مسبقًا، لا نكشفها للبوت إلا إذا تحدّى، لكن نحدث عدد الادعاءات العام
    nextBotMemories[botId] = {
      ...mem,
      observedClaimsCount: {
        ...mem.observedClaimsCount,
        [activePlayer.id]: (mem.observedClaimsCount[activePlayer.id] ?? 0) + 1,
      },
    };
  }

  const claimLogText = targetPlayer
    ? `وضع «${activePlayer.name}» بطاقة مقلوبة وادّعى شخصية «${charDef.nameAr}» مستهدفًا «${targetPlayer.name}»!`
    : `وضع «${activePlayer.name}» بطاقة مقلوبة وادّعى شخصية «${charDef.nameAr}»!`;

  return {
    nextState: {
      ...state,
      players: updatedPlayers,
      phase: 'CHALLENGE_WINDOW',
      turnTimerSeconds: CHALLENGE_TIMER_SECONDS,
      pendingClaim: {
        playerId: activePlayer.id,
        playedCard,
        claimedCharacter: submission.claimedCharacter,
        targetPlayerId: targetPlayer ? targetPlayer.id : null,
        secondaryCardId: submission.secondaryCardId ?? null,
        wasLastCardMainPlay,
      },
      lastOutcome: null,
      emptiedByMainPlayMap: nextEmptiedMap,
      botMemories: nextBotMemories,
      logs: [createLog(state.turnNumber, claimLogText, 'move'), ...state.logs],
    },
  };
}

/**
 * تنفيذ حركة قانونية تلقائية عند انتهاء عداد الـ 15 ثانية لاختيار الحركة
 */
export function executeAutoTimeoutMove(
  state: GameState,
  rng: () => number = Math.random
): GameState {
  if (state.phase !== 'CHOOSING_MOVE') {
    return state;
  }

  let workingState = state;
  let activePlayer = workingState.players[workingState.currentPlayerIndex];

  // حماية إضافية: إذا كانت يد اللاعب فارغة في بداية دوره بسبب قدرة خصم سابقة، يسحب بطاقة أولًا
  if (activePlayer.hand.length === 0) {
    const drawRes = drawOneCardSafely(workingState.drawPile, workingState.discardPile, rng);
    if (drawRes.card) {
      const updatedPlayers = workingState.players.map((p, idx) =>
        idx === workingState.currentPlayerIndex
          ? { ...p, hand: [drawRes.card!] }
          : p
      );
      workingState = {
        ...workingState,
        players: updatedPlayers,
        drawPile: drawRes.nextDrawPile,
        discardPile: drawRes.nextDiscardPile,
      };
      activePlayer = workingState.players[workingState.currentPlayerIndex];
    } else {
      return advanceToNextTurn(workingState, rng);
    }
  }

  const chosenCard = activePlayer.hand[Math.floor(rng() * activePlayer.hand.length)];
  const claimedCharacter: CharacterId = chosenCard.characterId;
  const validTargets = getValidTargetPlayers(
    workingState,
    activePlayer.id,
    claimedCharacter
  );
  const targetPlayerId =
    validTargets.length > 0
      ? validTargets[Math.floor(rng() * validTargets.length)].id
      : null;

  const timeoutLog = createLog(
    workingState.turnNumber,
    `انتهى وقت الاختيار لـ«${activePlayer.name}» — نفّذ المحرك حركة قانونية تلقائية.`,
    'system'
  );

  const res = submitPlayerMove(
    {
      ...workingState,
      logs: [timeoutLog, ...workingState.logs],
    },
    {
      playerId: activePlayer.id,
      cardId: chosenCard.id,
      claimedCharacter,
      targetPlayerId,
    }
  );

  return res.nextState;
}

/**
 * تنفيذ قدرة الشخصية المعلنة بشكل حتمي بعد نجاح الحركة (عدم وجود تحدٍّ أو صدق اللاعب عند التحدي)
 */
function executeCharacterAbility(
  state: GameState,
  pendingClaim: NonNullable<GameState['pendingClaim']>,
  rng: () => number
): {
  players: PlayerState[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  emptiedByMainPlayMap: Record<string, boolean>;
  botMemories: Record<string, BotLegalMemory>;
  abilityExecuted: boolean;
  blockedBySanad: boolean;
  abilitySummaryAr: string;
  privateReveal: ChallengeOutcome['privateReveal'];
  extraLogs: GameLogEntry[];
} {
  const players = state.players.map((p) => ({ ...p, hand: [...p.hand] }));
  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile];
  const emptiedByMainPlayMap = { ...state.emptiedByMainPlayMap };
  const botMemories: Record<string, BotLegalMemory> = {};
  for (const [k, v] of Object.entries(state.botMemories)) {
    botMemories[k] = {
      ...v,
      knownOpponentCards: [...v.knownOpponentCards],
    };
  }
  const extraLogs: GameLogEntry[] = [];

  const activePlayer = players.find((p) => p.id === pendingClaim.playerId)!;
  const targetPlayer = pendingClaim.targetPlayerId
    ? players.find((p) => p.id === pendingClaim.targetPlayerId) ?? null
    : null;
  const charDef = CHARACTERS[pendingClaim.claimedCharacter];

  // فحص درع «السند» التلقائي إذا كانت القدرة تستهدف خصمًا
  if (charDef.requiresTarget && targetPlayer && targetPlayer.id !== activePlayer.id) {
    if (targetPlayer.hasSanadShield) {
      targetPlayer.hasSanadShield = false;
      const msg = `تدخّل «السند»! حَمى «${targetPlayer.name}» نفسه تلقائيًا من قدرة «${charDef.nameAr}» واستُهلك الدرع.`;
      extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
      return {
        players,
        drawPile,
        discardPile,
        emptiedByMainPlayMap,
        botMemories,
        abilityExecuted: false,
        blockedBySanad: true,
        abilitySummaryAr: msg,
        privateReveal: null,
        extraLogs,
      };
    }
  }

  switch (pendingClaim.claimedCharacter) {
    case 'sanad': {
      const alreadyActive = activePlayer.hasSanadShield;
      activePlayer.hasSanadShield = true;
      const msg = alreadyActive
        ? `جدّد «${activePlayer.name}» حماية «السند» ضد أول قدرة تستهدفه حتى دوره القادم.`
        : `فعّل «${activePlayer.name}» حماية «السند» ضد أول قدرة تستهدفه حتى دوره القادم!`;
      extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
      return {
        players,
        drawPile,
        discardPile,
        emptiedByMainPlayMap,
        botMemories,
        abilityExecuted: true,
        blockedBySanad: false,
        abilitySummaryAr: msg,
        privateReveal: null,
        extraLogs,
      };
    }

    case 'mosarref': {
      // قاعدة المصرّف:
      // 1) إذا لم تكن هناك بطاقة إضافية للمصرّف (يد اللاعب = 0 بعد لعب بطاقته الأساسية الأخيرة)، تنتهي القدرة دون تأثير ويفوز اللاعب ببطاقته الأساسية.
      // 2) المصرّف لا يستطيع تحقيق الفوز باستخدام البطاقة الإضافية وحدها؛ يجب أن تكون البطاقة الأخيرة هي البطاقة الأساسية.
      if (activePlayer.hand.length === 0) {
        const msg = `لعب «${activePlayer.name}» بطاقته الأخيرة مع «المصرّف» — لا توجد بطاقة إضافية للتخلص منها.`;
        extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
        return {
          players,
          drawPile,
          discardPile,
          emptiedByMainPlayMap,
          botMemories,
          abilityExecuted: false,
          blockedBySanad: false,
          abilitySummaryAr: msg,
          privateReveal: null,
          extraLogs,
        };
      }

      if (activePlayer.hand.length === 1) {
        // منع التخلص من البطاقة الأخيرة عبر قدرة المصرّف الإضافية حتى لا تنتهي المباراة بالبطاقة الإضافية
        emptiedByMainPlayMap[activePlayer.id] = false;
        const msg = `بقيت بطاقة أخيرة فقط في يد «${activePlayer.name}» — وفق القواعد لا يمكن إنهاء المباراة بالبطاقة الإضافية لـ«المصرّف»!`;
        extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
        return {
          players,
          drawPile,
          discardPile,
          emptiedByMainPlayMap,
          botMemories,
          abilityExecuted: false,
          blockedBySanad: false,
          abilitySummaryAr: msg,
          privateReveal: null,
          extraLogs,
        };
      }

      // لدى اللاعب بطاقتان أو أكثر بعد وضع البطاقة الأساسية: يتخلص من بطاقة إضافية ويبقى لديه بطاقة واحدة على الأقل
      let discardIdx = 0;
      if (pendingClaim.secondaryCardId) {
        const foundIdx = activePlayer.hand.findIndex(
          (c) => c.id === pendingClaim.secondaryCardId
        );
        if (foundIdx !== -1) {
          discardIdx = foundIdx;
        }
      } else {
        discardIdx = Math.floor(rng() * activePlayer.hand.length);
      }

      const [extraDiscarded] = activePlayer.hand.splice(discardIdx, 1);
      discardPile.push(extraDiscarded);
      emptiedByMainPlayMap[activePlayer.id] = false;

      const msg = `استخدم «${activePlayer.name}» قدرة «المصرّف» وتخلّص من بطاقة إضافية من يده!`;
      extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
      return {
        players,
        drawPile,
        discardPile,
        emptiedByMainPlayMap,
        botMemories,
        abilityExecuted: true,
        blockedBySanad: false,
        abilitySummaryAr: msg,
        privateReveal: null,
        extraLogs,
      };
    }

    case 'malqoof': {
      if (!targetPlayer || targetPlayer.hand.length === 0) {
        const msg = `تعذّر تنفيذ قدرة «الملقوف» لعدم وجود بطاقات في يد الهدف.`;
        extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
        return {
          players,
          drawPile,
          discardPile,
          emptiedByMainPlayMap,
          botMemories,
          abilityExecuted: false,
          blockedBySanad: false,
          abilitySummaryAr: msg,
          privateReveal: null,
          extraLogs,
        };
      }

      const randomIdx = Math.floor(rng() * targetPlayer.hand.length);
      const peekedCard = targetPlayer.hand[randomIdx];

      // إذا كان مستخدم القدرة بوتًا، يحفظ البطاقة المكشوفة في ذاكرته القانونية فقط
      if (activePlayer.isBot && botMemories[activePlayer.id]) {
        botMemories[activePlayer.id].knownOpponentCards.push({
          playerId: targetPlayer.id,
          cardId: peekedCard.id,
          characterId: peekedCard.characterId,
          discoveredAtTurn: state.turnNumber,
        });
      }

      const msg = `استخدم «${activePlayer.name}» قدرة «الملقوف» وكشف لنفسه سرًا بطاقة من يد «${targetPlayer.name}»!`;
      extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
      return {
        players,
        drawPile,
        discardPile,
        emptiedByMainPlayMap,
        botMemories,
        abilityExecuted: true,
        blockedBySanad: false,
        abilitySummaryAr: msg,
        privateReveal: {
          viewerPlayerId: activePlayer.id,
          targetPlayerId: targetPlayer.id,
          revealedCard: peekedCard,
        },
        extraLogs,
      };
    }

    case 'nashal': {
      if (!targetPlayer || targetPlayer.hand.length === 0) {
        const msg = `تعذّر تنفيذ قدرة «النشّال» لأن يد الهدف فارغة.`;
        extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
        return {
          players,
          drawPile,
          discardPile,
          emptiedByMainPlayMap,
          botMemories,
          abilityExecuted: false,
          blockedBySanad: false,
          abilitySummaryAr: msg,
          privateReveal: null,
          extraLogs,
        };
      }

      const stealIdx = Math.floor(rng() * targetPlayer.hand.length);
      const [stolenCard] = targetPlayer.hand.splice(stealIdx, 1);

      // إذا أصبح الخصم المستهدف بلا بطاقات بسبب النشّال، فإنه لا يفوز خارج دوره!
      if (targetPlayer.hand.length === 0) {
        emptiedByMainPlayMap[targetPlayer.id] = false;
      }

      if (pendingClaim.wasLastCardMainPlay && activePlayer.hand.length === 0) {
        // إذا لعب اللاعب بطاقته الأخيرة كحركة أساسية، تُستبعد البطاقة المسحوبة إلى الكومة المستخدمة حتى لا تمنعه من الفوز القانوني بآخر بطاقة
        discardPile.push(stolenCard);
      } else {
        activePlayer.hand.push(stolenCard);
        emptiedByMainPlayMap[activePlayer.id] = false;
      }

      const msg =
        targetPlayer.hand.length === 0
          ? `سحب «${activePlayer.name}» آخر بطاقة من يد «${targetPlayer.name}» بقدرة «النشّال»! (إفراغ اليد بقدرة خصم لا يمنح فوزًا خارج الدور).`
          : `سحب «${activePlayer.name}» بطاقة عشوائية من يد «${targetPlayer.name}» بقدرة «النشّال»!`;
      extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
      return {
        players,
        drawPile,
        discardPile,
        emptiedByMainPlayMap,
        botMemories,
        abilityExecuted: true,
        blockedBySanad: false,
        abilitySummaryAr: msg,
        privateReveal: null,
        extraLogs,
      };
    }

    case 'mokhabbes': {
      if (
        !targetPlayer ||
        targetPlayer.hand.length === 0 ||
        activePlayer.hand.length === 0
      ) {
        const msg = `تعذّر تنفيذ قدرة «المخبّص» لعدم وجود بطاقات كافية للتبديل بين اللاعبين.`;
        extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
        return {
          players,
          drawPile,
          discardPile,
          emptiedByMainPlayMap,
          botMemories,
          abilityExecuted: false,
          blockedBySanad: false,
          abilitySummaryAr: msg,
          privateReveal: null,
          extraLogs,
        };
      }

      let mySwapIdx = 0;
      if (pendingClaim.secondaryCardId) {
        const idx = activePlayer.hand.findIndex(
          (c) => c.id === pendingClaim.secondaryCardId
        );
        if (idx !== -1) mySwapIdx = idx;
      } else {
        mySwapIdx = Math.floor(rng() * activePlayer.hand.length);
      }

      const targetSwapIdx = Math.floor(rng() * targetPlayer.hand.length);
      const myGivenCard = activePlayer.hand[mySwapIdx];
      const targetGivenCard = targetPlayer.hand[targetSwapIdx];

      activePlayer.hand[mySwapIdx] = targetGivenCard;
      targetPlayer.hand[targetSwapIdx] = myGivenCard;

      // إذا كان الفاعل بوتًا، فإنه يعرف البطاقة التي أعطاها للهدف بطريقة قانونية
      if (activePlayer.isBot && botMemories[activePlayer.id]) {
        botMemories[activePlayer.id].knownOpponentCards.push({
          playerId: targetPlayer.id,
          cardId: myGivenCard.id,
          characterId: myGivenCard.characterId,
          discoveredAtTurn: state.turnNumber,
        });
      }

      const msg = `بدّل «${activePlayer.name}» بطاقة من يده ببطاقة عشوائية من يد «${targetPlayer.name}» بقدرة «المخبّص»!`;
      extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
      return {
        players,
        drawPile,
        discardPile,
        emptiedByMainPlayMap,
        botMemories,
        abilityExecuted: true,
        blockedBySanad: false,
        abilitySummaryAr: msg,
        privateReveal: null,
        extraLogs,
      };
    }

    case 'alkabeer': {
      if (!targetPlayer) {
        const msg = `تعذّر تنفيذ قدرة «الكبير» لعدم وجود هدف صالح.`;
        extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
        return {
          players,
          drawPile,
          discardPile,
          emptiedByMainPlayMap,
          botMemories,
          abilityExecuted: false,
          blockedBySanad: false,
          abilitySummaryAr: msg,
          privateReveal: null,
          extraLogs,
        };
      }

      const drawRes = drawOneCardSafely(drawPile, discardPile, rng);
      drawPile = drawRes.nextDrawPile;
      discardPile = drawRes.nextDiscardPile;

      if (drawRes.reshuffled) {
        extraLogs.push(
          createLog(
            state.turnNumber,
            'أُعيد خلط البطاقات المستخدمة لتكوين كومة سحب جديدة دون كشفها.',
            'system'
          )
        );
      }

      if (!drawRes.card) {
        const msg = `حاول «الكبير» إلزام «${targetPlayer.name}» بالسحب، لكن جميع البطاقات موزعة حاليًا!`;
        extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
        return {
          players,
          drawPile,
          discardPile,
          emptiedByMainPlayMap,
          botMemories,
          abilityExecuted: false,
          blockedBySanad: false,
          abilitySummaryAr: msg,
          privateReveal: null,
          extraLogs,
        };
      }

      targetPlayer.hand.push(drawRes.card);
      emptiedByMainPlayMap[targetPlayer.id] = false;

      const msg = `أمر «الكبير» اللاعب «${targetPlayer.name}» بسحب بطاقة من الكومة!`;
      extraLogs.push(createLog(state.turnNumber, msg, 'ability'));
      return {
        players,
        drawPile,
        discardPile,
        emptiedByMainPlayMap,
        botMemories,
        abilityExecuted: true,
        blockedBySanad: false,
        abilitySummaryAr: msg,
        privateReveal: null,
        extraLogs,
      };
    }
  }
}

/**
 * تسوية نافذة التحدي (سواء ضغط أحد الخصوم «صادوه!» أو انتهى عداد الـ 5 ثوانٍ دون تحدٍّ)
 * إذا تعدد المتحدون، يعتمد أول تحدٍّ صالح فقط.
 */
export function resolveChallengeWindow(
  state: GameState,
  challengerId: string | null,
  rng: () => number = Math.random
): GameState {
  if (state.phase !== 'CHALLENGE_WINDOW' || !state.pendingClaim) {
    return state;
  }

  const pending = state.pendingClaim;
  const activePlayer = state.players.find((p) => p.id === pending.playerId)!;
  const validChallenger =
    challengerId && challengerId !== activePlayer.id
      ? state.players.find((p) => p.id === challengerId) ?? null
      : null;

  // البطاقة التي لُعبت تنتقل إلى كومة البطاقات المستخدمة
  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile, pending.playedCard];
  let players = state.players.map((p) => ({ ...p, hand: [...p.hand] }));
  let emptiedByMainPlayMap = { ...state.emptiedByMainPlayMap };
  let botMemories: Record<string, BotLegalMemory> = {};
  for (const [k, v] of Object.entries(state.botMemories)) {
    botMemories[k] = {
      ...v,
      knownOpponentCards: v.knownOpponentCards.filter(
        (kc) => kc.cardId !== pending.playedCard.id
      ),
      caughtLyingCount: { ...v.caughtLyingCount },
    };
  }
  const newLogs: GameLogEntry[] = [];

  let outcome: ChallengeOutcome;

  if (!validChallenger) {
    // لم يتحدَّ أحد: تظل هوية البطاقة الحقيقية سرية عن الآخرين وتنفذ قدرة الشخصية المعلنة
    const abilityRes = executeCharacterAbility(
      {
        ...state,
        players,
        drawPile,
        discardPile,
        emptiedByMainPlayMap,
        botMemories,
      },
      pending,
      rng
    );

    players = abilityRes.players;
    drawPile = abilityRes.drawPile;
    discardPile = abilityRes.discardPile;
    emptiedByMainPlayMap = abilityRes.emptiedByMainPlayMap;
    botMemories = abilityRes.botMemories;
    newLogs.push(...abilityRes.extraLogs);

    const quote =
      FUNNY_NO_CHALLENGE_QUOTES[
        Math.floor(rng() * FUNNY_NO_CHALLENGE_QUOTES.length)
      ];
    const summaryAr = `لم يتحدَّ أحد «${activePlayer.name}»! بقيت البطاقة سرية. ${abilityRes.abilitySummaryAr}`;

    outcome = {
      challenged: false,
      challengerId: null,
      wasTruthful: null,
      revealedCard: null, // سرية!
      penaltyPlayerId: null,
      penaltyCardDrawn: false,
      abilityExecuted: abilityRes.abilityExecuted,
      blockedBySanad: abilityRes.blockedBySanad,
      summaryAr,
      funnyQuoteAr: quote,
      privateReveal: abilityRes.privateReveal,
    };
  } else {
    // وقع تحدي «صادوه!»: تنكشف البطاقة الحقيقية
    const wasTruthful =
      pending.playedCard.characterId === pending.claimedCharacter;
    const trueCharDef = CHARACTERS[pending.playedCard.characterId];
    const claimedCharDef = CHARACTERS[pending.claimedCharacter];

    if (!wasTruthful) {
      // اللاعب كاذب: تُلغى القدرة ويسحب اللاعب الكاذب بطاقة عقوبة واحدة فقط
      const penaltyDraw = drawOneCardSafely(drawPile, discardPile, rng);
      drawPile = penaltyDraw.nextDrawPile;
      discardPile = penaltyDraw.nextDiscardPile;

      if (penaltyDraw.reshuffled) {
        newLogs.push(
          createLog(
            state.turnNumber,
            'أُعيد خلط البطاقات المستخدمة لتكوين كومة سحب جديدة دون كشفها.',
            'system'
          )
        );
      }

      const liarPlayer = players.find((p) => p.id === activePlayer.id)!;
      if (penaltyDraw.card) {
        liarPlayer.hand.push(penaltyDraw.card);
      }
      // حتى لو كان قد لعب آخر بطاقة، فإنه خسر التحدي فلا يفوز!
      emptiedByMainPlayMap[activePlayer.id] = false;

      for (const mem of Object.values(botMemories)) {
        mem.caughtLyingCount[activePlayer.id] =
          (mem.caughtLyingCount[activePlayer.id] ?? 0) + 1;
      }

      const quote =
        FUNNY_CAUGHT_QUOTES[Math.floor(rng() * FUNNY_CAUGHT_QUOTES.length)];
      const summaryAr = `صادوه! «${validChallenger.name}» كشف كذبة «${activePlayer.name}»! البطاقة الحقيقية كانت «${trueCharDef.nameAr}» وليست «${claimedCharDef.nameAr}». أُلغيت القدرة وسحب «${activePlayer.name}» بطاقة عقوبة!`;

      newLogs.push(createLog(state.turnNumber, summaryAr, 'challenge'));

      outcome = {
        challenged: true,
        challengerId: validChallenger.id,
        wasTruthful: false,
        revealedCard: pending.playedCard,
        penaltyPlayerId: activePlayer.id,
        penaltyCardDrawn: Boolean(penaltyDraw.card),
        abilityExecuted: false,
        blockedBySanad: false,
        summaryAr,
        funnyQuoteAr: quote,
        privateReveal: null,
      };
    } else {
      // اللاعب صادق: تُنفذ القدرة ويسحب المتحدي بطاقة عقوبة واحدة فقط
      const penaltyDraw = drawOneCardSafely(drawPile, discardPile, rng);
      drawPile = penaltyDraw.nextDrawPile;
      discardPile = penaltyDraw.nextDiscardPile;

      if (penaltyDraw.reshuffled) {
        newLogs.push(
          createLog(
            state.turnNumber,
            'أُعيد خلط البطاقات المستخدمة لتكوين كومة سحب جديدة دون كشفها.',
            'system'
          )
        );
      }

      const challengerObj = players.find((p) => p.id === validChallenger.id)!;
      if (penaltyDraw.card) {
        challengerObj.hand.push(penaltyDraw.card);
        emptiedByMainPlayMap[challengerObj.id] = false;
      }

      const challengeLog = `تحدّى «${validChallenger.name}» اللاعب «${activePlayer.name}» بـ«صادوه!» لكن البطاقة طلعت «${trueCharDef.nameAr}» فعلًا! سحب «${validChallenger.name}» بطاقة عقوبة.`;
      newLogs.push(createLog(state.turnNumber, challengeLog, 'challenge'));

      // تنفيذ القدرة بعد إثبات الصدق
      const abilityRes = executeCharacterAbility(
        {
          ...state,
          players,
          drawPile,
          discardPile,
          emptiedByMainPlayMap,
          botMemories,
        },
        pending,
        rng
      );

      players = abilityRes.players;
      drawPile = abilityRes.drawPile;
      discardPile = abilityRes.discardPile;
      emptiedByMainPlayMap = abilityRes.emptiedByMainPlayMap;
      botMemories = abilityRes.botMemories;
      newLogs.push(...abilityRes.extraLogs);

      const quote =
        FUNNY_WRONG_CHALLENGE_QUOTES[
          Math.floor(rng() * FUNNY_WRONG_CHALLENGE_QUOTES.length)
        ];
      const summaryAr = `${challengeLog} ${abilityRes.abilitySummaryAr}`;

      outcome = {
        challenged: true,
        challengerId: validChallenger.id,
        wasTruthful: true,
        revealedCard: pending.playedCard,
        penaltyPlayerId: validChallenger.id,
        penaltyCardDrawn: Boolean(penaltyDraw.card),
        abilityExecuted: abilityRes.abilityExecuted,
        blockedBySanad: abilityRes.blockedBySanad,
        summaryAr,
        funnyQuoteAr: quote,
        privateReveal: abilityRes.privateReveal,
      };
    }
  }

  // التحقق من شروط الفوز بعد تسوية الحركة بالكامل:
  // الفوز يتحقق فقط للاعب صاحب الدور الأساسي إذا أفرغ يده بالبطاقة الأساسية بصورة قانونية
  const updatedActivePlayer = players.find((p) => p.id === activePlayer.id)!;
  let winnerPlayerId: string | null = null;
  let nextPhase: GameState['phase'] = 'RESOLVING_CHALLENGE';

  if (
    updatedActivePlayer.hand.length === 0 &&
    emptiedByMainPlayMap[activePlayer.id] === true &&
    pending.wasLastCardMainPlay
  ) {
    winnerPlayerId = activePlayer.id;
    nextPhase = 'GAME_OVER';
    newLogs.unshift(
      createLog(
        state.turnNumber,
        `فاز «${updatedActivePlayer.name}» بالمباراة بعد التخلص من جميع بطاقاته بصورة قانونية!`,
        'win'
      )
    );
  }

  return {
    ...state,
    players,
    drawPile,
    discardPile,
    phase: nextPhase,
    turnTimerSeconds: 0,
    lastOutcome: outcome,
    winnerPlayerId,
    emptiedByMainPlayMap,
    botMemories,
    logs: [...newLogs.reverse(), ...state.logs],
  };
}

/**
 * الانتقال إلى دور اللاعب التالي بعد عرض نتيجة الجولة الحالية
 */
export function advanceToNextTurn(
  state: GameState,
  rng: () => number = Math.random
): GameState {
  if (state.phase === 'GAME_OVER' || state.winnerPlayerId) {
    return state;
  }

  const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  const nextTurnNumber = state.turnNumber + 1;
  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile];
  const newLogs: GameLogEntry[] = [];

  const players = state.players.map((p, idx) => {
    if (idx !== nextPlayerIndex) return p;
    // تنتهي صلاحية درع «السند» عند بداية الدور القادم لصاحبه («حتى دورك القادم»)
    return {
      ...p,
      hasSanadShield: false,
      hand: [...p.hand],
    };
  });

  const nextActivePlayer = players[nextPlayerIndex];
  const emptiedByMainPlayMap = { ...state.emptiedByMainPlayMap };

  // معالجة الحالة الخاصة: إذا أفرغت قدرة خصم (النشّال) يد هذا اللاعب خارج دوره، يسحب بطاقة عند بدء دوره حتى يتمكن من اللعب ولا تتوقف اللعبة
  if (nextActivePlayer.hand.length === 0) {
    const drawRes = drawOneCardSafely(drawPile, discardPile, rng);
    drawPile = drawRes.nextDrawPile;
    discardPile = drawRes.nextDiscardPile;
    if (drawRes.card) {
      nextActivePlayer.hand.push(drawRes.card);
      emptiedByMainPlayMap[nextActivePlayer.id] = false;
      newLogs.push(
        createLog(
          nextTurnNumber,
          `كانت يد «${nextActivePlayer.name}» فارغة بسبب قدرة سابقة خارج دوره، فسحب بطاقة لبدء دوره القانوني.`,
          'system'
        )
      );
    }
  }

  return {
    ...state,
    players,
    drawPile,
    discardPile,
    currentPlayerIndex: nextPlayerIndex,
    turnNumber: nextTurnNumber,
    phase: 'CHOOSING_MOVE',
    turnTimerSeconds: MOVE_TIMER_SECONDS,
    pendingClaim: null,
    lastOutcome: null,
    emptiedByMainPlayMap,
    logs: [...newLogs, ...state.logs],
  };
}

/**
 * مساعد لاختبار جميع الشخصيات الست أو فرض حالة محددة في الاختبارات الآلية
 */
export function getAllCharacterIds(): CharacterId[] {
  return [...ALL_CHARACTER_IDS];
}
