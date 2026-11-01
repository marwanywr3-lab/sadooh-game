import {CardHelp} from './CardHelp';
import {t,fmt,tr} from '../i18n/translate';
import React from 'react';
import { CharacterId } from '../types/game';
import { CHARACTERS } from '../game/rules/characters';

interface CardViewProps {
  characterId?: CharacterId;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  badgeText?: string;
}

/**
 * مكوّن عرض البطاقة:
 * يستخدم `card-back.svg` للبطاقات المقلوبة أو السرية،
 * ويستخدم `card-frame.svg` مع رسم الشخصية ووصف قدرتها كنص عربي واضح وحقيقي داخل البطاقة.
 */
export const CardView: React.FC<CardViewProps> = ({
  characterId,
  faceDown = false,
  selected = false,
  disabled = false,
  size = 'md',
  onClick,
  badgeText,
}) => {
  if (faceDown || !characterId) {
    return (
      <div className="card-with-help"><button
        type="button"
        className={`sadooh-card sadooh-card--back sadooh-card--${size} ${selected ? 'is-selected' : ''}`}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={t("بطاقة مقلوبة")}
      >
        <img
          src="./assets/card-back.svg"
          alt={t("ظهر البطاقة")}
          className="sadooh-card__back-img"
          draggable={false}
        />
        {tr(badgeText && <span className="sadooh-card__floating-badge">{tr(badgeText)}</span>)}
      </button><CardHelp/></div>
    );
  }

  const charDef = CHARACTERS[characterId];

  return (
    <div className="card-with-help"><button
      type="button"
      className={`sadooh-card sadooh-card--front sadooh-card--${size} ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ '--card-accent': charDef.accentColor } as React.CSSProperties}
    >
      <img
        src="./assets/card-frame.svg"
        alt=""
        className="sadooh-card__frame-bg"
        draggable={false}
      />

      {tr(badgeText && <span className="sadooh-card__floating-badge">{tr(badgeText)}</span>)}

      {/* شريط اسم الشخصية في الخانة العلوية للإطار */}
      <div className="sadooh-card__header">
        <span className="sadooh-card__title">{tr(charDef.nameAr)}</span>
      </div>

      {/* رسم الشخصية داخل المنطقة الوسطى للإطار */}
      <div className="sadooh-card__art-wrap">
        <img
          src={charDef.assetPath}
          alt={tr(charDef.nameAr)}
          className="sadooh-card__art"
          draggable={false}
        />
        <span
          className="sadooh-card__tag"
          style={{ backgroundColor: charDef.accentColor }}
        >
          {tr(charDef.badgeTextAr)}
        </span>
      </div>

      {/* وصف القدرة في سطر عربي واضح داخل الخانة السفلية للإطار */}
      <div className="sadooh-card__footer">
        <p className="sadooh-card__desc">{tr(charDef.descriptionAr)}</p>
      </div>
    </button><CardHelp characterId={characterId}/></div>
  );
};
