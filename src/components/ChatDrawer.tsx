import React, { useState } from 'react';
import { ChatMessage, PublicPlayerView } from '../types/game';
import { QUICK_CHAT_REACTIONS } from '../game/bots/botPhrases';
import { sanitizeChatText } from '../services/multiplayer/mockRoomClient';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  players: PublicPlayerView[];
  viewerPlayerId: string;
  onSendMessage: (text: string, isQuickReaction?: boolean) => void;
  onToggleMutePlayer: (playerId: string) => void;
  onReportPlayer: (playerId: string, reason: string) => void;
}

/**
 * نافذة الشات العام للغرفة والطاولة:
 * - قراءة سجل الرسائل العام (لا توجد رسائل خاصة).
 * - ردود فعل سريعة بلهجة سعودية.
 * - منع إرسال الروابط أو الصور.
 * - مكان جاهز لخصائص كتم اللاعب والإبلاغ عن الإساءة عند تفعيل الخادم.
 */
export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  players,
  viewerPlayerId,
  onSendMessage,
  onToggleMutePlayer,
  onReportPlayer,
}) => {
  const [inputText, setInputText] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [moderationNotice, setModerationNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const mutedSet = new Set(players.filter((p) => p.isMuted).map((p) => p.id));
  const visibleMessages = messages.filter((m) => !mutedSet.has(m.senderId));

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const check = sanitizeChatText(inputText);
    if (!check.ok) {
      setErrorText(check.errorAr ?? 'رسالة غير صالحة.');
      return;
    }
    setErrorText(null);
    onSendMessage(check.cleanText, false);
    setInputText('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="chat-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="شات الاستراحة العام"
      >
        <div className="chat-drawer__header">
          <div>
            <h3>💬 شات الاستراحة العام</h3>
            <span className="chat-drawer__subtitle">
              رسائل عامة لكل الجلسة (تظهر فقاعة 4 ثوانٍ فوق مقعد اللاعب)
            </span>
          </div>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* شريط إدارة اللاعبين (كتم / إبلاغ عن إساءة) */}
        <div className="chat-drawer__moderation-bar">
          <span className="moderation-label">إدارة اللاعبين:</span>
          <div className="moderation-chips">
            {players
              .filter((p) => p.id !== viewerPlayerId)
              .map((p) => (
                <div key={p.id} className="moderation-chip">
                  <span>{p.name}</span>
                  <button
                    type="button"
                    className={`btn-mini ${p.isMuted ? 'is-muted' : ''}`}
                    onClick={() => {
                      onToggleMutePlayer(p.id);
                      setModerationNotice(
                        p.isMuted
                          ? `طُلب إلغاء كتم «${p.name}».`
                          : `طُلب كتم رسائل «${p.name}».`
                      );
                    }}
                    title="كتم / إلغاء كتم اللاعب"
                  >
                    {p.isMuted ? '🔇 مكتوم' : '🔊 كتم'}
                  </button>
                  <button
                    type="button"
                    className="btn-mini btn-mini--report"
                    onClick={() => setReportTargetId(p.id)}
                    title="الإبلاغ عن إساءة"
                  >
                    🚩 إبلاغ
                  </button>
                </div>
              ))}
          </div>
        </div>

        {moderationNotice && (
          <div className="chat-drawer__banner">{moderationNotice}</div>
        )}

        {reportTargetId && (
          <div className="chat-drawer__report-box">
            <p>
              الإبلاغ عن إساءة من «
              {players.find((p) => p.id === reportTargetId)?.name}»:
            </p>
            <div className="report-actions">
              {['ألفاظ غير لائقة', 'إزعاج متكرر (سبام)', 'اسم غير مناسب'].map(
                (reason) => (
                  <button
                    key={reason}
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      onReportPlayer(reportTargetId, reason);
                      setReportTargetId(null);
                      setModerationNotice(
                        `أُرسل طلب البلاغ (${reason}). انتظر تأكيد الحفظ من الخادم.`
                      );
                    }}
                  >
                    {reason}
                  </button>
                )
              )}
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setReportTargetId(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* سجل الرسائل */}
        <div className="chat-drawer__messages">
          {visibleMessages.length === 0 ? (
            <p className="chat-drawer__empty">
              لا توجد رسائل بعد.. ابدأ السوالف أو أرسل رد فعل سريع!
            </p>
          ) : (
            visibleMessages.map((msg) => {
              const isMe = msg.senderId === viewerPlayerId;
              return (
                <div
                  key={msg.id}
                  className={`chat-msg ${isMe ? 'chat-msg--me' : 'chat-msg--other'}`}
                >
                  <div className="chat-msg__meta">
                    <strong>{msg.senderName}</strong>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString('ar-SA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="chat-msg__text">{msg.text}</div>
                </div>
              );
            })
          )}
        </div>

        {/* ردود الفعل السريعة */}
        <div className="chat-drawer__quick">
          {QUICK_CHAT_REACTIONS.map((reaction) => (
            <button
              key={reaction}
              type="button"
              className="quick-reaction-chip"
              onClick={() => {
                setErrorText(null);
                onSendMessage(reaction, true);
              }}
            >
              {reaction}
            </button>
          ))}
        </div>

        {errorText && <div className="chat-drawer__error">{errorText}</div>}

        {/* إرسال رسالة نصية (بدون صور أو روابط) */}
        <form className="chat-drawer__form" onSubmit={handleSend}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب رسالة للجلسة (بدون روابط أو صور)..."
            maxLength={140}
          />
          <button type="submit" className="btn-primary">
            إرسال
          </button>
        </form>
      </div>
    </div>
  );
};
