/**
 * معرفات الشخصيات الست في لعبة «صادوه!»
 */
export type CharacterId =
  | 'malqoof'   // الملقوف: اكشف لنفسك بطاقة عشوائية من يد لاعب تختاره.
  | 'nashal'    // النشّال: اسحب بطاقة عشوائية من يد لاعب تختاره.
  | 'sanad'     // السند: احمِ نفسك من أول قدرة تستهدفك حتى دورك القادم.
  | 'mosarref'  // المصرّف: تخلّص من بطاقة إضافية من يدك.
  | 'mokhabbes' // المخبّص: بدّل بطاقة من يدك ببطاقة عشوائية من يد لاعب آخر.
  | 'alkabeer'; // الكبير: اجعل لاعبًا تختاره يسحب بطاقة من الكومة.

export interface CharacterDefinition {
  id: CharacterId;
  nameAr: string;
  descriptionAr: string;
  requiresTarget: boolean;
  assetPath: string;
  accentColor: string;
  badgeTextAr: string;
}

export interface CardInstance {
  id: string;
  characterId: CharacterId;
}

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface PlayerState {
  isPro?:boolean;
  proBadgeColor?:string;
  id: string;
  name: string;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  avatarAsset: string;
  /** البطاقات السرية في يد اللاعب (تُحجب عن الخصوم في الواجهة وفي الشبكة) */
  hand: CardInstance[];
  /** هل يمتلك حماية نشطة من قدرة «السند» حتى دوره القادم؟ */
  hasSanadShield: boolean;
  /** حالة الاتصال (للغرف الجماعية) */
  isConnected: boolean;
  /** هل تم كتم رسائل اللاعب في الشات؟ */
  isMuted?: boolean;
}

/**
 * مراحل الدور داخل المباراة
 */
export type TurnPhase =
  | 'CHOOSING_MOVE'       // عداد 15 ثانية لاختيار البطاقة الحقيقية والشخصية المعلنة والهدف
  | 'CHALLENGE_WINDOW'    // عداد 5 ثوانٍ لإتاحة ضغط زر «صادوه!» للخصوم
  | 'RESOLVING_CHALLENGE' // عرض نتيجة التحدي أو عدم التحدي وتنفيذ التأثير
  | 'GAME_OVER';          // انتهاء المباراة بفوز قانوني لأحد اللاعبين

export interface PendingClaim {
  playerId: string;
  /** البطاقة الحقيقية التي وضعها اللاعب مقلوبة (تبقى سرية إذا لم يتحدَّ أحد) */
  playedCard: CardInstance;
  /** الشخصية التي أعلن اللاعب أنه يلعبها */
  claimedCharacter: CharacterId;
  /** اللاعب المستهدف بالقدرة (إن لزم) */
  targetPlayerId: string | null;
  /** البطاقة الإضافية المختارة للمصرّف أو المخبّص (اختياري، وإلا تُختار تلقائيًا بصورة قانونية) */
  secondaryCardId?: string | null;
  /** هل كان اللاعب يمتلك بطاقة واحدة فقط قبل لعب هذه البطاقة الأساسية؟ */
  wasLastCardMainPlay: boolean;
}

export interface ChallengeOutcome {
  challenged: boolean;
  challengerId: string | null;
  wasTruthful: boolean | null;
  /** البطاقة المكشوفة فقط في حال حدوث تحدٍّ */
  revealedCard: CardInstance | null;
  penaltyPlayerId: string | null;
  penaltyCardDrawn: boolean;
  abilityExecuted: boolean;
  blockedBySanad: boolean;
  summaryAr: string;
  funnyQuoteAr: string;
  /** معلومة خاصة يراها صاحب القدرة فقط (مثل البطاقة المكشوفة بقدرة الملقوف) */
  privateReveal?: {
    viewerPlayerId: string;
    targetPlayerId: string;
    revealedCard: CardInstance;
  } | null;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  turnNumber: number;
  messageAr: string;
  type: 'move' | 'challenge' | 'ability' | 'system' | 'win';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  isQuickReaction?: boolean;
  timestamp: number;
}

/**
 * ذاكرة الخصم الآلي القانونية (لا تحتوي على أي معلومات مخفية لم يكتسبها بطريقة قانونية)
 */
export interface BotLegalMemory {
  botId: string;
  /** البطاقات التي كشفها هذا البوت تحديدًا عبر قدرة «الملقوف» أو التبديل بـ«المخبّص» */
  knownOpponentCards: Array<{
    playerId: string;
    cardId: string;
    characterId: CharacterId;
    discoveredAtTurn: number;
  }>;
  /** سجل ادعاءات اللاعبين السابقة لتقدير احتمالية الكذب في المستوى الصعب */
  observedClaimsCount: Record<string, number>;
  caughtLyingCount: Record<string, number>;
}

/**
 * الحالة الكاملة للمحرك (تعمل على الخادم في Cloudflare Durable Object أو محليًا في طور الفردي)
 */
export interface GameState {
  matchId: string;
  mode: 'singleplayer' | 'tutorial' | 'multiplayer_preview' | 'multiplayer';
  players: PlayerState[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  currentPlayerIndex: number;
  turnNumber: number;
  phase: TurnPhase;
  turnTimerSeconds: number;
  pendingClaim: PendingClaim | null;
  lastOutcome: ChallengeOutcome | null;
  winnerPlayerId: string | null;
  logs: GameLogEntry[];
  chatMessages: ChatMessage[];
  botMemories: Record<string, BotLegalMemory>;
  /** لتتبع كيف أصبحت يد اللاعب فارغة ومنع الفوز خارج الدور أو بالبطاقة الإضافية للمصرّف */
  emptiedByMainPlayMap: Record<string, boolean>;
}

/**
 * الحالة العامة المسموح بعرضها للاعب محدد (تخفي بطاقات الخصوم وبطاقة الطاولة المقلوبة والكومة)
 */
export interface PublicPlayerView {
  isPro?:boolean;
  proBadgeColor?:string;
  id: string;
  name: string;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  avatarAsset: string;
  cardCount: number;
  hasSanadShield: boolean;
  isConnected: boolean;
  isMuted?: boolean;
}

export interface ClientProjectedGameState {
  hasPassedChallenge?: boolean;
  matchId: string;
  viewerPlayerId: string;
  myHand: CardInstance[];
  players: PublicPlayerView[];
  drawPileCount: number;
  discardPileCount: number;
  currentPlayerIndex: number;
  turnNumber: number;
  phase: TurnPhase;
  turnTimerSeconds: number;
  pendingClaimPublic: {
    playerId: string;
    claimedCharacter: CharacterId;
    targetPlayerId: string | null;
    /** لا تتضمن playedCard الحقيقية! */
  } | null;
  lastOutcomePublic: Omit<ChallengeOutcome, 'privateReveal'> & {
    myPrivateReveal: {
      targetPlayerId: string;
      revealedCard: CardInstance;
    } | null;
  } | null;
  winnerPlayerId: string | null;
  logs: GameLogEntry[];
  chatMessages: ChatMessage[];
}

export interface MoveSubmission {
  playerId: string;
  cardId: string;
  claimedCharacter: CharacterId;
  targetPlayerId?: string | null;
  secondaryCardId?: string | null;
}
