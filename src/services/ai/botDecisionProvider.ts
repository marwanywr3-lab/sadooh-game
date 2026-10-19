import {
  BotDifficulty,
  BotLegalMemory,
  CharacterId,
  ClientProjectedGameState,
  MoveSubmission,
} from '../../types/game';
import { decideBotChallenge, decideBotMove } from '../../game/bots/localBotEngine';

/**
 * عقد استدعاء Gemini API المستقبلي عبر Cloudflare Worker (Server-Side Only)
 * لا يتم استدعاء Gemini API من المتصفح ولا يتطلب مفتاح API حاليًا.
 */
export interface GeminiBotDecisionRequest {
  matchId: string;
  botId: string;
  botName: string;
  difficulty: BotDifficulty;
  projectedState: ClientProjectedGameState;
  legalMemory: BotLegalMemory;
}

export interface GeminiBotMoveResponse {
  cardId: string;
  claimedCharacter: CharacterId;
  targetPlayerId: string | null;
  secondaryCardId?: string | null;
  chatLineAr?: string;
}

export interface GeminiBotChallengeResponse {
  shouldPressSadooh: boolean;
  chatLineAr?: string;
}

export interface IBotDecisionProvider {
  getMoveDecision(
    projectedState: ClientProjectedGameState,
    memory: BotLegalMemory | undefined,
    difficulty: BotDifficulty
  ): Promise<MoveSubmission>;

  getChallengeDecision(
    projectedState: ClientProjectedGameState,
    memory: BotLegalMemory | undefined,
    difficulty: BotDifficulty
  ): Promise<boolean>;
}

/**
 * المزود المحلي الافتراضي للخصوم الآليين (يعمل بالكامل دون إنترنت أو API).
 * يمكن لاحقًا على الخادم استبداله بـ `CloudflareGeminiBotProvider` الذي ينفذ نفس الواجهة `IBotDecisionProvider`.
 */
export class LocalBotDecisionProvider implements IBotDecisionProvider {
  async getMoveDecision(
    projectedState: ClientProjectedGameState,
    memory: BotLegalMemory | undefined,
    difficulty: BotDifficulty
  ): Promise<MoveSubmission> {
    return decideBotMove(projectedState, memory, difficulty);
  }

  async getChallengeDecision(
    projectedState: ClientProjectedGameState,
    memory: BotLegalMemory | undefined,
    difficulty: BotDifficulty
  ): Promise<boolean> {
    return decideBotChallenge(projectedState, memory, difficulty);
  }
}

export const defaultBotDecisionProvider = new LocalBotDecisionProvider();
