// Settings and per-game options in localStorage. Always wrapped in try/catch
// (private mode / blocked storage), and merged with defaults so that data saved
// by an older version never breaks a newer one.

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  theme: Theme;
  sound: boolean;
  /** Last used options per game id, e.g. { 'bee-or-honey': { players: 4, target: 3 } } */
  games: Record<string, Record<string, number>>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  sound: true,
  games: {},
};

const KEY = '2sacrowd:settings:v1';

function isTheme(x: unknown): x is Theme {
  return x === 'auto' || x === 'light' || x === 'dark';
}

export function mergeSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS, games: {} };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (isTheme(r.theme)) out.theme = r.theme;
  if (typeof r.sound === 'boolean') out.sound = r.sound;
  if (r.games && typeof r.games === 'object') {
    for (const [id, opts] of Object.entries(r.games as Record<string, unknown>)) {
      if (!opts || typeof opts !== 'object') continue;
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(opts as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
      }
      out.games[id] = clean;
    }
  }
  return out;
}

export function loadSettings(): Settings {
  try {
    const text = localStorage.getItem(KEY);
    return mergeSettings(text ? JSON.parse(text) : null);
  } catch {
    return mergeSettings(null);
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
