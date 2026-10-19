import { BotDifficulty, ChatMessage } from '../../types/game';
import {
  ClientToServerEvent,
  ConnectionStatus,
  RoomMember,
  RoomState,
  ServerToClientEvent,
} from '../../types/multiplayer';

/**
 * واجهة خدمة الغرف الجماعية (قابلة للربط المباشر مع Cloudflare Workers + Durable Objects WebSocket).
 * في النسخة الحالية، تعمل في وضع معاينة الواجهة (`awaiting_backend`) وتعرض بوضوح أن الأزرار التي تتطلب خادمًا حقيقيًا
 * «بانتظار تفعيل اللعب الجماعي»، دون أي ادعاء وهمي بوجود اتصال خادم.
 */
export interface IMultiplayerRoomService {
  getState(): RoomState;
  subscribe(listener: (state: RoomState, lastBannerAr: string | null) => void): () => void;
  sendEvent(event: ClientToServerEvent): void;
  simulateConnectionToggle(status: ConnectionStatus): void;
}

const BOT_AVATARS = [
  './assets/abu-fahad.png',
  './assets/alkabeer.png',
  './assets/malqoof.png',
  './assets/nashal.png',
  './assets/mosarref.png',
  './assets/mokhabbes.png',
];

const BOT_NAMES = ['أبو فهد', 'أبو سارة', 'عزّام', 'تركي', 'سلمان', 'نايف', 'وليد'];

export class PreviewMultiplayerRoomService implements IMultiplayerRoomService {
  private state: RoomState;
  private lastBannerAr: string | null = null;
  private listeners: Set<(state: RoomState, lastBannerAr: string | null) => void> = new Set();

  constructor(initialPlayerName: string = 'فهد') {
    const roomCode = 'EST-482';
    this.state = {
      roomCode,
      inviteUrl: `${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://example.github.io/sadooh/'}?room=${roomCode}`,
      hostPlayerId: 'local_host',
      maxPlayers: 4,
      status: 'waiting',
      connectionStatus: 'awaiting_backend',
      members: [
        {
          id: 'local_host',
          name: initialPlayerName,
          isHost: true,
          isBot: false,
          avatarAsset: './assets/sanad.png',
          isConnected: true,
          isReady: true,
          isMuted: false,
        },
        {
          id: 'bot_abu_fahad',
          name: 'أبو فهد (آلي)',
          isHost: false,
          isBot: true,
          botDifficulty: 'medium',
          avatarAsset: './assets/abu-fahad.png',
          isConnected: true,
          isReady: true,
          isMuted: false,
        },
        {
          id: 'bot_azzam',
          name: 'عزّام (آلي)',
          isHost: false,
          isBot: true,
          botDifficulty: 'medium',
          avatarAsset: './assets/malqoof.png',
          isConnected: true,
          isReady: true,
          isMuted: false,
        },
      ],
      chatHistory: [
        {
          id: 'msg_welcome',
          senderId: 'bot_abu_fahad',
          senderName: 'أبو فهد',
          text: 'حيّ الله الشباب في غرفة الاستراحة! الغرف عبر الإنترنت جاهزة للربط مع خادم Cloudflare.',
          timestamp: Date.now() - 15000,
        },
      ],
    };
  }

  getState(): RoomState {
    return this.state;
  }

