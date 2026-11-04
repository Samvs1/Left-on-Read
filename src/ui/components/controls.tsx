import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { prefersReducedMotion } from '../theme';

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-[0.95rem] font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-surface-3'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full font-semibold transition-all ${size === 'sm' ? 'px-3 py-1 text-[0.8rem]' : 'px-4 py-1.5 text-sm'} ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, hint, value, min, max, step = 1, onChange, format }: { label: string; hint?: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.95rem] font-semibold">
          {label}
        </label>
        <output htmlFor={id} className="tabular text-sm font-semibold text-brand">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${pct}%` }}
        aria-valuetext={format(value)}
      />
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

/** Accessible dialog rendered as a bottom sheet on phones and a side panel / modal on desktop. */
export function Sheet({ open, onClose, title, children, side = 'right', wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; side?: 'right' | 'center'; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>('[data-autofocus], button, [href], input, select, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  const panel =
    side === 'right'
      ? `fixed inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[1.75rem] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-[1.75rem]`
      : `fixed inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[1.75rem] sm:inset-auto sm:left-1/2 sm:top-1/2 ${wide ? 'sm:w-[min(44rem,calc(100vw-2rem))]' : 'sm:w-[min(32rem,calc(100vw-2rem))]'} sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.75rem]`;
  return (
    <div className="fixed inset-0 z-[70]" data-sheet>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`${panel} flex flex-col overflow-hidden border border-line bg-surface shadow-2xl animate-fade-up`}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <button type="button" className="icon-btn -mr-2" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">{children}</div>
      </div>
    </div>
  );
}

/** Animated number. Shows the final value immediately when motion is reduced. */
export function CountUp({ value, format, duration = 1400, delay = 0 }: { value: number; format: (v: number) => string; duration?: number; delay?: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const k = Math.min(1, (t - start - delay) / duration);
      if (k < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const eased = 1 - Math.pow(1 - k, 4);
      setShown(value * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

/** Width of an element (for responsive chart options). */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e!.contentRect.width)));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
