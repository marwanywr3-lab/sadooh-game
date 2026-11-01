import { BotDifficulty } from '../../types/game';

export interface UserSettings {
  language: 'ar'|'en';
  turnDurationSeconds:number;
  background:string;
  buttonPosition:'bottom'|'top'|'left'|'right';
  soundEnabled: boolean;
  soundVolume: number;
  playerName: string;
  defaultBotCount: number; // 2..7 (إجمالي 3..8 لاعبين)
  defaultDifficulty: BotDifficulty;
  darkMode: boolean;
  reduceMotion: boolean;
  tutorialCompleted: boolean;
  matchesPlayed: number;
  matchesWon: number;
}

const STORAGE_KEY = 'sadooh_estiraha_settings_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  language:'ar',turnDurationSeconds:30,background:'',buttonPosition:'bottom',
  soundEnabled: true,
  soundVolume: 0.35,
  playerName: 'سلطان',
  defaultBotCount: 3, // 4 لاعبين على الطاولة افتراضيًا
  defaultDifficulty: 'medium',
  darkMode: false,
  reduceMotion: false,
  tutorialCompleted: false,
  matchesPlayed: 0,
  matchesWon: 0,
};

export function loadUserSettings(): UserSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    parsed.language=parsed.language==='en'?'en':'ar';
    parsed.turnDurationSeconds=typeof parsed.turnDurationSeconds==='number'&&Number.isFinite(parsed.turnDurationSeconds)?Math.max(30,Math.min(180,Math.round(parsed.turnDurationSeconds))):30;
    parsed.background=/^#[0-9a-fA-F]{6}$/.test(parsed.background)?parsed.background:'';
    parsed.buttonPosition=['bottom','top','left','right'].includes(parsed.buttonPosition)?parsed.buttonPosition:'bottom';
    parsed.soundEnabled = typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true;
    parsed.soundVolume = typeof parsed.soundVolume === 'number' && Number.isFinite(parsed.soundVolume) ? Math.max(0,Math.min(1,parsed.soundVolume)) : 0.35;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveUserSettings(next: Partial<UserSettings>): UserSettings {
  const current = loadUserSettings();
  const merged: UserSettings = {
    ...current,
    ...next,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // تجاهل أخطاء التخزين في البيئات المقيدة
  }
  window.dispatchEvent(new Event('sadooh-settings'));
  return merged;
}
