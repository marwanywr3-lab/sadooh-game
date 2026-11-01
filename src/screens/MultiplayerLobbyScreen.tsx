import {t,fmt,tr} from '../i18n/translate';
import {useJoinFeedback} from '../components/Feedback';
import {BrandLogo} from '../components/Theme';
import React, { useEffect, useRef, useState } from 'react';
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
    t("أنشئ غرفة جديدة أو انضم عبر رابط دعوة.")
  );

  const seenWaiting=useRef(false);
  if(roomState.roomCode&&roomState.status==='waiting'&&roomState.connectionStatus==='connected')seenWaiting.current=true;
  const joined=useJoinFeedback(roomState.members.map(m=>m.id),roomState.roomCode||'',!!roomState.partyMode);
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
      setCopiedNotice(t("تم نسخ رابط الدعوة إلى الحافظة!"));
      setTimeout(() => setCopiedNotice(null), 3000);
    } catch {
      setCopiedNotice(t("رابط الدعوة جاهز للنسخ."));
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
    awaiting_backend: t(" انتظر الاتصال بالخادم"),
    connecting: t(" جاري الاتصال بالخادم..."),
    connected: t(" متصل بالغرفة"),
    reconnecting: t(" انقطع الاتصال — جاري محاولة العودة للمباراة..."),
    disconnected: t(" غير متصل بالخادم"),
  };

  if(matchView) return <><GameTableScreen freshRemoteStart={seenWaiting.current} feedbackSilent={!!roomState.partyMode} remote={{service,view:matchView}} humanPlayerName={playerName} botCount={2} botDifficulty="medium" onExitToMenu={leave} onRecordMatchEnd={()=>{}} />{tr(roomState.connectionStatus!=='connected' && <div role="alert" style={{position:'fixed',top:10,right:10,zIndex:1000,background:'#622',padding:16}}>{""+t("انقطع الاتصال — نحاول استعادة الجلسة.")+""}</div>)}{tr(statusBanner && statusBanner!==t("متصل بالغرفة.") && <div role="status" style={{position:'fixed',bottom:10,right:10,zIndex:1000,background:'#342711',padding:12}}>{tr(statusBanner)}</div>)}</>;
  return (
    <div
      className="multiplayer-lobby-screen"
      style={{ backgroundImage: `url('./assets/menu-background.svg')` }}
    >
      <div className={`multiplayer-lobby-overlay ${joinOnly?'party-phone':''}`}>
        <header className="lobby-header">
          <div className="lobby-header__right">
            <BrandLogo onHome={leave} alt={t("صادوه!")} className="lobby-logo" />
            <div>
              <h2> {" "+t("الغرف الجماعية عبر الإنترنت")+""}</h2>
              <span className={`conn-status-pill conn-status--${roomState.connectionStatus}`}>
                {tr(connectionBadgeLabel[roomState.connectionStatus])}
              </span>
            </div>
          </div>

          <div className="lobby-header__actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsChatOpen(true)}
            >
               {" "+t("الشات (")+""}{tr(roomState.chatHistory.length)})
            </button>
            <button type="button" className="btn-ghost" onClick={leave}>
               {" "+t("القائمة الرئيسية")+" "}</button>
          </div>
        </header>

        {/* تنبيه واضح وصادق بأن الخادم بانتظار التفعيل */}
        {tr(statusBanner && (
          <div className="backend-honest-banner" role="status">
            <span> {tr(statusBanner)}</span>
          </div>
        ))}

        {/* واجهة العودة إلى المباراة بعد انقطاع الاتصال (Reconnect UI) */}
        {tr(roomState.roomCode && (roomState.connectionStatus === 'disconnected' ||
          roomState.connectionStatus === 'reconnecting') && (
          <div className="reconnect-card" role="alert">
            <div className="reconnect-card__content">
              <h3> {" "+t("انقطع الاتصال بالغرفة!")+""}</h3>
              <p>
                {" "+t("لا تشيل هم! مقعدك وبطاقاتك السرية محفوظة في الغرفة (")+""}{tr(roomState.roomCode)}{""+t("). يمكنك استعادة الجلسة فور استقرار الاتصال.")+" "}</p>
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
                 {" "+t("العودة إلى المباراة الآن")+" "}</button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => service.simulateConnectionToggle('awaiting_backend')}
              >
                {" "+t("إعادة الاتصال")+" "}</button>
            </div>
          </div>
        ))}

        <div className={`lobby-grid ${roomState.roomCode ? 'has-room' : 'no-room'}`}>
          {/* العمود الأيمن: إعدادات اللاعب، إنشاء غرفة، أو الانضمام برمز/رابط */}
          <section className="lobby-panel">
            <h3>{tr(joinOnly?t("العب مع بعض — جوالك"):t("جهّز جلستك"))}</h3>

            <div className="form-field">
              <span>{""+t("اسم اللاعب في الغرفة:")+""}</span>
              <div className="inline-input-row">
                <input
                  type="text"
                  value={playerName}
                  maxLength={20}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={t("اكتب اسمك...")}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => service.setPlayerName(playerName)}
                >
                  {" "+t("تحديث الاسم")+" "}</button>
              </div>
            </div>

            <div className="lobby-subbox">
              {tr(!joinOnly&&<>
              <h4> {" "+t("إنشاء غرفة جديدة")+""}</h4>
              <div className="form-field">
                <span>{""+t("عدد اللاعبين المستهدف (")+""}{tr(roomState.maxPlayers)} {" "+t("لاعبين):")+""}</span>
                <div className="player-count-chips">
                  {tr([3, 4, 5, 6, 7, 8].map((cnt) => (
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
                      {tr(cnt)} {" "+t("لاعبين")+" "}</button>
                  )))}
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
                 {" "+t("إنشاء غرفة جديدة")+" "}</button></>)}
            </div>

            <div className="lobby-subbox"><h4>{""+t("عندك دعوة؟")+""}</h4><div className="inline-input-row"><input aria-label={t("رابط الدعوة أو رمز الغرفة")} value={joinCodeInput} onChange={e=>setJoinCodeInput(e.target.value)} placeholder={t("الصق الرابط أو رمز الغرفة")} maxLength={2048}/><button className="btn-secondary" onClick={()=>{let code=joinCodeInput.trim();try{code=new URL(code).searchParams.get('room')||code;}catch{}service.sendEvent({type:'JOIN_ROOM',payload:{roomCode:code.toUpperCase(),playerName}});}}>{""+t("انضم")+""}</button></div></div>

          </section>

          {/* العمود الأيسر: غرفة الانتظار، الأعضاء، الخصوم الآليين، وزر بدء المباراة للمضيف */}
          <section className="lobby-panel">
            <div className="room-code-banner">
              <div>
                <span className="room-code-label">{""+t("رمز الغرفة الحالي:")+""}</span>
                <strong className="room-code-value">{tr(roomState.roomCode)}</strong>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handleCopyInvite}
              >
                 {" "+t("نسخ رابط الدعوة")+" "}</button>
            </div>

            {tr(copiedNotice && <div className="copied-toast">{tr(copiedNotice)}</div>)}

            <h3>
               {" "+t("الربع (")+""}{tr(roomState.members.length)} / {tr(roomState.maxPlayers)})
            </h3>

            <div className="room-members-list">
              {tr(roomState.members.map((member) => (
                <div key={member.id} className={`room-member-card ${joined.has(member.id)?'feedback-join':''}`}>
                  {tr(activeBubbleByPlayer[member.id] && (
                    <div className="member-chat-bubble">
                      {tr(activeBubbleByPlayer[member.id])}
                    </div>
                  ))}
                  <img
                    src={member.avatarAsset.replace(/\.png$/, '.svg')}
                    alt={member.name}
                    className="room-member-avatar"
                  />
                  <div className="room-member-info">
                    <div className="room-member-title">
                      <strong>{member.name}</strong>
                      {tr(member.isHost && <span className="host-badge"> {" "+t("المضيف")+""}</span>)}
                      {tr(member.isBot && (
                        <span className="bot-badge">
                           {" "+t("آلي (")+""}{tr(member.botDifficulty === 'easy' ? t("سهل") : member.botDifficulty === 'hard' ? t("صعب") : t("متوسط"))})
                        </span>
                      ))}
                    </div>
                    <span className="room-member-status">
                      {tr(member.isConnected ? t(" متصل وجاهز") : t(" منقطع"))}
                    </span>
                  </div>
                  {tr(member.isBot && (
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
                      {" "+t("إزالة ✕")+" "}</button>
                  ))}
                </div>
              )))}

              {/* مقاعد انتظار اللاعبين الفارغة */}
              {tr(Array.from({
                length: Math.max(0, roomState.maxPlayers - roomState.members.length),
              }).map((_, idx) => (
                <div key={`empty_${idx}`} className="room-member-card is-empty-seat">
                  <div className="empty-seat-circle"></div>
                  <div className="room-member-info">
                    <strong>{""+t("مقعد بانتظار لاعب...")+""}</strong>
                    <span>{""+t("شارك رمز الغرفة أو أضف خصمًا آليًا")+""}</span>
                  </div>
                </div>
              )))}
            </div>

            {/* إضافة خصوم آليين للغرفة */}
            <div className="add-bot-bar">
              <span>{""+t("إضافة خصم آلي للغرفة:")+""}</span>
              <select
                value={botDiffToAdd}
                onChange={(e) => setBotDiffToAdd(e.target.value as BotDifficulty)}
              >
                <option value="easy">{""+t("سهل")+""}</option>
                <option value="medium">{""+t("متوسط")+""}</option>
                <option value="hard">{""+t("صعب")+""}</option>
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
                 {" "+t("+ إضافة خصم آلي")+" "}</button>
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
                 {" "+t("بدء المباراة الجماعية للمضيف")+" "}</button>

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
                 {" "+t("العب الآن بنفس الإعدادات محليًا ضد الكمبيوتر")+" "}</button>
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
