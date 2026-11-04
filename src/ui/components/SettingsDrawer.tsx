import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { SETTINGS_LIMITS } from '../../engine/settings';
import { resetSettings, setAnonymize, setDateOrder, setState, updateSettings, useStore } from '../store';
import { Sheet, Slider, Toggle } from './controls';
import { fmtDuration } from '../format';

const DAY = 86_400_000;
const isoDate = (ts: number) => new Date(ts).toISOString().slice(0, 10);

/** Non-linear slider positions for durations (minutes). */
const GAP_STEPS = [30, 45, 60, 90, 120, 180, 240, 360, 480, 600, 720, 960, 1440, 2160, 2880];
const GHOST_STEPS = [60, 120, 180, 360, 720, 1080, 1440, 2160, 2880, 4320, 7200, 10080];
const DOUBLE_STEPS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 720, 1440];
const REVIVE_STEPS = [12, 24, 36, 48, 72, 96, 120, 168, 240, 336, 504, 720];

function StepSlider({ label, hint, steps, value, onChange, unit }: { label: string; hint: string; steps: number[]; value: number; onChange: (v: number) => void; unit: 'min' | 'h' }) {
  const idx = steps.reduce((best, s, i) => (Math.abs(s - value) < Math.abs(steps[best]! - value) ? i : best), 0);
  return (
    <Slider
      label={label}
      hint={hint}
      min={0}
      max={steps.length - 1}
      value={idx}
      onChange={(i) => onChange(steps[i]!)}
      format={(i) => fmtDuration(steps[i]! * (unit === 'min' ? 60_000 : 3_600_000))}
    />
  );
}

