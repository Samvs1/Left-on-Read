import type { Settings } from './types';

export const DEFAULT_FIRSTS = ['i love you', 'hou van je', 'miss you', 'mis je', 'sorry', 'haha', 'babe', 'schat', 'goodnight', 'welterusten'];

export const DEFAULT_SETTINGS: Settings = {
  conversationGapMinutes: 6 * 60,
  ghostingThresholdMinutes: 24 * 60,
  doubleTextMinutes: 60,
  reviveThresholdHours: 72,
  othersThresholdPct: 2,
  stopwords: [],
  timezoneOffsetHours: 0,
  dateStart: null,
  dateEnd: null,
  includeMedia: true,
  includeSystem: false,
  firstsWords: DEFAULT_FIRSTS,
};

export const SETTINGS_LIMITS = {
  conversationGapMinutes: { min: 30, max: 48 * 60 },
  ghostingThresholdMinutes: { min: 60, max: 7 * 24 * 60 },
  doubleTextMinutes: { min: 5, max: 24 * 60 },
  reviveThresholdHours: { min: 12, max: 30 * 24 },
  othersThresholdPct: { min: 0, max: 20 },
  timezoneOffsetHours: { min: -14, max: 14 },
} as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Fills in defaults and clamps every numeric setting into its supported range. */
export function normalizeSettings(input: Partial<Settings> = {}): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, ...input };
  for (const [k, lim] of Object.entries(SETTINGS_LIMITS) as [keyof typeof SETTINGS_LIMITS, { min: number; max: number }][]) {
    const v = Number(s[k]);
    s[k] = (Number.isFinite(v) ? clamp(v, lim.min, lim.max) : DEFAULT_SETTINGS[k]) as never;
  }
  s.stopwords = (s.stopwords ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean);
  s.firstsWords = (s.firstsWords ?? []).map((w) => w.trim()).filter(Boolean).slice(0, 20);
  if (s.dateStart !== null && !Number.isFinite(s.dateStart)) s.dateStart = null;
  if (s.dateEnd !== null && !Number.isFinite(s.dateEnd)) s.dateEnd = null;
  if (s.dateStart !== null && s.dateEnd !== null && s.dateEnd <= s.dateStart) s.dateEnd = null;
  return s;
}
