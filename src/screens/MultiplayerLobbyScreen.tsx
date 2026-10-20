import {ProBadge} from '../components/ProBadge';
import {BrandLogo} from '../components/Theme';
import React, { useEffect, useState } from 'react';
import { BotDifficulty, PublicPlayerView } from '../types/game';
import { ConnectionStatus, RoomState } from '../types/multiplayer';
import { SupabaseRoomService } from '../services/multiplayer/roomClient';
import { GameTableScreen } from './GameTableScreen';
import type { ClientProjectedGameState } from '../types/game';
import { ChatDrawer } from '../components/ChatDrawer';
import { CHAT_BUBBLE_MS } from '../game/rules/deck';

interface MultiplayerLobbyScreenProps {
  joinOnly?:boolean;
  initialPlayerName: string;
  onBackToMenu: () => void;
  onPlayLocalWithSetup: (botCount: number, difficulty: BotDifficulty, playerName: string) => void;
}

/**
 * شاشة اللعب الجماعي عبر الإنترنت (الواجهة والمعمارية الكاملة الجاهزة للربط مع Cloudflare Workers & Durable Objects).
 * تعرض بوضوح أن الأزرار التي تتطلب خادمًا حقيقيًا «بانتظار تفعيل اللعب الجماعي»، دون أي نجاح وهمي.
 */