  subscribe(listener: (state: RoomState, lastBannerAr: string | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.state, this.lastBannerAr);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(bannerAr: string | null = null) {
    this.lastBannerAr = bannerAr;
    for (const l of this.listeners) {
      l(this.state, this.lastBannerAr);
    }
  }

  setPlayerName(name: string) {
    const clean = name.trim() || 'لاعب';
    this.state = {
      ...this.state,
      members: this.state.members.map((m) =>
        m.id === 'local_host' ? { ...m, name: clean } : m
      ),
    };
    this.emit('تم تحديث اسمك في الغرفة محليًا.');
  }

  sendEvent(event: ClientToServerEvent): void {
    switch (event.type) {
      case 'CREATE_ROOM': {
        const newCode = `EST-${Math.floor(100 + Math.random() * 900)}`;
        this.state = {
          ...this.state,
          roomCode: newCode,
          maxPlayers: Math.max(3, Math.min(8, event.payload.maxPlayers)),
          inviteUrl: `${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}?room=${newCode}`,
          members: this.state.members.map((m) =>
            m.id === 'local_host'
              ? { ...m, name: event.payload.playerName.trim() || m.name }
              : m
          ),
        };
        this.emit(
          `بانتظار تفعيل اللعب الجماعي: تم تجهيز إعدادات الغرفة (${newCode}) محليًا لمعاينة الواجهة، وسيعمل الإنشاء الفعلي فور ربط Cloudflare Durable Objects.`
        );
        break;
      }

      case 'JOIN_ROOM': {
        this.emit(
          `بانتظار تفعيل اللعب الجماعي: الانضمام الفعلي للغرفة (${event.payload.roomCode}) عبر الشبكة يتطلب تفعيل خادم Cloudflare Workers.`
        );
        break;
      }

      case 'UPDATE_MAX_PLAYERS': {
        const clamped = Math.max(3, Math.min(8, event.payload.maxPlayers));
        this.state = {
          ...this.state,
          maxPlayers: clamped,
          members: this.state.members.slice(0, clamped),
        };
        this.emit(`تم ضبط سعة الغرفة إلى ${clamped} لاعبين.`);
        break;
      }

      case 'ADD_BOT': {
        if (this.state.members.length >= this.state.maxPlayers) {
          this.emit('الغرفة وصلت إلى الحد الأقصى لعدد اللاعبين المختار.');
          return;
        }
        const idx = this.state.members.length;
        const botName = `${BOT_NAMES[idx % BOT_NAMES.length]} (آلي)`;
        const newBot: RoomMember = {
          id: `bot_${Date.now()}_${idx}`,
          name: botName,
          isHost: false,
          isBot: true,
          botDifficulty: event.payload.difficulty,
          avatarAsset: BOT_AVATARS[idx % BOT_AVATARS.length],
          isConnected: true,
          isReady: true,
          isMuted: false,
        };
        this.state = {
          ...this.state,
          members: [...this.state.members, newBot],
        };
        this.emit(`تمت إضافة الخصم الآلي «${botName}» إلى قائمة الغرفة.`);
        break;
      }

      case 'REMOVE_BOT': {
        this.state = {
          ...this.state,
          members: this.state.members.filter((m) => m.id !== event.payload.botId),
        };
        this.emit('تمت إزالة الخصم الآلي من الغرفة.');
        break;
      }

      case 'START_MATCH': {
        this.emit(
          'بانتظار تفعيل اللعب الجماعي: بدء مباراة جماعية متزامنة عبر الإنترنت ينتظر ربط Cloudflare Durable Objects. يمكنك الآن اللعب فورًا عبر وضع «العب ضد الكمبيوتر»!'
        );
        break;
      }

      case 'SEND_CHAT': {
        const sanitized = sanitizeChatText(event.payload.text);
        if (!sanitized.ok) {
          this.emit(sanitized.errorAr || 'نص الرسالة غير مسموح.');
          return;
        }
        const host = this.state.members.find((m) => m.id === 'local_host')!;
        const msg: ChatMessage = {
          id: `chat_${Date.now()}`,
          senderId: host.id,
          senderName: host.name,
          text: sanitized.cleanText,
          isQuickReaction: event.payload.isQuickReaction,
          timestamp: Date.now(),
        };
        this.state = {
          ...this.state,
          chatHistory: [...this.state.chatHistory, msg],
        };
        this.emit(
          'تم عرض الرسالة في معاينة الشات محليًا (الإرسال عبر الشبكة بانتظار تفعيل اللعب الجماعي).'
        );
        break;
      }

      case 'MUTE_PLAYER': {
        this.state = {
          ...this.state,
          members: this.state.members.map((m) =>
            m.id === event.payload.targetPlayerId
              ? { ...m, isMuted: event.payload.muted }
              : m
          ),
        };
        this.emit(
          event.payload.muted
            ? 'تم كتم اللاعب محليًا في واجهة الشات.'
            : 'تم إلغاء كتم اللاعب محليًا.'
        );
        break;
      }

      case 'REPORT_ABUSE': {
        this.emit(
          `بانتظار تفعيل اللعب الجماعي: تم تجهيز نموذج الإبلاغ عن الإساءة (${event.payload.reason}) ليُرسل إلى الخادم فور ربط Cloudflare.`
        );
        break;
      }

      case 'RECONNECT_MATCH': {
        this.emit(
          'بانتظار تفعيل اللعب الجماعي: استعادة الجلسة عبر رمز إعادة الاتصال (Reconnect Token) مجهزة هندسيًا وتنتظر ربط خادم Cloudflare.'
        );
        break;
      }

      default:
        break;
    }
  }

  simulateConnectionToggle(status: ConnectionStatus): void {
    this.state = {
      ...this.state,
      connectionStatus: status,
    };
    this.emit(`معاينة حالة الاتصال: تم التبديل إلى «${status}».`);
  }
}

/**
 * تنقية رسائل الشات ومنع الروابط أو الصور وفق متطلبات القسم 10
 */
export function sanitizeChatText(raw: string): {
  ok: boolean;
  cleanText: string;
  errorAr?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, cleanText: '', errorAr: 'لا يمكن إرسال رسالة فارغة.' };
  }
  const urlPattern = /(https?:\/\/|www\.|\.[a-z]{2,4}\/|<img|!\[)/i;
  if (urlPattern.test(trimmed)) {
    return {
      ok: false,
      cleanText: '',
      errorAr: 'الشات النصي لا يدعم إرسال الروابط أو الصور حفاظًا على سلامة الجلسة.',
    };
  }
  return {
    ok: true,
    cleanText: trimmed.slice(0, 140),
  };
}

export type { ServerToClientEvent };
