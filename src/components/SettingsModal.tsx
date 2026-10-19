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
        aria-label="إعدادات اللعبة"
      >
        <div className="modal-card__header">
          <h2> الإعدادات</h2>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-card__body settings-form">
          <label className="form-field">
            <span>اسمك في الجلسة:</span>
            <input
              type="text"
              value={settings.playerName}
              maxLength={20}
              onChange={(e) => onUpdateSettings({ playerName: e.target.value })}
              placeholder="اكتب اسمك..."
            />
          </label>

          <label className="form-field">
            <span>مستوى ذكاء الخصوم الآليين الافتراضي:</span>
            <div className="segmented-control">
              {(
                [
                  { id: 'easy', label: 'سهل' },
                  { id: 'medium', label: 'متوسط' },
                  { id: 'hard', label: 'صعب' },
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
                  {item.label}
                </button>
              ))}
            </div>
          </label>

          <label className="form-field">
            <span>عدد اللاعبين الافتراضي على الطاولة ({settings.defaultBotCount + 1} لاعبين):</span>
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
              <span>3 لاعبين</span>
              <span>8 لاعبين</span>
            </div>
          </label>

<div className="toggle-row">
            <span> تقليل الحركة والتحريكات (Reduce Motion)</span>
            <button
              type="button"
              className={`toggle-btn ${settings.reduceMotion ? 'is-on' : ''}`}
              onClick={() =>
                onUpdateSettings({ reduceMotion: !settings.reduceMotion })
              }
            >
              {settings.reduceMotion ? 'مفعّل' : 'مغلَق'}
            </button>
          </div>

          <div className="stats-summary-box">
            <span>المباريات الملعوبة: {settings.matchesPlayed}</span>
            <span>مرات الفوز: {settings.matchesWon}</span>
          </div>
        </div>

        <div className="modal-card__footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            حفظ وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
