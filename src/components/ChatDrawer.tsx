import {t,fmt,tr} from '../i18n/translate';
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
      setErrorText(check.errorAr ?? t("رسالة غير صالحة."));
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
        aria-label={t("شات الاستراحة العام")}
      >
        <div className="chat-drawer__header">
          <div>
            <h3> {" "+t("شات الاستراحة العام")+""}</h3>
            <span className="chat-drawer__subtitle">
              {" "+t("رسائل عامة لكل الجلسة (تظهر فقاعة 8 ثوانٍ فوق مقعد اللاعب)")+" "}</span>
          </div>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* شريط إدارة اللاعبين (كتم / إبلاغ عن إساءة) */}
        <div className="chat-drawer__moderation-bar">
          <span className="moderation-label">{""+t("إدارة اللاعبين:")+""}</span>
          <div className="moderation-chips">
            {tr(players
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
                          ? fmt("طُلب إلغاء كتم «{0}».",[p.name])
                          : fmt("طُلب كتم رسائل «{0}».",[p.name])
                      );
                    }}
                    title={t("كتم / إلغاء كتم اللاعب")}
                  >
                    {tr(p.isMuted ? t(" مكتوم") : t(" كتم"))}
                  </button>
                  <button
                    type="button"
                    className="btn-mini btn-mini--report"
                    onClick={() => setReportTargetId(p.id)}
                    title={t("الإبلاغ عن إساءة")}
                  >
                     {" "+t("إبلاغ")+" "}</button>
                </div>
              )))}
          </div>
        </div>

        {tr(moderationNotice && (
          <div className="chat-drawer__banner">{tr(moderationNotice)}</div>
        ))}

        {tr(reportTargetId && (
          <div className="chat-drawer__report-box">
            <p>
              {" "+t("الإبلاغ عن إساءة من «")+" "}{tr(players.find((p) => p.id === reportTargetId)?.name)}»:
            </p>
            <div className="report-actions">
              {tr([t("ألفاظ غير لائقة"), t("إزعاج متكرر (سبام)"), t("اسم غير مناسب")].map(
                (reason) => (
                  <button
                    key={reason}
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      onReportPlayer(reportTargetId, reason);
                      setReportTargetId(null);
                      setModerationNotice(
                        fmt("أُرسل طلب البلاغ ({0}). انتظر تأكيد الحفظ من الخادم.",[reason])
                      );
                    }}
                  >
                    {tr(reason)}
                  </button>
                )
              ))}
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setReportTargetId(null)}
              >
                {" "+t("إلغاء")+" "}</button>
            </div>
          </div>
        ))}

        {/* سجل الرسائل */}
        <div className="chat-drawer__messages">
          {tr(visibleMessages.length === 0 ? (
            <p className="chat-drawer__empty">
              {" "+t("لا توجد رسائل بعد.. ابدأ السوالف أو أرسل رد فعل سريع!")+" "}</p>
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
                      {tr(new Date(msg.timestamp).toLocaleTimeString('ar-SA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }))}
                    </span>
                  </div>
                  <div className="chat-msg__text">{msg.text}</div>
                </div>
              );
            })
          ))}
        </div>

        {/* ردود الفعل السريعة */}
        <div className="chat-drawer__quick">
          {tr(QUICK_CHAT_REACTIONS.map((reaction) => (
            <button
              key={reaction}
              type="button"
              className="quick-reaction-chip"
              onClick={() => {
                setErrorText(null);
                onSendMessage(reaction, true);
              }}
            >
              {tr(reaction)}
            </button>
          )))}
        </div>

        {tr(errorText && <div className="chat-drawer__error">{tr(errorText)}</div>)}

        {/* إرسال رسالة نصية (بدون صور أو روابط) */}
        <form className="chat-drawer__form" onSubmit={handleSend}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t("اكتب رسالة للجلسة (بدون روابط أو صور)...")}
            maxLength={140}
          />
          <button type="submit" className="btn-primary">
            {" "+t("إرسال")+" "}</button>
        </form>
      </div>
    </div>
  );
};
