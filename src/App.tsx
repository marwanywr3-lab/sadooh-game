import React, { useEffect, useState } from 'react';
import { BotDifficulty } from './types/game';
import {
  loadUserSettings,
  saveUserSettings,
  UserSettings,
} from './services/storage/localSettings';
import { soundManager } from './services/audio/soundEffects';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { MultiplayerLobbyScreen } from './screens/MultiplayerLobbyScreen';
import { GameTableScreen } from './screens/GameTableScreen';
import { HowToPlayModal } from './components/HowToPlayModal';
import { SettingsModal } from './components/SettingsModal';

type ActiveScreen = 'menu' | 'tutorial' | 'game' | 'multiplayer';

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());

  // عند أول تشغيل، اعرض الجولة التعليمية التفاعلية مع «أبو فهد» تلقائيًا (مع إمكانية تخطيها فورًا)
  const [screen, setScreen] = useState<ActiveScreen>(() => {
    const initial = loadUserSettings();
    return initial.tutorialCompleted ? 'menu' : 'tutorial';
  });

  const [matchConfig, setMatchConfig] = useState<{
    botCount: number;
    difficulty: BotDifficulty;
    playerName: string;
  }>({
    botCount: settings.defaultBotCount,
    difficulty: settings.defaultDifficulty,
    playerName: settings.playerName,
  });

  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    soundManager.setEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  const handleUpdateSettings = (partial: Partial<UserSettings>) => {
    const updated = saveUserSettings(partial);
    setSettings(updated);
  };

  const handleStartSinglePlayer = (
    botCount: number,
    difficulty: BotDifficulty,
    playerName: string
  ) => {
    handleUpdateSettings({
      playerName,
      defaultBotCount: botCount,
      defaultDifficulty: difficulty,
    });
    setMatchConfig({ botCount, difficulty, playerName });
    setScreen('game');
  };

  const handleFinishOrSkipTutorial = () => {
    handleUpdateSettings({ tutorialCompleted: true });
    setScreen('menu');
  };

  return (
    <div
      className={`sadooh-app-root ${settings.reduceMotion ? 'reduce-motion' : ''}`}
      dir="rtl"
      lang="ar"
    >
      {screen === 'menu' && (
        <MainMenuScreen
          settings={settings}
          onStartSinglePlayer={handleStartSinglePlayer}
          onOpenMultiplayer={() => setScreen('multiplayer')}
          onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onStartTutorial={() => setScreen('tutorial')}
        />
      )}

      {screen === 'tutorial' && (
        <TutorialScreen
          onCompleteTutorial={handleFinishOrSkipTutorial}
          onSkipTutorial={handleFinishOrSkipTutorial}
        />
      )}

      {screen === 'multiplayer' && (
        <MultiplayerLobbyScreen
          initialPlayerName={settings.playerName}
          onBackToMenu={() => setScreen('menu')}
          onPlayLocalWithSetup={(botCount, difficulty, playerName) =>
            handleStartSinglePlayer(botCount, difficulty, playerName)
          }
        />
      )}

      {screen === 'game' && (
        <GameTableScreen
          humanPlayerName={matchConfig.playerName}
          botCount={matchConfig.botCount}
          botDifficulty={matchConfig.difficulty}
          onExitToMenu={() => setScreen('menu')}
          onRecordMatchEnd={(humanWon) => {
            handleUpdateSettings({
              matchesPlayed: settings.matchesPlayed + 1,
              matchesWon: settings.matchesWon + (humanWon ? 1 : 0),
            });
          }}
        />
      )}

      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
        onStartTutorial={() => {
          setIsHowToPlayOpen(false);
          setScreen('tutorial');
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
