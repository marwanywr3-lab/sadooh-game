import { BotDifficulty, CharacterId, ClientProjectedGameState, ChatMessage } from './game';

/**
 * عقود اللعب الجماعي المستقبلية للربط مع Cloudflare Workers & Durable Objects
 */
export type ConnectionStatus =
  | 'awaiting_backend' // الوضع الحالي قبل ربط خادم Cloudflare الحقيقي
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface RoomMember {
  isPro?:boolean;
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  avatarAsset: string;
  isConnected: boolean;
  isReady: boolean;
  isMuted?: boolean;
}

export interface RoomState {
  partyMode?: boolean;
  roomCode: string;
  inviteUrl: string;
  hostPlayerId: string;
  maxPlayers: number; // 3..8
  status: 'waiting' | 'in_progress' | 'finished';
  connectionStatus: ConnectionStatus;
  members: RoomMember[];
  chatHistory: ChatMessage[];
}

/**
 * الرسائل المرسلة من العميل إلى الخادم (Client -> Cloudflare Durable Object WebSocket)
 */
export type ClientToServerEvent =
  | { type: 'CREATE_PARTY_ROOM'; payload: { maxPlayers: number } }
  | { type: 'CREATE_ROOM'; payload: { playerName: string; maxPlayers: number } }
  | { type: 'JOIN_ROOM'; payload: { roomCode: string; playerName: string; reconnectToken?: string } }
  | { type: 'LEAVE_ROOM'; payload: { roomCode: string } }
  | { type: 'ADD_BOT'; payload: { difficulty: BotDifficulty } }
  | { type: 'REMOVE_BOT'; payload: { botId: string } }
  | { type: 'UPDATE_MAX_PLAYERS'; payload: { maxPlayers: number } }
  | { type: 'START_MATCH'; payload: { roomCode: string } }
  | {
      type: 'SUBMIT_MOVE';
      payload: {
        cardId: string;
        claimedCharacter: CharacterId;
        targetPlayerId: string | null;
        secondaryCardId?: string | null;
      };
    }
  | { type: 'PRESS_SADOOH'; payload: { matchId: string; turnNumber: number } }
  | { type: 'PASS_CHALLENGE'; payload: { matchId: string; turnNumber: number } }
  | { type: 'SEND_CHAT'; payload: { text: string; isQuickReaction?: boolean } }
  | { type: 'MUTE_PLAYER'; payload: { targetPlayerId: string; muted: boolean } }
  | { type: 'REPORT_ABUSE'; payload: { targetPlayerId: string; reason: string; messageId?: string } }
  | { type: 'RECONNECT_MATCH'; payload: { roomCode: string; playerId: string; reconnectToken: string } };

/**
 * الرسائل المستقبلة من الخادم إلى العميل (Cloudflare Durable Object -> Client WebSocket)
 */
export type ServerToClientEvent =
  | { type: 'ROOM_UPDATED'; payload: RoomState }
  | { type: 'MATCH_STARTED'; payload: ClientProjectedGameState }
  | { type: 'STATE_SYNC'; payload: ClientProjectedGameState }
  | { type: 'CHAT_RECEIVED'; payload: ChatMessage }
  | { type: 'PLAYER_CONNECTION_CHANGED'; payload: { playerId: string; isConnected: boolean } }
  | { type: 'ABUSE_REPORT_ACK'; payload: { reportId: string; statusMessageAr: string } }
  | { type: 'SERVER_ERROR'; payload: { code: string; messageAr: string } };
