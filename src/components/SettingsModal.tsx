import {t,fmt,tr} from '../i18n/translate';
import {ThemeToggle} from './Theme';
import {SoundControls} from './Feedback';
import React from 'react';
import { UserSettings } from '../services/storage/localSettings';
import { BotDifficulty } from '../types/game';

interface SettingsModalProps {
  isOpen: boolean;
  settings: UserSettings;
  onUpdateSettings: (partial: Partial<UserSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t("إعدادات اللعبة")}
      >
        <div className="modal-card__header">
          <h2> {" "+t("الإعدادات")+""}</h2>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-card__body settings-form">
          <label className="form-field">
            <span>{""+t("اسمك في الجلسة:")+""}</span>
            <input
              type="text"
              value={settings.playerName}
              maxLength={20}
              onChange={(e) => onUpdateSettings({ playerName: e.target.value })}
              placeholder={t("اكتب اسمك...")}
            />
          </label>

          <label className="form-field">
            <span>{""+t("مستوى ذكاء الخصوم الآليين الافتراضي:")+""}</span>
            <div className="segmented-control">
              {tr((
                [
                  { id: 'easy', label: t("سهل") },
                  { id: 'medium', label: t("متوسط") },
                  { id: 'hard', label: t("صعب") },
                ] as Array<{ id: BotDifficulty; label: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`seg-btn ${
                    settings.defaultDifficulty === item.id ? 'is-active' : ''
                  }`}
                  onClick={() => onUpdateSettings({ defaultDifficulty: item.id })}
                >
                  {tr(item.label)}
                </button>
              )))}
            </div>
          </label>

          <label className="form-field">
            <span>{""+t("عدد اللاعبين الافتراضي على الطاولة (")+""}{tr(settings.defaultBotCount + 1)} {" "+t("لاعبين):")+""}</span>
            <input
              type="range"
              min={2}
              max={7}
              value={settings.defaultBotCount}
              onChange={(e) =>
                onUpdateSettings({ defaultBotCount: Number(e.target.value) })
              }
            />
            <div className="range-labels">
              <span>{""+t("3 لاعبين")+""}</span>
              <span>{""+t("8 لاعبين")+""}</span>
            </div>
          </label>

<label className="form-field"><span>{""+t("وقت الدور لكل لاعب:")+" "}{tr(settings.turnDurationSeconds)} {" "+t("ثانية")+""}</span><input aria-label={t("وقت الدور لكل لاعب")} type="range" min={30} max={180} step={5} value={settings.turnDurationSeconds} onChange={e=>onUpdateSettings({turnDurationSeconds:Number(e.target.value)})}/><div className="range-labels"><span>{""+t("30 ثانية")+""}</span><span>{""+t("180 ثانية")+""}</span></div></label><p>{""+t("يُطبّق الوقت على المباراة الجديدة. في الأونلاين يختار المضيف الوقت لجميع اللاعبين.")+""}</p>
<h3>{""+t("تخصيص الواجهة — مجاني للجميع")+""}</h3><label className="form-field"><span>{""+t("لون الخلفية")+""}</span><input type="color" value={settings.background||'#f6f3e9'} onChange={e=>onUpdateSettings({background:e.target.value})}/></label><label className="form-field"><span>{""+t("موقع أزرار اللعب")+""}</span><select value={settings.buttonPosition} onChange={e=>onUpdateSettings({buttonPosition:e.target.value as UserSettings['buttonPosition']})}><option value="bottom">{""+t("تحت البطاقات")+""}</option><option value="top">{""+t("فوق البطاقات")+""}</option><option value="right">{""+t("يمين البطاقات")+""}</option><option value="left">{""+t("يسار البطاقات")+""}</option></select></label><button className="btn-secondary" onClick={()=>onUpdateSettings({background:'',buttonPosition:'bottom'})}>{""+t("الشكل الافتراضي")+""}</button>
<ThemeToggle audio={false}/><SoundControls/>
          <div className="toggle-row">
            <span> {" "+t("تقليل الحركة والتحريكات (Reduce Motion)")+""}</span>
            <button
              type="button"
              className={`toggle-btn ${settings.reduceMotion ? 'is-on' : ''}`}
              onClick={() =>
                onUpdateSettings({ reduceMotion: !settings.reduceMotion })
              }
            >
              {tr(settings.reduceMotion ? t("مفعّل") : t("مغلَق"))}
            </button>
          </div>

          <div className="stats-summary-box">
            <span>{""+t("المباريات الملعوبة:")+" "}{tr(settings.matchesPlayed)}</span>
            <span>{""+t("مرات الفوز:")+" "}{tr(settings.matchesWon)}</span>
          </div>
        </div>

        <div className="modal-card__footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            {" "+t("حفظ وإغلاق")+" "}</button>
        </div>
      </div>
    </div>
  );
};
