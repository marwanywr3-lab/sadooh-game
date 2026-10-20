import { ClientProjectedGameState, GameState, PublicPlayerView } from '../../types/game';

/**
 * إسقاط حالة المباراة للاعب محدد (Client Projection):
 * يضمن عدم تسريب أي بطاقات مخفية للخصوم أو هوية البطاقة المقلوبة على الطاولة
 * أو بطاقات كومة السحب، سواء في الواجهة المحلية أو عند النقل إلى Cloudflare Durable Objects.
 */
export function projectGameStateForPlayer(
  state: GameState,
  viewerPlayerId: string
): ClientProjectedGameState {
  const viewer = state.players.find((p) => p.id === viewerPlayerId);

  const publicPlayers: PublicPlayerView[] = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    isPro:p.isPro,
    isBot: p.isBot,
    botDifficulty: p.botDifficulty,
    avatarAsset: p.avatarAsset,
    cardCount: p.hand.length,
    hasSanadShield: p.hasSanadShield,
    isConnected: p.isConnected,
    isMuted: p.isMuted,
  }));

  const pendingClaimPublic = state.pendingClaim
    ? {
        playerId: state.pendingClaim.playerId,
        claimedCharacter: state.pendingClaim.claimedCharacter,
        targetPlayerId: state.pendingClaim.targetPlayerId,
      }
    : null;

  let lastOutcomePublic: ClientProjectedGameState['lastOutcomePublic'] = null;
  if (state.lastOutcome) {
    const { privateReveal, ...publicFields } = state.lastOutcome;
    lastOutcomePublic = {
      ...publicFields,
      myPrivateReveal:
        privateReveal && privateReveal.viewerPlayerId === viewerPlayerId
          ? {
              targetPlayerId: privateReveal.targetPlayerId,
              revealedCard: privateReveal.revealedCard,
            }
          : null,
    };
  }

  return {
    matchId: state.matchId,
    viewerPlayerId,
    myHand: viewer ? [...viewer.hand] : [],
    players: publicPlayers,
    drawPileCount: state.drawPile.length,
    discardPileCount: state.discardPile.length,
    currentPlayerIndex: state.currentPlayerIndex,
    turnNumber: state.turnNumber,
    phase: state.phase,
    turnTimerSeconds: state.turnTimerSeconds,
    pendingClaimPublic,
    lastOutcomePublic,
    winnerPlayerId: state.winnerPlayerId,
    logs: state.logs,
    chatMessages: state.chatMessages,
  };
}