export const MultiplayerLobbyScreen: React.FC<MultiplayerLobbyScreenProps> = ({
  joinOnly=false,
  initialPlayerName,
  onBackToMenu,
  onPlayLocalWithSetup,
}) => {
  const [service] = useState(() => new SupabaseRoomService(initialPlayerName));
  const [roomState, setRoomState] = useState<RoomState>(() => service.getState());
  const [statusBanner, setStatusBanner] = useState<string | null>(
    'أنشئ غرفة جديدة أو انضم عبر رابط دعوة.'
  );

  const [matchView,setMatchView]=useState<ClientProjectedGameState|null>(null);
  useEffect(()=>service.subscribeMatch(setMatchView),[service]);
  useEffect(()=>{service.reconnect();return()=>service.disconnect();},[service]);
  const leave=()=>{service.leave();onBackToMenu();};
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [joinCodeInput, setJoinCodeInput] = useState(new URLSearchParams(location.search).get('room') || '');
  const [botDiffToAdd, setBotDiffToAdd] = useState<BotDifficulty>('medium');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [activeBubbleByPlayer, setActiveBubbleByPlayer] = useState<Record<string, string>>({});

  useEffect(() => {
    return service.subscribe((nextState, banner) => {
      setRoomState({ ...nextState });
      if (banner) {
        setStatusBanner(banner);
      }
    });
  }, [service]);

  // عرض فقاعة الرسالة لمدة 4 ثوانٍ عند إرسال رسالة في شات الغرفة
  const triggerSeatBubble = (senderId: string, text: string) => {
    setActiveBubbleByPlayer((prev) => ({ ...prev, [senderId]: text }));
    setTimeout(() => {
      setActiveBubbleByPlayer((prev) => {
        const copy = { ...prev };
        if (copy[senderId] === text) {
          delete copy[senderId];
        }
        return copy;
      });
    }, CHAT_BUBBLE_MS);
  };

  const handleCopyInvite = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(roomState.inviteUrl);
      } else {
        const temp = document.createElement('textarea');
        temp.value = roomState.inviteUrl;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setCopiedNotice('تم نسخ رابط الدعوة إلى الحافظة!');
      setTimeout(() => setCopiedNotice(null), 3000);
    } catch {
      setCopiedNotice('رابط الدعوة جاهز للنسخ.');
    }
  };

  const publicPlayersForChat: PublicPlayerView[] = roomState.members.map((m) => ({
    id: m.id,
    name: m.name,
    isPro:m.isPro,proBadgeColor:m.proBadgeColor,
    isBot: m.isBot,
    botDifficulty: m.botDifficulty,
    avatarAsset: m.avatarAsset,
    cardCount: 4,
    hasSanadShield: false,
    isConnected: m.isConnected,
    isMuted: m.isMuted,
  }));

  const connectionBadgeLabel: Record<ConnectionStatus, string> = {
    awaiting_backend: ' انتظر الاتصال بالخادم',
    connecting: ' جاري الاتصال بالخادم...',
    connected: ' متصل بالغرفة',
    reconnecting: ' انقطع الاتصال — جاري محاولة العودة للمباراة...',
    disconnected: ' غير متصل بالخادم',
  };

  if(matchView) return <><GameTableScreen remote={{service,view:matchView}} humanPlayerName={playerName} botCount={2} botDifficulty="medium" onExitToMenu={leave} onRecordMatchEnd={()=>{}} />{roomState.connectionStatus!=='connected' && <div role="alert" style={{position:'fixed',top:10,right:10,zIndex:1000,background:'#622',padding:16}}>انقطع الاتصال — نحاول استعادة الجلسة.</div>}{statusBanner && statusBanner!=='متصل بالغرفة.' && <div role="status" style={{position:'fixed',bottom:10,right:10,zIndex:1000,background:'#342711',padding:12}}>{statusBanner}</div>}</>;
  return (
    <div
      className="multiplayer-lobby-screen"
      style={{ backgroundImage: `url('./assets/menu-background.svg')` }}
    >
      <div className={`multiplayer-lobby-overlay ${joinOnly?'party-phone':''}`}>
        <header className="lobby-header">
          <div className="lobby-header__right">
            <BrandLogo alt="صادوه!" className="lobby-logo" />
            <div>
              <h2> الغرف الجماعية عبر الإنترنت</h2>
              <span className={`conn-status-pill conn-status--${roomState.connectionStatus}`}>
                {connectionBadgeLabel[roomState.connectionStatus]}
              </span>
            </div>
          </div>

          <div className="lobby-header__actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsChatOpen(true)}
            >
               الشات ({roomState.chatHistory.length})
            </button>
            <button type="button" className="btn-ghost" onClick={leave}>
               القائمة الرئيسية
            </button>
          </div>
        </header>

        {/* تنبيه واضح وصادق بأن الخادم بانتظار التفعيل */}
        {statusBanner && (
          <div className="backend-honest-banner" role="status">
            <span> {statusBanner}</span>
          </div>
        )}

        {/* واجهة العودة إلى المباراة بعد انقطاع الاتصال (Reconnect UI) */}
        {roomState.roomCode && (roomState.connectionStatus === 'disconnected' ||
          roomState.connectionStatus === 'reconnecting') && (
          <div className="reconnect-card" role="alert">
            <div className="reconnect-card__content">
              <h3> انقطع الاتصال بالغرفة!</h3>
              <p>
                لا تشيل هم! مقعدك وبطاقاتك السرية محفوظة في الغرفة ({roomState.roomCode}). يمكنك
                استعادة الجلسة فور استقرار الاتصال.
              </p>
            </div>
            <div className="reconnect-card__actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  service.sendEvent({
                    type: 'RECONNECT_MATCH',
                    payload: {
                      roomCode: roomState.roomCode,
                      playerId: service.playerId,
                      reconnectToken: '',
                    },
                  })
                }
              >
                 العودة إلى المباراة الآن
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => service.simulateConnectionToggle('awaiting_backend')}
              >
                إعادة الاتصال
              </button>
            </div>
          </div>
        )}

        <div className={`lobby-grid ${roomState.roomCode ? 'has-room' : 'no-room'}`}>
          {/* العمود الأيمن: إعدادات اللاعب، إنشاء غرفة، أو الانضمام برمز/رابط */}
          <section className="lobby-panel">
            <h3>{joinOnly?'العب مع بعض — جوالك':'جهّز جلستك'}</h3>

            <div className="form-field">
              <span>اسم اللاعب في الغرفة:</span>
              <div className="inline-input-row">
                <input
                  type="text"
                  value={playerName}
                  maxLength={20}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="اكتب اسمك..."
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => service.setPlayerName(playerName)}
                >
                  تحديث الاسم
                </button>
              </div>
            </div>

            <div className="lobby-subbox">
              {!joinOnly&&<>
              <h4> إنشاء غرفة جديدة</h4>
              <div className="form-field">
                <span>عدد اللاعبين المستهدف ({roomState.maxPlayers} لاعبين):</span>
                <div className="player-count-chips">
                  {[3, 4, 5, 6, 7, 8].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      className={`count-chip ${
                        roomState.maxPlayers === cnt ? 'is-active' : ''
                      }`}
                      onClick={() =>
                        service.sendEvent({
                          type: 'UPDATE_MAX_PLAYERS',
                          payload: { maxPlayers: cnt },
                        })
                      }
                    >
                      {cnt} لاعبين
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="btn-primary btn-block"
                onClick={() =>
                  service.sendEvent({
                    type: 'CREATE_ROOM',
                    payload: {
                      playerName,
                      maxPlayers: roomState.maxPlayers,
                    },
                  })
                }
              >
                 إنشاء غرفة جديدة
              </button></>}
            </div>

            <div className="lobby-subbox"><h4>عندك دعوة؟</h4><div className="inline-input-row"><input aria-label="رابط الدعوة أو رمز الغرفة" value={joinCodeInput} onChange={e=>setJoinCodeInput(e.target.value)} placeholder="الصق الرابط أو رمز الغرفة" maxLength={2048}/><button className="btn-secondary" onClick={()=>{let code=joinCodeInput.trim();try{code=new URL(code).searchParams.get('room')||code;}catch{}service.sendEvent({type:'JOIN_ROOM',payload:{roomCode:code.toUpperCase(),playerName}});}}>انضم</button></div></div>

          </section>

          {/* العمود الأيسر: غرفة الانتظار، الأعضاء، الخصوم الآليين، وزر بدء المباراة للمضيف */}
          <section className="lobby-panel">
            <div className="room-code-banner">
              <div>
                <span className="room-code-label">رمز الغرفة الحالي:</span>
                <strong className="room-code-value">{roomState.roomCode}</strong>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handleCopyInvite}
              >
                 نسخ رابط الدعوة
              </button>
            </div>

            {copiedNotice && <div className="copied-toast">{copiedNotice}</div>}

            <h3>
               الربع ({roomState.members.length} / {roomState.maxPlayers})
            </h3>

            <div className="room-members-list">
              {roomState.members.map((member) => (
                <div key={member.id} className="room-member-card">
                  {activeBubbleByPlayer[member.id] && (
                    <div className="member-chat-bubble">
                      {activeBubbleByPlayer[member.id]}
                    </div>
                  )}
                  <img
                    src={member.avatarAsset.replace(/\.png$/, '.svg')}
                    alt={member.name}
                    className="room-member-avatar"
                  />
                  <div className="room-member-info">
                    <div className="room-member-title">
                      <strong>{member.name}</strong>{member.isPro&&<ProBadge color={member.proBadgeColor}/>}
                      {member.isHost && <span className="host-badge"> المضيف</span>}
                      {member.isBot && (
                        <span className="bot-badge">
                           آلي ({member.botDifficulty === 'easy' ? 'سهل' : member.botDifficulty === 'hard' ? 'صعب' : 'متوسط'})
                        </span>
                      )}
                    </div>
                    <span className="room-member-status">
                      {member.isConnected ? ' متصل وجاهز' : ' منقطع'}
                    </span>
                  </div>
                  {member.isBot && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() =>
                        service.sendEvent({
                          type: 'REMOVE_BOT',
                          payload: { botId: member.id },
                        })
                      }
                    >
                      إزالة ✕
                    </button>
                  )}
                </div>
              ))}

              {/* مقاعد انتظار اللاعبين الفارغة */}
              {Array.from({
                length: Math.max(0, roomState.maxPlayers - roomState.members.length),
              }).map((_, idx) => (
                <div key={`empty_${idx}`} className="room-member-card is-empty-seat">
                  <div className="empty-seat-circle"></div>
                  <div className="room-member-info">
                    <strong>مقعد بانتظار لاعب...</strong>
                    <span>شارك رمز الغرفة أو أضف خصمًا آليًا</span>
                  </div>
                </div>
              ))}
            </div>

            {/* إضافة خصوم آليين للغرفة */}
            <div className="add-bot-bar">
              <span>إضافة خصم آلي للغرفة:</span>
              <select
                value={botDiffToAdd}
                onChange={(e) => setBotDiffToAdd(e.target.value as BotDifficulty)}
              >
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() =>
                  service.sendEvent({
                    type: 'ADD_BOT',
                    payload: { difficulty: botDiffToAdd },
                  })
                }
              >
                 + إضافة خصم آلي
              </button>
            </div>

            {/* أزرار بدء المباراة */}
            <div className="lobby-start-footer">
              <button
                type="button"
                className="btn-primary btn-block"
                onClick={() =>
                  service.sendEvent({
                    type: 'START_MATCH',
                    payload: { roomCode: roomState.roomCode },
                  })
                }
              >
                 بدء المباراة الجماعية للمضيف
              </button>

              <button
                type="button"
                className="btn-secondary btn-block"
                onClick={() =>
                  onPlayLocalWithSetup(
                    Math.max(2, roomState.members.length - 1),
                    botDiffToAdd,
                    playerName
                  )
                }
              >
                 العب الآن بنفس الإعدادات محليًا ضد الكمبيوتر
              </button>
            </div>
          </section>
        </div>

        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={roomState.chatHistory}
          players={publicPlayersForChat}
          viewerPlayerId={service.playerId}
          onSendMessage={(text, isQuick) => {
            service.sendEvent({
              type: 'SEND_CHAT',
              payload: { text, isQuickReaction: isQuick },
            });
            triggerSeatBubble(service.playerId, text);
          }}
          onToggleMutePlayer={(targetId) => {
            const target = roomState.members.find((m) => m.id === targetId);
            if (target) {
              service.sendEvent({
                type: 'MUTE_PLAYER',
                payload: { targetPlayerId: targetId, muted: !target.isMuted },
              });
            }
          }}
          onReportPlayer={(targetId, reason) => {
            service.sendEvent({
              type: 'REPORT_ABUSE',
              payload: { targetPlayerId: targetId, reason },
            });
          }}
        />
      </div>
    </div>
  );
};
