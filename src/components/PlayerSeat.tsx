import React from 'react';
import { PublicPlayerView } from '../types/game';

interface PlayerSeatProps {
  player: PublicPlayerView;
  isCurrentTurn: boolean;
  isTargetable: boolean;
  isSelectedTarget: boolean;
  onSelectTarget?: (playerId: string) => void;
  bubbleText?: string | null;
}

/**
 * مقعد الخصم حول طاولة الاستراحة:
 * يعرض صورة الشخصية، الاسم، عدد البطاقات فقط (مع صور مصغرة لظهر البطاقة دون كشف أي بطاقة سرية)،
 * درع السند إن وجد، وفقاعة الشات لمدة 4 ثوانٍ فوق مقعده.
 */
export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isCurrentTurn,
  isTargetable,
  isSelectedTarget,
  onSelectTarget,
  bubbleText,
}) => {
  const miniBacksCount = Math.min(player.cardCount, 6);

  return (
    <div
      className={`player-seat ${isCurrentTurn ? 'is-active-turn' : ''} ${
        isTargetable ? 'is-targetable' : ''
      } ${isSelectedTarget ? 'is-selected-target' : ''}`}
      onClick={() => {
        if (isTargetable && onSelectTarget) {
          onSelectTarget(player.id);
        }
      }}
      role={isTargetable ? 'button' : undefined}
      tabIndex={isTargetable ? 0 : undefined}
    >
      {/* فقاعة الشات العائمة فوق مقعد اللاعب لمدة 4 ثوانٍ */}
      {bubbleText && (
        <div className="player-seat__chat-bubble" role="status">
          <span>{bubbleText}</span>
        </div>
      )}

      <div className="player-seat__avatar-wrap">
        <img
          src={player.avatarAsset}
          alt={player.name}
          className="player-seat__avatar"
          draggable={false}
        />
        <span
          className={`player-seat__conn-dot ${
            player.isConnected ? 'is-online' : 'is-offline'
          }`}
          title={player.isConnected ? 'متصل' : 'منقطع'}
        />
        {player.hasSanadShield && (
          <span className="player-seat__shield-badge" title="محمي بدرع السند">
            🛡️ السند
          </span>
        )}
      </div>

      <div className="player-seat__info">
        <div className="player-seat__name-row">
          <span className="player-seat__name">{player.name}</span>
          {isCurrentTurn && <span className="player-seat__turn-pill">دوره</span>}
        </div>

        <div className="player-seat__cards-row" title={`عدد البطاقات: ${player.cardCount}`}>
          <div className="player-seat__mini-fan">
            {Array.from({ length: miniBacksCount }).map((_, idx) => (
              <img
                key={idx}
                src="./assets/card-back.png"
                alt=""
                className="player-seat__mini-card"
                draggable={false}
              />
            ))}
          </div>
          <span className="player-seat__card-count">{player.cardCount} بطاقات</span>
        </div>
      </div>

      {isTargetable && (
        <div className="player-seat__target-cta">
          {isSelectedTarget ? '✓ تم تحديد الهدف' : 'اضغط للاستهداف 🎯'}
        </div>
      )}
    </div>
  );
};
