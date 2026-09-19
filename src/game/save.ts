/** Local persistence (per browser). Levels are keyed by id so reordering files doesn't corrupt saves. */

export interface LevelProgress {
  done: boolean;
  /** Fewest moves in a finished run. */
  best: number | null;
  stars: number;
}

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface SaveData {
  version: 1;
  levels: Record<string, LevelProgress>;
  settings: { theme: ThemeChoice; sound: boolean; seenHelp: boolean; lastLevel: string | null };
}

const KEY = 'flock:v1';

const defaults = (): SaveData => ({
  version: 1,
  levels: {},
  settings: { theme: 'system', sound: true, seenHelp: false, lastLevel: null },
});

export const emptyProgress = (): LevelProgress => ({ done: false, best: null, stars: 0 });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1) return defaults();
    return { ...defaults(), ...data, settings: { ...defaults().settings, ...data.settings } };
  } catch {
    return defaults();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, quota): the game still works for this session.
  }
}
