import { ALL_CHARACTER_IDS } from '../src/game/rules/characters';
import type { ClientToServerEvent } from '../src/types/multiplayer';

export const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
export const token = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
export async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
}
export function cleanText(value: unknown, max = 140): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw Error('نص غير صالح.');
  return value.trim();
}
export function capacity(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 3 || Number(value) > 8) throw Error('سعة الغرفة من 3 إلى 8.');
  return Number(value);
}
export function parseEvent(raw: string | ArrayBuffer): ClientToServerEvent {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 2048) throw Error('رسالة غير صالحة.');
  const e = JSON.parse(raw);
  if (!e || typeof e !== 'object' || !e.payload || typeof e.payload !== 'object') throw Error('رسالة غير صالحة.');
  const p = e.payload;
  switch (e.type) {
    case 'JOIN_ROOM': cleanText(p.playerName, 24); break;
    case 'RECONNECT_MATCH': cleanText(p.playerId, 64); if (!/^[a-f0-9]{64}$/.test(p.reconnectToken)) throw Error('جلسة غير صالحة.'); break;
    case 'UPDATE_MAX_PLAYERS': capacity(p.maxPlayers); break;
    case 'ADD_BOT': if (!['easy','medium','hard'].includes(p.difficulty)) throw Error('مستوى غير صالح.'); break;
    case 'REMOVE_BOT': cleanText(p.botId, 64); break;
    case 'SUBMIT_MOVE':
      cleanText(p.cardId, 64);
      if (!ALL_CHARACTER_IDS.includes(p.claimedCharacter)) throw Error('شخصية غير صالحة.');
      if (p.targetPlayerId != null) cleanText(p.targetPlayerId, 64);
      if (p.secondaryCardId != null) cleanText(p.secondaryCardId, 64);
      break;
    case 'PRESS_SADOOH': case 'PASS_CHALLENGE': cleanText(p.matchId, 64); if (!Number.isInteger(p.turnNumber)) throw Error('دور غير صالح.'); break;
    case 'SEND_CHAT': cleanText(p.text); if (/(https?:|www\.|\.[a-z]{2,}(?:\/|\b)|!\[)/iu.test(p.text)) throw Error('الروابط والصور غير مسموحة.'); break;
    case 'MUTE_PLAYER': cleanText(p.targetPlayerId, 64); if (typeof p.muted !== 'boolean') throw Error('طلب غير صالح.'); break;
    case 'REPORT_ABUSE': cleanText(p.targetPlayerId, 64); cleanText(p.reason, 300); if (p.messageId != null) cleanText(p.messageId, 64); break;
    case 'START_MATCH': case 'LEAVE_ROOM': break;
    default: throw Error('حدث غير مدعوم.');
  }
  return e;
}
