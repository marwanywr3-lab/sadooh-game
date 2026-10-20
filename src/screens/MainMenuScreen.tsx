import {BrandLogo} from '../components/Theme';
import {InstallButton} from '../components/InstallButton';
import React, { useState } from 'react';
import { BotDifficulty } from '../types/game';
import { UserSettings } from '../services/storage/localSettings';

interface MainMenuScreenProps {
  settings: UserSettings;
  onStartSinglePlayer: (botCount: number, difficulty: BotDifficulty, playerName: string) => void;
  onOpenMultiplayer: () => void;
  onOpenParty:()=>void;
  onOpenPassPhone:()=>void;
  onOpenAccount:()=>void;
  onOpenPro:()=>void;
  accountName?:string;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onStartTutorial: () => void;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  settings,
  onStartSinglePlayer,
  onOpenMultiplayer,
  onOpenParty,
  onOpenPassPhone,
  onOpenAccount,onOpenPro,accountName,
  onOpenHowToPlay,
  onOpenSettings,
  onStartTutorial,
}) => {
  const [showSetupBox, setShowSetupBox] = useState(false);
  const [playerName, setPlayerName] = useState(settings.playerName);
  const [botCount, setBotCount] = useState(settings.defaultBotCount);
  const [difficulty, setDifficulty] = useState<BotDifficulty>(settings.defaultDifficulty);

  return (
    <div
      className="main-menu-screen"
      style={{ backgroundImage: `url('./assets/menu-background.svg')` }}
    >
      <div className="main-menu-overlay">
        <div className="main-menu-card">
          <span className="menu-edition">لعبة جمعتنا / ٠١</span>
          <div className="main-menu-logo-wrap">
            <BrandLogo
              alt="شعار صادوه!"
              className="main-menu-logo"
              draggable={false}
            />
            <h1 className="main-menu-title-fallback">صادوه!</h1>
            <p className="main-menu-tagline">
              ورق، سوالف، وشوية خداع.
            </p>
          </div>

          {/* ترحيب فهد */}
          <div className="abu-fahad-welcome">
            <img
              src="./assets/abu-fahad.svg"
              alt="فهد"
              className="abu-fahad-welcome__img"
              draggable={false}
            />
            <div className="abu-fahad-welcome__bubble">
              <strong>حيّ الله الربع.</strong><br/>خلّص ورقك قبلهم. وإذا شكّيت في واحد… صادوه!
            </div>
          </div>

          {!showSetupBox ? (
            <div className="main-menu-actions"><p className="menu-section-label">على الطاولة</p>
              <button
                type="button"
                className="btn-menu btn-menu--warm"
                onClick={() => setShowSetupBox(true)}
              >
                تدرّب لحالك
              </button>

              <button
                type="button"
                className="btn-menu btn-menu--primary"
                onClick={onOpenMultiplayer}
              >
                اجمع الربع ←
              </button>

              <div className="main-menu-subgrid">
                <button
                  type="button"
                  className="btn-menu btn-menu--warm"
                  onClick={onOpenHowToPlay}
                >
                  كيف نلعب؟
                </button>

                <button
                  type="button"
                  className="btn-menu btn-menu--warm"
                  onClick={onOpenSettings}
                >
                  الإعدادات
                </button>
              </div>

              <button
                type="button"
                className="btn-menu btn-menu--accent"
                onClick={onStartTutorial}
              >
                أول مرة؟ نجربها سوا
              </button>
              <button type="button" className="btn-menu btn-menu--secondary" onClick={onOpenParty}>العب مع بعض</button>
              <button type="button" className="btn-menu btn-menu--warm" onClick={onOpenPassPhone}>العب من جوال واحد</button>
              <div className="main-menu-subgrid"><button className="btn-menu btn-menu--warm" onClick={onOpenAccount}>{accountName||'تسجيل الدخول'}</button><button className="btn-menu btn-menu--accent" onClick={onOpenPro}>خلك Pro</button></div>
              <InstallButton/>
            </div>
          ) : (
            <div className="singleplayer-setup-panel">
              <h3>إعداد جلسة اللعب ضد الكمبيوتر</h3>

              <label className="form-field">
                <span>اسمك على الطاولة:</span>
                <input
                  type="text"
                  value={playerName}
                  maxLength={20}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="اكتب اسمك..."
                />
              </label>

              <div className="form-field">
                <span>عدد اللاعبين الإجمالي على الطاولة ({botCount + 1} لاعبين):</span>
                <div className="player-count-chips">
                  {[2, 3, 4, 5, 6, 7].map((bCount) => (
                    <button
                      key={bCount}
                      type="button"
                      className={`count-chip ${botCount === bCount ? 'is-active' : ''}`}
                      onClick={() => setBotCount(bCount)}
                    >
                      {bCount + 1} لاعبين
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <span>مستوى الصعوبة:</span>
                <div className="segmented-control">
                  {(
                    [
                      { id: 'easy', label: 'سهل (مبتدئ)' },
                      { id: 'medium', label: 'متوسط (متوازن)' },
                      { id: 'hard', label: 'صعب (محترفين)' },
                    ] as Array<{ id: BotDifficulty; label: string }>
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`seg-btn ${difficulty === d.id ? 'is-active' : ''}`}
                      onClick={() => setDifficulty(d.id)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-actions-row">
                <button
                  type="button"
                  className="btn-primary btn-lg"
                  onClick={() =>
                    onStartSinglePlayer(
                      botCount,
                      difficulty,
                      playerName.trim() || 'سلطان'
                    )
                  }
                >
                   ابدأ الجلسة الآن!
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowSetupBox(false)}
                >
                  رجوع
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
