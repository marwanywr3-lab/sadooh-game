import {t,fmt,tr} from './i18n/translate';
import {LanguageToggle,useLanguage} from './i18n/Language';
import {BrandNavigationContext} from './components/Theme';
import {AccountPanel} from './components/AccountPanel';
import {accountClient,accountRequest,type Account} from './services/account';
import {PassPhoneScreen} from './screens/PassPhoneScreen';
import {PartyScreen} from './screens/PartyScreen';
import {ThemeContext} from './components/Theme';
import React, { useEffect, useState } from 'react';
import { BotDifficulty } from './types/game';
import {
  loadUserSettings,
  saveUserSettings,
  UserSettings,
} from './services/storage/localSettings';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { MultiplayerLobbyScreen } from './screens/MultiplayerLobbyScreen';
import { GameTableScreen } from './screens/GameTableScreen';
import { HowToPlayModal } from './components/HowToPlayModal';
import { SettingsModal } from './components/SettingsModal';

type ActiveScreen = 'menu' | 'tutorial' | 'game' | 'multiplayer' | 'party' | 'passphone';

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());

  useEffect(()=>{const refresh=()=>setSettings(loadUserSettings());window.addEventListener('sadooh-settings',refresh);return()=>window.removeEventListener('sadooh-settings',refresh);},[]);

  // Open the menu immediately; local play never waits for account or network checks.
  const [screen, setScreen] = useState<ActiveScreen>(() => {
    if(/^[a-f0-9]{32}$/i.test(new URLSearchParams(location.search).get('room')||''))return 'multiplayer';
    return 'menu';
  });



  const [matchConfig, setMatchConfig] = useState<{
    botCount: number;
    difficulty: BotDifficulty;
    playerName: string;
    guided?: boolean;
  }>({
    botCount: settings.defaultBotCount,
    difficulty: settings.defaultDifficulty,
    playerName: settings.playerName,
  });

  const [account,setAccount]=useState<Account|null>(null);
  const {language}=useLanguage();
  const appearance={background:settings.background,position:settings.buttonPosition};
  const [accountOpen,setAccountOpen]=useState(false),[passwordRecovery,setPasswordRecovery]=useState(false);
  const refreshAccount=async()=>{try{const session=(await accountClient.auth.getSession()).data.session;if(session&&!session.user.is_anonymous){try{setAccount(await accountRequest());}catch{/* A brief network interruption must not unmount a running local game. Server actions still validate the session. */}}else setAccount(null);}catch{/* Account checks must not block local play. */}};
  useEffect(()=>{void refreshAccount();const sub=accountClient.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){setPasswordRecovery(true);setAccountOpen(true);}setTimeout(()=>{void refreshAccount();},0);});const timer=setInterval(()=>{void refreshAccount();},60000);return()=>{sub.data.subscription.unsubscribe();clearInterval(timer);};},[]);
  useEffect(()=>{if(account?.username&&!loadUserSettings().tutorialCompleted){setSettings(saveUserSettings({tutorialCompleted:true}));}},[account?.username]);
  const onlineAllowed=!!account?.username;
  const [partyJoin,setPartyJoin]=useState(new URLSearchParams(location.search).get('party')==='1');
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', settings.darkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.darkMode ? '#181d1a' : '#f6f3e9');
  }, [settings.darkMode]);

  const goHome=()=>{
    setScreen('menu');setAccountOpen(false);setIsSettingsOpen(false);setIsHowToPlayOpen(false);
    const url=new URL(window.location.href);url.searchParams.delete('room');url.searchParams.delete('party');window.history.replaceState(null,'',url);
  };

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

  const handleStartGuidedPractice = () => {
    handleUpdateSettings({ tutorialCompleted: true });
    setMatchConfig({botCount:2,difficulty:'easy',playerName:settings.playerName,guided:true});
    setScreen('game');
  };

  return (
    <ThemeContext.Provider value={{dark:settings.darkMode,toggle:()=>handleUpdateSettings({darkMode:!settings.darkMode})}}>
    <BrandNavigationContext.Provider value={{onHome:goHome}}><div
      className={`sadooh-app-root ${settings.reduceMotion ? 'reduce-motion' : ''}`}
      data-pro-position={appearance.position}
      style={appearance.background?{['--pro-background' as string]:appearance.background}:undefined}
      dir={language==='ar'?'rtl':'ltr'}
      lang={language}
    >
      <LanguageToggle/>
      {tr(screen === 'menu' && (
        <MainMenuScreen
          settings={settings}
          onStartSinglePlayer={handleStartSinglePlayer}
          onOpenMultiplayer={() => {setPartyJoin(false);setScreen('multiplayer');}}
          onOpenParty={()=>setScreen('party')}
          onOpenPassPhone={()=>setScreen('passphone')}
          onOpenAccount={()=>{setAccountOpen(true);}}
          onOpenCustomize={()=>setIsSettingsOpen(true)}
          accountName={account?.username}
          onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onStartTutorial={() => setScreen('tutorial')}
        />
      ))}

      {tr(screen === 'tutorial' && (
        <TutorialScreen
          onCompleteTutorial={handleFinishOrSkipTutorial}
          onSkipTutorial={handleFinishOrSkipTutorial}
          onStartPractice={handleStartGuidedPractice}
        />
      ))}

      {tr(screen === 'passphone'&&<PassPhoneScreen onBack={goHome}/>)}
      {tr(screen === 'party'&&onlineAllowed&&<PartyScreen onBack={goHome} onJoin={()=>{setPartyJoin(true);setScreen('multiplayer');}}/>)}

      {tr(screen === 'multiplayer' && onlineAllowed && (
        <MultiplayerLobbyScreen
          joinOnly={partyJoin}
          initialPlayerName={account?.username||settings.playerName}
          onBackToMenu={goHome}
          onPlayLocalWithSetup={(botCount, difficulty, playerName) =>
            handleStartSinglePlayer(botCount, difficulty, playerName)
          }
        />
      ))}

      {tr(screen === 'game' && (
        <GameTableScreen
          humanPlayerName={matchConfig.playerName}
          botCount={matchConfig.botCount}
          botDifficulty={matchConfig.difficulty}
          guided={matchConfig.guided}
          onExitToMenu={goHome}
          onRecordMatchEnd={(humanWon) => {
            if (matchConfig.guided) return;
            handleUpdateSettings({
              matchesPlayed: settings.matchesPlayed + 1,
              matchesWon: settings.matchesWon + (humanWon ? 1 : 0),
            });
          }}
        />
      ))}

      {tr(((!onlineAllowed&&(screen==='multiplayer'||screen==='party'))||accountOpen)&&<div className="account-backdrop"><AccountPanel key={account?.username?'signed':'guest'} account={account} recoveryMode={passwordRecovery} onRefresh={refreshAccount} onClose={()=>{setAccountOpen(false);if(!onlineAllowed)setScreen('menu');}}/></div>)}
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
    </div></BrandNavigationContext.Provider>
    </ThemeContext.Provider>
  );
}
