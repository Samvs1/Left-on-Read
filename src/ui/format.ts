/**
 * Locale-aware formatting. All chat timestamps are naive wall-clock times
 * stored as UTC, so every date formatter uses timeZone: 'UTC'.
 */
import { getLang, locale } from '../i18n';

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
function nf(key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const k = `n|${locale()}|${key}`;
  let f = cache.get(k) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(locale(), opts);
    cache.set(k, f);
  }
  return f;
}
function df(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `d|${locale()}|${key}`;
  let f = cache.get(k) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', ...opts });
    cache.set(k, f);
  }
  return f;
}

export const fmtNum = (n: number, digits = 0) => nf(`num${digits}`, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
export const fmtFixed = (n: number, digits = 1) => nf(`fix${digits}`, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
export const fmtCompact = (n: number) =>
  Math.abs(n) < 10_000 ? fmtNum(n) : nf('compact', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const fmtPct = (x: number, digits?: number) => {
  const d = digits ?? (Math.abs(x) < 0.1 && x !== 0 ? 1 : 0);
  return nf(`pct${d}`, { style: 'percent', maximumFractionDigits: d, minimumFractionDigits: 0 }).format(x);
};
/** "1.6×" */
export const fmtTimes = (x: number) => `${fmtFixed(x, x >= 10 ? 0 : 1)}×`;

function unit(n: number, u: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year', display: 'short' | 'long' = 'short') {
  return nf(`u${u}${display}`, { style: 'unit', unit: u, unitDisplay: display, maximumFractionDigits: 0 }).format(n);
}

/** Human duration: 42 sec · 3 min · 1 hr 20 min · 4 days · 3 weeks · 5 months · 2 years. */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '–';
  const s = ms / 1000;
  if (s < 60) return unit(Math.max(1, Math.round(s)), 'second');
  const min = s / 60;
  if (min < 60) return unit(Math.round(min), 'minute');
  const h = min / 60;
  if (h < 24) {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm > 0 && hh < 10 ? `${unit(hh, 'hour')} ${unit(mm, 'minute')}` : unit(Math.round(h), 'hour');
  }
  const d = h / 24;
  if (d < 14) return unit(Math.round(d), 'day', 'long');
  if (d < 60) return unit(Math.round(d / 7), 'week', 'long');
  if (d < 365 * 1.5) return unit(Math.round(d / 30.44), 'month', 'long');
  return unit(Math.round(d / 365.25), 'year', 'long');
}

export const fmtDate = (ts: number) => df('date', { day: 'numeric', month: 'long', year: 'numeric' }).format(ts);
export const fmtDateShort = (ts: number) => df('dateShort', { day: 'numeric', month: 'short', year: 'numeric' }).format(ts);
export const fmtDayMonth = (ts: number) => df('dayMonth', { day: 'numeric', month: 'short' }).format(ts);
export const fmtWeekdayDate = (ts: number) => df('wdate', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(ts);
export const fmtMonth = (ts: number) => df('month', { month: 'long', year: 'numeric' }).format(ts);
export const fmtMonthShort = (ts: number) => df('monthShort', { month: 'short', year: '2-digit' }).format(ts);
export const fmtMonthName = (ts: number) => df('monthName', { month: 'long' }).format(ts);
export const fmtMonthNarrow = (ts: number) => df('monthNarrow', { month: 'narrow' }).format(ts);
export const fmtTime = (ts: number) => df('time', { hour: '2-digit', minute: '2-digit' }).format(ts);
export const fmtDateTime = (ts: number) => df('dt', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ts);

/** "Mar 14 – Apr 2, 2024"; a single day collapses to "Mar 14, 2024". */
export function fmtDateRange(a: number, b: number, long = false): string {
  const f = long ? df('date', { day: 'numeric', month: 'long', year: 'numeric' }) : df('dateShort', { day: 'numeric', month: 'short', year: 'numeric' });
  return b > a ? f.formatRange(a, b) : f.format(a);
}

/** "Mar–Aug 2023" or "Nov 2022 – Feb 2023". */
export function fmtMonthRange(a: number, b: number): string {
  const fa = new Date(a);
  const fb = new Date(b - 1);
  const sameYear = fa.getUTCFullYear() === fb.getUTCFullYear();
  const m = df('mshort', { month: 'short' });
  if (sameYear) {
    if (fa.getUTCMonth() === fb.getUTCMonth()) return fmtMonth(a);
    return `${m.format(a)}–${m.format(b - 1)} ${fb.getUTCFullYear()}`;
  }
  return `${m.format(a)} ${fa.getUTCFullYear()} – ${m.format(b - 1)} ${fb.getUTCFullYear()}`;
}

/** 0–23 → "21:00" / "9 PM" depending on locale. */
export function fmtHour(h: number): string {
  return df('hour', { hour: 'numeric', minute: '2-digit' }).format(Date.UTC(2024, 0, 1, h, 0));
}
export function fmtHourShort(h: number): string {
  return df('hourShort', { hour: 'numeric' }).format(Date.UTC(2024, 0, 1, h, 0));
}

/** Monday-first weekday names. */
export function weekdayName(i: number, style: 'long' | 'short' | 'narrow' = 'long'): string {
  // 2024-01-01 was a Monday
  return df(`wd${style}`, { weekday: style }).format(Date.UTC(2024, 0, 1 + i));
}

export function listFormat(items: string[]): string {
  try {
    return new Intl.ListFormat(locale(), { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

export const isDutch = () => getLang() === 'nl';
