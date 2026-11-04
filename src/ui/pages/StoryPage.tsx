import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useT, type TKey } from '../../i18n';
import { buildSlides, type SlideCtx, type SlideDef } from '../story/slides';
import { useNamer } from '../names';
import { useStore } from '../store';
import { go } from '../router';
import { rankedAwards } from '../awards';
import { Icon } from '../components/Icon';
import { ShareButton } from '../components/ShareButton';
import { prefersReducedMotion } from '../theme';

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI'];

export function useEraName() {
  const t = useT();
  return (kind: string, ordinal: number) => `${t(`eras.${kind}` as TKey)}${ROMAN[ordinal] ?? ` ${ordinal}`}`;
}

export function SlideStill({ slide, ctx }: { slide: SlideDef; ctx: SlideCtx }) {
  return (
    <div className={`relative h-full w-full overflow-hidden ${slide.dark ? 'text-[#16141d]' : 'text-white'}`} style={{ background: slide.bg, containerType: 'inline-size', fontFamily: "'Inter Variable', sans-serif" }}>
      {slide.render({ ...ctx, still: true })}
      <div className={`absolute bottom-[3%] left-[7%] text-[11px] font-semibold ${slide.dark ? 'text-black/60' : 'text-white/70'}`}>Left on Read</div>
    </div>
  );
}

export function StoryPage() {
  const t = useT();
  const chat = useStore((s) => s.chat)!;
  const anonymous = useStore((s) => s.anonymize);
  const { name, title } = useNamer();
  const eraName = useEraName();
  const stats = chat.stats;
  const awards = useMemo(() => (stats ? rankedAwards(stats.awards) : []), [stats]);
  const slides = useMemo(() => buildSlides(stats, chat.summary, awards), [stats, chat.summary, awards]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const bars = useRef<(HTMLDivElement | null)[]>([]);
  const elapsed = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();

  const slide = slides[Math.min(index, slides.length - 1)]!;
  const waiting = slide.needsStats && !stats;
  const ctx: SlideCtx = { stats, summary: chat.summary, name, title, anonymous, t, eraName, still: false };

  const next = useCallback(() => {
    elapsed.current = 0;
    setIndex((i) => {
      if (i >= slides.length - 1) {
        go('dashboard');
        return i;
      }
      return i + 1;
    });
  }, [slides.length]);
  const prev = useCallback(() => {
    elapsed.current = 0;
    setIndex((i) => Math.max(0, i - 1));
  }, []);
  const close = useCallback(() => go('dashboard'), []);

  // Progress loop: writes bar widths directly, no re-render per frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const running = !paused && !holding && !waiting && slide.duration > 0 && document.visibilityState === 'visible';
      if (running) elapsed.current += dt;
      const frac = slide.duration > 0 ? Math.min(1, elapsed.current / slide.duration) : waiting ? 0 : 1;
      bars.current.forEach((el, i) => {
        if (!el) return;
        el.style.transform = `scaleX(${i < index ? 1 : i > index ? 0 : frac})`;
      });
      if (running && elapsed.current >= slide.duration) {
        next();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, paused, holding, waiting, slide.duration, next]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('[role="dialog"]')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        if (e.key === ' ' && e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Escape') close();
      else if (e.key === 'p' || e.key === 'k') setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, close]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    stageRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Pointer: tap left/right, hold to pause, swipe.
  const down = useRef<{ x: number; y: number; t: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, [role="dialog"], [data-sheet]')) return;
    const timer = setTimeout(() => setHolding(true), 220);
    down.current = { x: e.clientX, y: e.clientY, t: performance.now(), timer };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    clearTimeout(d.timer);
    const wasHold = performance.now() - d.t > 220;
    setHolding(false);
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? next() : prev();
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) return close();
    if (wasHold) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) prev();
    else next();
  };

  const textDark = !!slide.dark;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07060b]" role="region" aria-roledescription="story" aria-label={t('nav.story')}>
      <div className="pointer-events-none absolute inset-0 opacity-60 blur-3xl transition-[background] duration-700" style={{ background: slide.bg }} aria-hidden="true" />
      <div
        ref={stageRef}
        tabIndex={-1}
        className={`relative h-full w-full overflow-hidden outline-none sm:h-[min(100dvh,56rem)] sm:w-auto sm:aspect-[9/16] sm:rounded-[2rem] sm:shadow-2xl ${textDark ? 'text-[#16141d]' : 'text-white'}`}
        style={{ background: slide.bg, containerType: 'inline-size', touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          if (down.current) clearTimeout(down.current.timer);
          down.current = null;
          setHolding(false);
        }}
      >
        {/* progress */}
        <div className="absolute inset-x-0 top-0 z-20 px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
          <div className="flex gap-1" aria-hidden="true">
            {slides.map((s, i) => (
              <div key={s.id} className={`h-[3px] flex-1 overflow-hidden rounded-full ${textDark ? 'bg-black/15' : 'bg-white/25'}`}>
                <div ref={(el) => { bars.current[i] = el; }} className={`h-full origin-left rounded-full ${textDark ? 'bg-black/70' : 'bg-white'}`} style={{ transform: `scaleX(${i < index ? 1 : 0})` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold opacity-80" aria-live="polite">
              {index + 1} / {slides.length}
              {(paused || holding) && ` · ${t('story.paused')}`}
            </span>
            <div className="flex items-center gap-0.5">
              {stats && (
                <ShareButton
                  className="!text-current hover:!bg-white/15"
                  label={t('story.shareSlide')}
                  filename={`left-on-read-${slide.id}`}
                  formats={['story']}
                  make={() => <SlideStill slide={slide} ctx={ctx} />}
                />
              )}
              <button type="button" className="icon-btn !text-current hover:!bg-white/15" onClick={() => setPaused((p) => !p)} aria-label={paused ? t('story.play') : t('story.pause')}>
                <Icon name={paused ? 'play' : 'pause'} size={18} />
              </button>
              <button type="button" className="icon-btn !text-current hover:!bg-white/15" onClick={close} aria-label={t('nav.close')}>
                <Icon name="x" size={20} />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.id}
            className="absolute inset-0 isolate"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.16, 1, 0.3, 1] }}
            aria-live="polite"
          >
            {waiting ? (
              <div className="grid h-full place-items-center">
                <div className="text-center">
                  <span className="mx-auto mb-4 block h-10 w-10 animate-[spin_0.9s_linear_infinite] rounded-full border-4 border-white/30 border-t-white" />
                  <p className="font-display text-2xl font-bold">{t('story.stillCounting')}</p>
                </div>
              </div>
            ) : (
              slide.render(ctx)
            )}
          </motion.div>
        </AnimatePresence>

        {/* bottom controls */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" className="icon-btn !text-current hover:!bg-white/15" onClick={prev} aria-label={t('story.prev')} disabled={index === 0}>
            <Icon name="chevronLeft" />
          </button>
          {slide.id === 'summary' ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-sm bg-white text-[#16141d] hover:bg-white/90" onClick={close}>
                {t('story.toDashboard')}
                <Icon name="arrowRight" size={16} />
              </button>
            </div>
          ) : (
            <button type="button" className="rounded-full px-3 py-1.5 text-xs font-semibold opacity-80 hover:bg-white/15" onClick={close}>
              {t('nav.skip')}
            </button>
          )}
          <button type="button" className="icon-btn !text-current hover:!bg-white/15" onClick={next} aria-label={t('story.next')}>
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
    </div>
  );
}