export function SettingsDrawer() {
  const t = useT();
  const s = useStore((x) => x.settings);
  const chat = useStore((x) => x.chat);
  const anon = useStore((x) => x.anonymize);
  const dateOrder = useStore((x) => x.dateOrder);
  const [stop, setStop] = useState(s.stopwords.join(', '));
  const [firsts, setFirsts] = useState(s.firstsWords.join(', '));
  useEffect(() => setStop(s.stopwords.join(', ')), [s.stopwords]);
  useEffect(() => setFirsts(s.firstsWords.join(', ')), [s.firstsWords]);
  const first = chat?.summary.firstTs ?? 0;
  const last = chat?.summary.lastTs ?? 0;
  const ranges: [string, number | null, number | null][] = [
    [t('settings.rangeAll'), null, null],
    [t('settings.range12'), last - 365 * DAY, null],
    [t('settings.range3'), last - 91 * DAY, null],
    [t('settings.rangeYear'), Date.UTC(new Date(last).getUTCFullYear(), 0, 1), null],
  ];
  const close = () => setState({ settingsOpen: false });
  const split = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  return (
    <Sheet open onClose={close} title={t('settings.title')}>
      <p className="mb-2 text-sm text-muted">{t('settings.subtitle')}</p>
      <div className="divide-y divide-line">
        <div className="pb-3">
          <Toggle checked={anon} onChange={setAnonymize} label={t('common.anonymous')} hint={t('common.anonymousHint')} />
        </div>
        <fieldset className="py-3">
          <legend className="mb-2 text-[0.95rem] font-semibold">{t('settings.range')}</legend>
          <div className="mb-3 flex flex-wrap gap-2">
            {ranges.map(([label, a, b]) => {
              const on = (s.dateStart ?? null) === (a !== null ? Math.max(first, a) : null) && (s.dateEnd ?? null) === b;
              return (
                <button
                  key={label}
                  type="button"
                  className={`chip ${on ? '!border-brand !bg-brand-soft !text-brand' : ''}`}
                  aria-pressed={on}
                  onClick={() => updateSettings({ dateStart: a !== null ? Math.max(first, a) : null, dateEnd: b })}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink-2">{t('settings.from')}</span>
              <input
                type="date"
                className="field"
                min={first ? isoDate(first) : undefined}
                max={last ? isoDate(last) : undefined}
                value={s.dateStart ? isoDate(s.dateStart) : ''}
                onChange={(e) => updateSettings({ dateStart: e.target.value ? Date.parse(`${e.target.value}T00:00:00Z`) : null })}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink-2">{t('settings.to')}</span>
              <input
                type="date"
                className="field"
                min={first ? isoDate(first) : undefined}
                max={last ? isoDate(last) : undefined}
                value={s.dateEnd ? isoDate(s.dateEnd - DAY) : ''}
                onChange={(e) => updateSettings({ dateEnd: e.target.value ? Date.parse(`${e.target.value}T00:00:00Z`) + DAY : null })}
              />
            </label>
          </div>
        </fieldset>
        <div className="py-2">
          <StepSlider label={t('settings.gap')} hint={t('settings.gapHint')} steps={GAP_STEPS} value={s.conversationGapMinutes} unit="min" onChange={(v) => updateSettings({ conversationGapMinutes: v })} />
          <StepSlider label={t('settings.ghost')} hint={t('settings.ghostHint')} steps={GHOST_STEPS} value={s.ghostingThresholdMinutes} unit="min" onChange={(v) => updateSettings({ ghostingThresholdMinutes: v })} />
          <StepSlider label={t('settings.double')} hint={t('settings.doubleHint')} steps={DOUBLE_STEPS} value={s.doubleTextMinutes} unit="min" onChange={(v) => updateSettings({ doubleTextMinutes: v })} />
          <StepSlider label={t('settings.revive')} hint={t('settings.reviveHint')} steps={REVIVE_STEPS} value={s.reviveThresholdHours} unit="h" onChange={(v) => updateSettings({ reviveThresholdHours: v })} />
          {chat?.summary.isGroup && (
            <Slider
              label={t('settings.others')}
              hint={t('settings.othersHint')}
              min={SETTINGS_LIMITS.othersThresholdPct.min}
              max={10}
              step={0.5}
              value={s.othersThresholdPct}
              onChange={(v) => updateSettings({ othersThresholdPct: v })}
              format={(v) => `${v}%`}
            />
          )}
        </div>
        <div className="py-3">
          <label className="block">
            <span className="text-[0.95rem] font-semibold">{t('settings.timezone')}</span>
            <select className="field mt-1.5" value={s.timezoneOffsetHours} onChange={(e) => updateSettings({ timezoneOffsetHours: Number(e.target.value) })}>
              {Array.from({ length: 29 }, (_, i) => i - 14).map((h) => (
                <option key={h} value={h}>
                  {h === 0 ? '±0 h' : `${h > 0 ? '+' : '−'}${Math.abs(h)} h`}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-sm text-muted">{t('settings.timezoneHint')}</span>
          </label>
        </div>
        <div className="py-3">
          <Toggle checked={s.includeMedia} onChange={(v) => updateSettings({ includeMedia: v })} label={t('settings.media')} />
          <Toggle checked={s.includeSystem} onChange={(v) => updateSettings({ includeSystem: v })} label={t('settings.system')} />
        </div>
        <div className="space-y-4 py-4">
          <label className="block">
            <span className="text-[0.95rem] font-semibold">{t('settings.stopwords')}</span>
            <input className="field mt-1.5" value={stop} onChange={(e) => setStop(e.target.value)} onBlur={() => updateSettings({ stopwords: split(stop) })} placeholder="haha, lol, oke" />
            <span className="mt-1 block text-sm text-muted">{t('settings.stopwordsHint')}</span>
          </label>
          <label className="block">
            <span className="text-[0.95rem] font-semibold">{t('settings.firsts')}</span>
            <input className="field mt-1.5" value={firsts} onChange={(e) => setFirsts(e.target.value)} onBlur={() => updateSettings({ firstsWords: split(firsts) })} />
            <span className="mt-1 block text-sm text-muted">{t('settings.firstsHint')}</span>
          </label>
          <label className="block">
            <span className="text-[0.95rem] font-semibold">{t('settings.dateOrder')}</span>
            <select className="field mt-1.5" value={dateOrder} onChange={(e) => void setDateOrder(e.target.value as 'auto')}>
              <option value="auto">{t('settings.auto')}{chat ? ` (${chat.summary.dateOrder})` : ''}</option>
              <option value="DMY">DD/MM/YYYY</option>
              <option value="MDY">MM/DD/YYYY</option>
              <option value="YMD">YYYY-MM-DD</option>
            </select>
            <span className="mt-1 block text-sm text-muted">{t('settings.dateOrderHint')}</span>
          </label>
        </div>
        <div className="pt-4">
          <button type="button" className="btn btn-ghost w-full" onClick={resetSettings}>
            {t('settings.reset')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
