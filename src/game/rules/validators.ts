import { CharacterId, GameState, MoveSubmission, PlayerState } from '../../types/game';
import { CHARACTERS } from './characters';

export interface MoveValidationResult {
  valid: boolean;
  reasonAr?: string;
}

/**
 * إرجاع قائمة اللاعبين الصالحين للاستهداف بقدرة الشخصية المعلنة.
 * - لا يجوز للاعب استهداف نفسه بقدرة مخصصة للخصوم.
 * - القدرات التي تتطلب وجود بطاقات في يد الهدف (الملقوف، النشّال، المخبّص) تفضل الأهداف التي تمتلك بطاقة واحدة على الأقل،
 *   ومع ذلك تسمح باختيار أي خصم آخر إذا لم يكن هناك خصم ببطاقات حتى لا تتوقف اللعبة.
 */
export function getValidTargetPlayers(
  state: GameState,
  activePlayerId: string,
  claimedCharacter: CharacterId
): PlayerState[] {
  const charDef = CHARACTERS[claimedCharacter];
  if (!charDef.requiresTarget) {
    return [];
  }

  const opponents = state.players.filter((p) => p.id !== activePlayerId);
  if (
    claimedCharacter === 'malqoof' ||
    claimedCharacter === 'nashal' ||
    claimedCharacter === 'mokhabbes'
  ) {
    const opponentsWithCards = opponents.filter((p) => p.hand.length > 0);
    return opponentsWithCards.length > 0 ? opponentsWithCards : opponents;
  }

  return opponents;
}

/**
 * التحقق القانوني من حركة اللاعب قبل قبولها في المحرك
 */
export function validateMoveSubmission(
  state: GameState,
  submission: MoveSubmission
): MoveValidationResult {
  if (state.phase !== 'CHOOSING_MOVE') {
    return { valid: false, reasonAr: 'لا يمكن لعب بطاقة في هذه المرحلة.' };
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || activePlayer.id !== submission.playerId) {
    return { valid: false, reasonAr: 'ليس دور هذا اللاعب حاليًا.' };
  }

  const hasCard = activePlayer.hand.some((c) => c.id === submission.cardId);
  if (!hasCard) {
    return { valid: false, reasonAr: 'البطاقة المختارة غير موجودة في يد اللاعب.' };
  }

  const charDef = CHARACTERS[submission.claimedCharacter];
  if (!charDef) {
    return { valid: false, reasonAr: 'الشخصية المعلنة غير معروفة.' };
  }

  if (charDef.requiresTarget) {
    if (submission.targetPlayerId === activePlayer.id) {
      return { valid: false, reasonAr: 'لا يمكنك استهداف نفسك بهذه القدرة المخصصة للخصوم!' };
    }
    const validTargets = getValidTargetPlayers(state, activePlayer.id, submission.claimedCharacter);
    if (validTargets.length > 0) {
      if (!submission.targetPlayerId) {
        return { valid: false, reasonAr: 'يجب اختيار لاعب مستهدف لهذه القدرة.' };
      }
      const targetExists = state.players.some(
        (p) => p.id === submission.targetPlayerId && p.id !== activePlayer.id
      );
      if (!targetExists) {
        return { valid: false, reasonAr: 'اللاعب المستهدف غير صالح.' };
      }
    }
  }

  return { valid: true };
}
