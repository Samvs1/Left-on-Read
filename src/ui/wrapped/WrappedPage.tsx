import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatStats } from '../../engine/types';
import { useLang, useT } from '../../i18n';
import { useStore } from '../store';
import { useNamer } from '../names';
import { go } from '../router';
import { Icon } from '../components/Icon';
import { Footer } from '../components/Footer';
import { deliver } from '../lib/share';
import { fmtDuration, fmtNum } from '../format';
import { prefersReducedMotion } from '../theme';
import {
  ALL_TIME,
  buildWrapped,
  customPeriod,
  defaultPeriod,
  last12Period,
  samePeriod,
  yearPeriod,
  yearsBetween,
  type Period,
  type WrappedData,
} from './data';
import { BAR, buildTimeline, fmtClock, type Timeline } from './timeline';
import { W } from './draw';
import { renderFrame } from './scenes';
import { loadWrappedFonts } from './fonts';
import { renderSoundtrack } from './audio';
import { exportFormat, exportVideo, renderStill, type ExportProgress, type ExportResult } from './encode';

const DAY = 86_400_000;
const isoDay = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const parseDay = (v: string) => {
  const [y, m, d] = v.split('-').map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
};

export function WrappedPage() {
  const t = useT();
  const lang = useLang();
  const chat = useStore((s) => s.chat)!;
  const settings = useStore((s) => s.settings);
  const { name, title, anonymous } = useNamer();
  const { summary } = chat;
  const unfiltered = settings.dateStart === null && settings.dateEnd === null;
  const monthly = unfiltered ? (chat.stats?.time.monthly ?? null) : null;
  const years = useMemo(() => yearsBetween(summary.firstTs, summary.lastTs, monthly), [summary.firstTs, summary.lastTs, monthly]);
  const [period, setPeriod] = useState<Period>(() => defaultPeriod(summary.firstTs, summary.lastTs, monthly));
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [computing, setComputing] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);
  const calm = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => {
    void loadWrappedFonts().then(() => setFontsReady(true));
  }, []);

  // Everything except the dashboard's own date filter carries over.
  const settingsKey = JSON.stringify({ ...settings, dateStart: null, dateEnd: null });
  useEffect(() => {
    let alive = true;
    setComputing(true);
    void (async () => {
      const { engine } = await import('../../worker/client');
      const s = await engine().compute(summary.chatId, { ...settings, dateStart: period.start, dateEnd: period.end });
      if (alive) {
        setStats(s);
        setComputing(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.chatId, period, settingsKey]);

  const nameRef = useRef(name);
  nameRef.current = name;
  const data = useMemo<WrappedData | null>(
    () => (stats ? buildWrapped({ stats, lang, name: (i) => nameRef.current(i), title, period, firstTs: summary.firstTs, lastTs: summary.lastTs }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, lang, anonymous, title],
  );
  const tl = useMemo(() => (data ? buildTimeline(data.scenes, data.awards.length) : null), [data]);
  const sig = data?.year ? `${t('wrapped.name').toUpperCase()} ${data.year}` : t('wrapped.name').toUpperCase();
  const heading = data?.year ? t('wrapped.titleYear', { year: data.year }) : period.kind === 'year' && period.year ? t('wrapped.titleYear', { year: period.year }) : t('wrapped.titleRange');

  return (
    <>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="pt-6">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('dashboard')}>
            <Icon name="arrowLeft" size={16} />
            {t('nav.dashboard')}
          </button>
        </div>
        <header className="mt-6 max-w-3xl">
          <p className="eyebrow">{t('wrapped.eyebrow')}</p>
          <h1 className="mt-2 text-[2.6rem] font-[800] leading-[0.95] sm:text-[3.8rem]">{heading}</h1>
          <p className="mt-3 text-lg text-ink-2">{t('wrapped.subtitle')}</p>
        </header>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
          <section aria-label={t('wrapped.player')} className="mx-auto w-[min(100%,26rem,calc(76vh*9/16))] lg:mx-0">
            {data && tl && fontsReady && !computing ? (
              <Player key={`${tl.duration}-${data.messages}-${data.periodLabel}-${lang}-${anonymous}`} data={data} tl={tl} calm={calm} sig={sig} />
            ) : (
              <div className="relative grid aspect-[9/16] w-full place-items-center overflow-hidden rounded-[2rem] bg-[#0e0b1a] p-8 text-center text-white">
                {computing || !fontsReady ? (
                  <div>
                    <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white motion-reduce:animate-none" aria-hidden="true" />
                    <p className="mt-4 font-semibold" role="status">
                      {t('wrapped.computing')}
                    </p>
                  </div>
                ) : (
                  <p className="text-lg font-semibold">{t('wrapped.notEnough')}</p>
                )}
              </div>
            )}
          </section>

          <div className="min-w-0 space-y-5">
            <PeriodPicker years={years} period={period} onChange={setPeriod} firstTs={summary.firstTs} lastTs={summary.lastTs} />
            {data && tl && <ExportCard key={`${tl.duration}-${data.periodLabel}-${data.messages}-${lang}-${anonymous}`} data={data} tl={tl} sig={sig} />}
            {calm && <p className="text-sm text-muted">{t('wrapped.reducedMotion')}</p>}
            {data && (
              <details className="card p-5">
                <summary className="cursor-pointer font-semibold">{t('wrapped.transcript')}</summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-2">
                  {data.transcript.map((x) => (
                    <li key={x.scene}>{x.text}</li>
                  ))}
                </ol>
              </details>
            )}
            <p className="flex gap-2 text-sm text-muted">
              <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
              {t('wrapped.privacy')}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Period picker                                                        */
/* ------------------------------------------------------------------ */

function PeriodPicker({ years, period, onChange, firstTs, lastTs }: { years: number[]; period: Period; onChange: (p: Period) => void; firstTs: number; lastTs: number }) {
  const t = useT();
  const [custom, setCustom] = useState(period.kind === 'custom');
  const [from, setFrom] = useState(isoDay(period.start ?? firstTs));
  const [to, setTo] = useState(isoDay((period.end ?? lastTs + DAY) - DAY));
  const options: { key: string; label: string; period: Period | null }[] = [
    ...years.map((y) => ({ key: `y${y}`, label: String(y), period: yearPeriod(y) })),
    { key: 'last12', label: t('wrapped.last12'), period: last12Period(lastTs) },
    { key: 'all', label: t('wrapped.allTime'), period: ALL_TIME },
    { key: 'custom', label: t('wrapped.custom'), period: null },
  ];
  return (
    <div className="card p-5">
      <p id="wrapped-period" className="font-semibold">
        {t('wrapped.period')}
      </p>
      <div role="radiogroup" aria-labelledby="wrapped-period" className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = o.period ? !custom && samePeriod(o.period, period) : custom;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={checked}
              className={`chip ${checked ? '!border-brand !bg-brand !text-white' : ''}`}
              onClick={() => {
                if (o.period) {
                  setCustom(false);
                  onChange(o.period);
                } else setCustom(true);
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {custom && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to) onChange(customPeriod(parseDay(from), parseDay(to)));
          }}
        >
          <label className="text-sm font-semibold">
            {t('wrapped.from')}
            <input type="date" className="mt-1 block rounded-xl border border-line bg-surface px-3 py-2 font-normal" min={isoDay(firstTs)} max={isoDay(lastTs)} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            {t('wrapped.to')}
            <input type="date" className="mt-1 block rounded-xl border border-line bg-surface px-3 py-2 font-normal" min={isoDay(firstTs)} max={isoDay(lastTs)} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary btn-sm">
            {t('wrapped.apply')}
          </button>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Player                                                               */
/* ------------------------------------------------------------------ */

interface AudioState {
  ctx: AudioContext;
  gain: GainNode;
  buffer: AudioBuffer | null;
  src: AudioBufferSourceNode | null;
  /** ctx time at which video position 0 would have played. */
  origin: number;
}

function Player({ data, tl, calm, sig }: { data: WrappedData; tl: Timeline; calm: boolean; sig: string }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [sound, setSound] = useState(false);
  const [soundLoading, setSoundLoading] = useState(false);
  const st = useRef({ pos: 0, startedAt: 0, playing: false, raf: 0, lastUi: 0, sound: false, started: false });
  const audio = useRef<AudioState | null>(null);

  const draw = useCallback(
    (time: number) => {
      const c = canvasRef.current;
      const g = c?.getContext('2d');
      if (!c || !g) return;
      const k = c.width / W;
      g.setTransform(k, 0, 0, k, 0, 0);
      renderFrame(g, data, tl, time, { calm, sig });
    },
    [data, tl, calm, sig],
  );

  /** Before the first play we show a settled poster frame instead of an empty first frame. */
  const poster = Math.min(tl.duration, BAR * 2 - 0.05);
  const now = () => performance.now() / 1000;
  const current = () => {
    const s = st.current;
    if (!s.playing) return s.pos;
    const a = audio.current;
    if (s.sound && a?.src) return Math.min(tl.duration, Math.max(0, a.ctx.currentTime - a.origin - (a.ctx.outputLatency || 0)));
    return Math.min(tl.duration, s.pos + (now() - s.startedAt));
  };

  const stopAudio = () => {
    const a = audio.current;
    if (a?.src) {
      try {
        a.src.stop();
      } catch {
        /* already stopped */
      }
      a.src.disconnect();
      a.src = null;
    }
  };
  const startAudio = (from: number) => {
    const a = audio.current;
    stopAudio();
    if (!a?.buffer || !st.current.sound) return;
    void a.ctx.resume();
    const src = a.ctx.createBufferSource();
    src.buffer = a.buffer;
    src.connect(a.gain);
    const when = a.ctx.currentTime + 0.04;
    src.start(when, Math.min(from, a.buffer.duration - 0.01));
    a.src = src;
    a.origin = when - from;
  };

  const loop = () => {
    const s = st.current;
    const p = current();
    draw(p);
    if (performance.now() - s.lastUi > 120) {
      s.lastUi = performance.now();
      setPos(p);
    }
    if (p >= tl.duration - 1e-3) {
      s.playing = false;
      s.pos = tl.duration;
      stopAudio();
      setPlaying(false);
      setPos(tl.duration);
      return;
    }
    s.raf = requestAnimationFrame(loop);
  };

  const play = () => {
    const s = st.current;
    if (s.playing) return;
    if (!s.started || s.pos >= tl.duration - 0.05) s.pos = 0;
    s.started = true;
    s.playing = true;
    s.startedAt = now();
    startAudio(s.pos);
    setPlaying(true);
    cancelAnimationFrame(s.raf);
    s.raf = requestAnimationFrame(loop);
  };
  const pause = () => {
    const s = st.current;
    if (!s.playing) return;
    s.pos = current();
    s.playing = false;
    cancelAnimationFrame(s.raf);
    stopAudio();
    setPlaying(false);
    setPos(s.pos);
    draw(s.pos);
  };
  const seek = (p: number) => {
    const s = st.current;
    s.started = true;
    s.pos = Math.max(0, Math.min(tl.duration, p));
    s.startedAt = now();
    if (s.playing) startAudio(s.pos);
    else draw(s.pos);
    setPos(s.pos);
  };

  const toggleSound = async () => {
    const s = st.current;
    if (s.sound) {
      s.sound = false;
      setSound(false);
      if (s.playing) {
        // Hand the clock back to performance.now() without a jump.
        s.pos = current();
        s.startedAt = now();
      }
      stopAudio();
      return;
    }
    if (!audio.current) {
      const ctx = new AudioContext({ latencyHint: 'playback' });
      const gain = ctx.createGain();
      gain.gain.value = 0.9;
      gain.connect(ctx.destination);
      audio.current = { ctx, gain, buffer: null, src: null, origin: 0 };
    }
    void audio.current.ctx.resume();
    s.sound = true;
    setSound(true);
    if (!audio.current.buffer) {
      setSoundLoading(true);
      try {
        audio.current.buffer = await renderSoundtrack(tl);
      } catch {
        s.sound = false;
        setSound(false);
      } finally {
        setSoundLoading(false);
      }
    }
    if (s.playing && s.sound) {
      s.pos = current();
      s.startedAt = now();
      startAudio(s.pos);
    }
  };

  // Size the canvas to the element (and the screen's pixel density).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const w = Math.min(W, Math.round(c.clientWidth * Math.min(window.devicePixelRatio || 1, 2.5)));
      if (w > 0 && c.width !== w) {
        c.width = w;
        c.height = Math.round((w * 16) / 9);
      }
      draw(st.current.playing ? current() : st.current.started ? st.current.pos : poster);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  // Autoplay (silently) unless the visitor prefers reduced motion, and have
  // the soundtrack ready (it is synthesised in a worker) before anyone asks.
  useEffect(() => {
    if (!calm) play();
    const warm = setTimeout(() => void renderSoundtrack(tl).catch(() => undefined), 700);
    const onHide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearTimeout(warm);
      document.removeEventListener('visibilitychange', onHide);
      cancelAnimationFrame(st.current.raf);
      stopAudio();
      void audio.current?.ctx.close();
      audio.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sceneIdx = (() => {
    let i = 0;
    for (let k = 0; k < tl.scenes.length; k++) if (tl.scenes[k]!.start <= pos + 1e-6) i = k;
    return i;
  })();
  const sceneText = data.transcript.find((x) => x.scene === tl.scenes[sceneIdx]?.id)?.text ?? '';
  const ended = !playing && pos >= tl.duration - 0.05;

  const onKey = (e: React.KeyboardEvent) => {
    // Only the stage itself takes shortcuts; buttons and the slider keep their own keys.
    if (e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      if (st.current.playing) pause();
      else play();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = tl.scenes[sceneIdx + 1];
      seek(next ? next.start + 0.001 : tl.duration);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = tl.scenes[sceneIdx]!;
      seek(pos - cur.start > 1 ? cur.start : (tl.scenes[sceneIdx - 1]?.start ?? 0));
    }
  };

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-[2rem] bg-[#0e0b1a] shadow-[0_30px_80px_-30px_rgba(43,26,158,0.55)] ring-1 ring-black/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand"
        style={{ aspectRatio: '9 / 16' }}
        tabIndex={0}
        onKeyDown={onKey}
        aria-keyshortcuts="Space ArrowLeft ArrowRight"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" role="img" aria-label={`${t('wrapped.player')}. ${sceneText}`} />
        <button
          type="button"
          onClick={() => void toggleSound()}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur hover:bg-black/60"
          aria-pressed={sound}
          aria-label={sound ? t('wrapped.soundOff') : t('wrapped.soundOn')}
        >
          {soundLoading ? (
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Icon name={sound ? 'volume' : 'volumeOff'} size={16} />
          )}
          <span className="hidden sm:inline">{sound ? t('wrapped.soundOff') : t('wrapped.soundOn')}</span>
        </button>
        {(!playing && (!st.current.started || ended)) && (
          <button type="button" onClick={play} className="absolute inset-0 grid place-items-center bg-black/10 focus-visible:outline-none" aria-label={ended ? t('wrapped.restart') : t('wrapped.play')}>
            <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-[#2b1a9e] shadow-2xl transition-transform hover:scale-105">
              <Icon name={ended ? 'refresh' : 'play'} size={34} />
            </span>
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="icon-btn shrink-0" onClick={playing ? pause : play} aria-label={playing ? t('wrapped.pause') : t('wrapped.play')}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <button type="button" className="icon-btn shrink-0" onClick={() => seek(0)} aria-label={t('wrapped.restart')}>
          <Icon name="refresh" />
        </button>
        <input
          type="range"
          className="min-w-0 flex-1 accent-[var(--brand)]"
          min={0}
          max={tl.duration}
          step={0.01}
          value={pos}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t('wrapped.position')}
          aria-valuetext={t('wrapped.timeOf', { a: fmtClock(pos), b: fmtClock(tl.duration) })}
        />
        <span className="tabular w-[5.5rem] shrink-0 text-right text-sm text-muted">
          {fmtClock(pos)} / {fmtClock(tl.duration)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Export                                                               */
/* ------------------------------------------------------------------ */

type ExportState =
  | { phase: 'idle' }
  | { phase: 'working'; progress: ExportProgress | null; started: number }
  | { phase: 'done'; result: ExportResult; url: string }
  | { phase: 'error'; unsupported: boolean };

function ExportCard({ data, tl, sig }: { data: WrappedData; tl: Timeline; sig: string }) {
  const t = useT();
  const [state, setState] = useState<ExportState>({ phase: 'idle' });
  const [format, setFormat] = useState<'MP4' | 'WebM' | null | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    void exportFormat().then(setFormat);
  }, []);
  const urlRef = useRef<string | null>(null);
  const fileBase = `left-on-read-wrapped-${data.year ?? 'chat'}`;

  useEffect(
    () => () => {
      abort.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const create = async () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setState({ phase: 'working', progress: null, started: performance.now() });
    try {
      const result = await exportVideo({ data, tl, sig, signal: ctl.signal, onProgress: (progress) => setState((s) => (s.phase === 'working' ? { ...s, progress } : s)) });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(result.blob);
      urlRef.current = url;
      setState({ phase: 'done', result, url });
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') setState({ phase: 'idle' });
      else {
        console.error(e);
        setState({ phase: 'error', unsupported: e instanceof Error && e.message === 'unsupported' });
      }
    }
  };

  const shareVideo = async (result: ExportResult) => {
    const name = `${fileBase}.${result.ext}`;
    const file = new File([result.blob], name, { type: result.blob.type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: data.copy['summaryKicker'] });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    download(result.blob, name);
  };

  const downloadImage = async () => {
    const blob = await renderStill(data, tl, sig);
    await deliver(blob, `${fileBase}.png`, data.copy['summaryKicker'] ?? 'Wrapped');
  };

  const seconds = Math.round(tl.duration);
  const working = state.phase === 'working' ? state : null;
  const p = working?.progress;
  const frac = p ? (p.phase === 'audio' ? 0.02 : p.phase === 'finish' ? 0.99 : 0.03 + 0.95 * (p.done / Math.max(1, p.total))) : 0;
  const elapsed = working ? (performance.now() - working.started) / 1000 : 0;
  const eta = working && frac > 0.08 ? (elapsed / frac) * (1 - frac) : null;
  const phaseLabel = !p
    ? t('wrapped.creating')
    : p.phase === 'audio'
      ? t('wrapped.phaseAudio')
      : p.phase === 'finish'
        ? t('wrapped.phaseFinish')
        : p.phase === 'realtime'
          ? t('wrapped.phaseRealtime')
          : t('wrapped.phaseFrames', { n: fmtNum(p.done), total: fmtNum(p.total) });

  return (
    <div className="card p-5">
      {state.phase === 'idle' && (
        <>
          <button type="button" className="btn btn-primary w-full justify-center" onClick={() => void create()} disabled={format === null}>
            <Icon name="film" size={18} />
            {t('wrapped.createVideo')}
          </button>
          <p className="mt-2 text-center text-sm text-muted">{format === null ? t('wrapped.unsupported') : t('wrapped.formatNote', { format: format ?? 'MP4', seconds: fmtNum(seconds) })}</p>
        </>
      )}
      {working && (
        <div>
          <p className="font-semibold">{t('wrapped.creating')}</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)} aria-label={t('wrapped.creating')}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${Math.round(frac * 100)}%` }} />
          </div>
          <p className="mt-2 flex justify-between gap-3 text-sm text-muted" aria-live="polite">
            <span>{phaseLabel}</span>
            <span className="tabular">{eta !== null ? t('wrapped.eta', { time: fmtDuration(Math.max(1000, eta * 1000)) }) : `${Math.round(frac * 100)}%`}</span>
          </p>
          <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => abort.current?.abort()}>
            <Icon name="x" size={16} />
            {t('wrapped.cancel')}
          </button>
        </div>
      )}
      {state.phase === 'done' && (
        <div>
          <p className="flex items-center gap-2 font-semibold" role="status">
            <Icon name="check" size={18} className="text-brand" />
            {t('wrapped.ready')}
          </p>
          <video src={state.url} controls playsInline className="mx-auto mt-3 aspect-[9/16] max-h-[60vh] rounded-2xl bg-black" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void shareVideo(state.result)}>
              <Icon name="share" size={16} />
              {t('wrapped.share')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => download(state.result.blob, `${fileBase}.${state.result.ext}`)}>
              <Icon name="download" size={16} />
              {t('wrapped.download')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void create()}>
              <Icon name="refresh" size={16} />
              {t('wrapped.again')}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            {state.result.label} · 1080×1920 · {fmtNum(state.result.blob.size / 1_048_576, 1)} MB
          </p>
        </div>
      )}
      {state.phase === 'error' && (
        <div role="alert">
          <p className="font-semibold">{state.unsupported ? t('wrapped.unsupported') : t('wrapped.failed')}</p>
          {!state.unsupported && (
            <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => void create()}>
              <Icon name="refresh" size={16} />
              {t('wrapped.again')}
            </button>
          )}
        </div>
      )}
      <button type="button" className="btn btn-ghost btn-sm mt-4 w-full justify-center" onClick={() => void downloadImage()}>
        <Icon name="image" size={16} />
        {t('wrapped.downloadImage')}
      </button>
    </div>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
