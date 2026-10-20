import {BrandLogo,ProBrandContext} from './components/Theme';
import {AccountPanel} from './components/AccountPanel';
import {accountClient,accountRequest,proSettings,type Account} from './services/account';
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

  // عند أول تشغيل، اعرض الجولة التعليمية التفاعلية مع «أبو فهد» تلقائيًا (مع إمكانية تخطيها فورًا)
  const [screen, setScreen] = useState<ActiveScreen>(() => {
    if(/^[a-f0-9]{32}$/i.test(new URLSearchParams(location.search).get('room')||''))return 'multiplayer';
    const initial = loadUserSettings();
    return initial.tutorialCompleted ? 'menu' : 'tutorial';
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
  const [previewPrefs,setPreviewPrefs]=useState<{background:string;position:string}|null>(null);
  const appearance=account?.isPro?(previewPrefs||account.prefs):{};
  const [enforced,setEnforced]=useState(true);
  const [checkingAccount,setCheckingAccount]=useState(true);
  const [accountOpen,setAccountOpen]=useState(false),[proOpen,setProOpen]=useState(false),[passwordRecovery,setPasswordRecovery]=useState(false);
  const refreshAccount=async()=>{try{const session=(await accountClient.auth.getSession()).data.session;if(session&&!session.user.is_anonymous){try{setAccount(await accountRequest());}catch{/* A brief network interruption must not unmount a running local game. Server actions still validate the session. */}}else setAccount(null);}finally{setCheckingAccount(false);}};
  useEffect(()=>{void proSettings().then(s=>setEnforced(!!s.subscriptionsEnabled)).catch(()=>{});void refreshAccount();const sub=accountClient.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){setPasswordRecovery(true);setAccountOpen(true);}setTimeout(()=>{void refreshAccount();},0);});const timer=setInterval(()=>{void refreshAccount();},60000);return()=>{sub.data.subscription.unsubscribe();clearInterval(timer);};},[]);
  useEffect(()=>{if(account?.username&&!loadUserSettings().tutorialCompleted){setSettings(saveUserSettings({tutorialCompleted:true}));}},[account?.username]);
  const onlineAllowed=(!enforced||!!account?.username);
  const openPro=()=>{setProOpen(true);setAccountOpen(true);};
  const [partyJoin,setPartyJoin]=useState(new URLSearchParams(location.search).get('party')==='1');
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', settings.darkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.darkMode ? '#181d1a' : '#f6f3e9');
  }, [settings.darkMode]);

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

  if(!account?.username)return <ThemeContext.Provider value={{dark:settings.darkMode,toggle:()=>handleUpdateSettings({darkMode:!settings.darkMode})}}><main className="entry-screen" dir="rtl" lang="ar"><BrandLogo alt="صادوه!"/><p>حيّاك في صادوه. سجّل مرة، وبعدها تدخل على طول.</p>{checkingAccount?<p role="status">جاري فتح حسابك…</p>:<AccountPanel entryMode account={account} onPreview={setPreviewPrefs} enforced={enforced} recoveryMode={passwordRecovery} onRefresh={refreshAccount} onClose={()=>{}}/>}</main></ThemeContext.Provider>;
  return (
    <ThemeContext.Provider value={{dark:settings.darkMode,toggle:()=>handleUpdateSettings({darkMode:!settings.darkMode})}}>
    <ProBrandContext.Provider value={!!account?.isPro}><div
      className={`sadooh-app-root ${settings.reduceMotion ? 'reduce-motion' : ''}`}
      data-pro-position={account?.isPro?appearance.position:undefined}
      style={account?.isPro&&appearance.background?{['--pro-background' as string]:appearance.background,['--ui-page' as string]:appearance.background}:undefined}
      dir="rtl"
      lang="ar"
    >
      {screen === 'menu' && (
        <MainMenuScreen
          settings={settings}
          onStartSinglePlayer={handleStartSinglePlayer}
          onOpenMultiplayer={() => {setPartyJoin(false);setScreen('multiplayer');}}
          onOpenParty={()=>setScreen('party')}
          onOpenPassPhone={()=>setScreen('passphone')}
          onOpenAccount={()=>{setProOpen(false);setAccountOpen(true);}}
          onOpenPro={openPro}
          accountName={account?.username}
          onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onStartTutorial={() => setScreen('tutorial')}
        />
      )}

      {screen === 'tutorial' && (
        <TutorialScreen
          onCompleteTutorial={handleFinishOrSkipTutorial}
          onSkipTutorial={handleFinishOrSkipTutorial}
          onStartPractice={handleStartGuidedPractice}
        />
      )}

      {screen === 'passphone'&&<PassPhoneScreen onBack={()=>setScreen('menu')}/>}
      {screen === 'party'&&onlineAllowed&&<PartyScreen onBack={()=>setScreen('menu')} onJoin={()=>{setPartyJoin(true);setScreen('multiplayer');}}/>}

      {screen === 'multiplayer' && onlineAllowed && (
        <MultiplayerLobbyScreen
          joinOnly={partyJoin}
          initialPlayerName={account?.username||settings.playerName}
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
          guided={matchConfig.guided}
          onExitToMenu={() => setScreen('menu')}
          onRecordMatchEnd={(humanWon) => {
            if (matchConfig.guided) return;
            handleUpdateSettings({
              matchesPlayed: settings.matchesPlayed + 1,
              matchesWon: settings.matchesWon + (humanWon ? 1 : 0),
            });
          }}
        />
      )}

      {((!onlineAllowed&&(screen==='multiplayer'||screen==='party'))||accountOpen)&&<div className="account-backdrop"><AccountPanel key={account?.username?'signed':'guest'} account={account} onPreview={setPreviewPrefs} enforced={enforced} recoveryMode={passwordRecovery} initialPro={proOpen} onRefresh={refreshAccount} onClose={()=>{setAccountOpen(false);setPreviewPrefs(null);if(!onlineAllowed)setScreen('menu');}}/></div>}
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
    </div></ProBrandContext.Provider>
    </ThemeContext.Provider>
  );
}
