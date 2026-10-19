import { BotDifficulty } from '../../types/game';

export interface UserSettings {
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
    delete parsed.soundEnabled;
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
  return merged;
}
