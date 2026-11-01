import {t,fmt,tr} from '../i18n/translate';
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
  onOpenCustomize:()=>void;
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
  onOpenAccount,onOpenCustomize,accountName,
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
          <span className="menu-edition">{""+t("لعبة جمعتنا / ٠١")+""}</span>
          <div className="main-menu-logo-wrap">
            <BrandLogo
              alt={t("شعار صادوه!")}
              className="main-menu-logo"
              draggable={false}
            />
            <h1 className="main-menu-title-fallback">{""+t("صادوه!")+""}</h1>
            <p className="main-menu-tagline">
              {" "+t("ورق، سوالف، وشوية خداع.")+" "}</p>
          </div>

          {/* ترحيب فهد */}
          <div className="abu-fahad-welcome">
            <img
              src="./assets/abu-fahad.svg"
              alt={t("فهد")}
              className="abu-fahad-welcome__img"
              draggable={false}
            />
            <div className="abu-fahad-welcome__bubble">
              <strong>{""+t("حيّ الله الربع.")+""}</strong><br/>{""+t("خلّص ورقك قبلهم. وإذا شكّيت في واحد… صادوه!")+" "}</div>
          </div>

          {tr(!showSetupBox ? (
            <div className="main-menu-actions"><p className="menu-section-label">{""+t("على الطاولة")+""}</p>
              <button
                type="button"
                className="btn-menu btn-menu--warm"
                onClick={() => setShowSetupBox(true)}
              >
                {" "+t("العب المحلي — تدرّب لحالك")+" "}</button>

              <button
                type="button"
                className="btn-menu btn-menu--primary"
                onClick={onOpenMultiplayer}
              >
                {" "+t("اجمع الربع ←")+" "}</button>

              <div className="main-menu-subgrid">
                <button
                  type="button"
                  className="btn-menu btn-menu--warm"
                  onClick={onOpenHowToPlay}
                >
                  {" "+t("كيف نلعب؟")+" "}</button>

                <button
                  type="button"
                  className="btn-menu btn-menu--warm"
                  onClick={onOpenSettings}
                >
                  {" "+t("الإعدادات")+" "}</button>
              </div>

              <button
                type="button"
                className="btn-menu btn-menu--accent"
                onClick={onStartTutorial}
              >
                {" "+t("أول مرة؟ نجربها سوا")+" "}</button>
              <button type="button" className="btn-menu btn-menu--secondary" onClick={onOpenParty}>{""+t("العب مع بعض")+""}</button>
              <button type="button" className="btn-menu btn-menu--warm" onClick={onOpenPassPhone}>{""+t("العب من جوال واحد")+""}</button>
              <div className="main-menu-subgrid"><button className="btn-menu btn-menu--warm" onClick={onOpenAccount}>{accountName||t("تسجيل الدخول")}</button><button className="btn-menu btn-menu--accent" onClick={onOpenCustomize}>{""+t("تخصيص الواجهة")+""}</button></div>
              <InstallButton/>
            </div>
          ) : (
            <div className="singleplayer-setup-panel">
              <h3>{""+t("إعداد جلسة اللعب ضد الكمبيوتر")+""}</h3>

              <label className="form-field">
                <span>{""+t("اسمك على الطاولة:")+""}</span>
                <input
                  type="text"
                  value={playerName}
                  maxLength={20}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={t("اكتب اسمك...")}
                />
              </label>

              <div className="form-field">
                <span>{""+t("عدد اللاعبين الإجمالي على الطاولة (")+""}{tr(botCount + 1)} {" "+t("لاعبين):")+""}</span>
                <div className="player-count-chips">
                  {tr([2, 3, 4, 5, 6, 7].map((bCount) => (
                    <button
                      key={bCount}
                      type="button"
                      className={`count-chip ${botCount === bCount ? 'is-active' : ''}`}
                      onClick={() => setBotCount(bCount)}
                    >
                      {tr(bCount + 1)} {" "+t("لاعبين")+" "}</button>
                  )))}
                </div>
              </div>

              <div className="form-field">
                <span>{""+t("مستوى الصعوبة:")+""}</span>
                <div className="segmented-control">
                  {tr((
                    [
                      { id: 'easy', label: t("سهل (مبتدئ)") },
                      { id: 'medium', label: t("متوسط (متوازن)") },
                      { id: 'hard', label: t("صعب (محترفين)") },
                    ] as Array<{ id: BotDifficulty; label: string }>
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`seg-btn ${difficulty === d.id ? 'is-active' : ''}`}
                      onClick={() => setDifficulty(d.id)}
                    >
                      {tr(d.label)}
                    </button>
                  )))}
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
                      playerName.trim() || t("سلطان")
                    )
                  }
                >
                   {" "+t("ابدأ الجلسة الآن!")+" "}</button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowSetupBox(false)}
                >
                  {" "+t("رجوع")+" "}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
