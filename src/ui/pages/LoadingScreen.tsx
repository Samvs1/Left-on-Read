import { useEffect, useState } from 'react';
import { dict, useLang, useT } from '../../i18n';
import { useStore } from '../store';
import { LogoMark } from '../components/Logo';
import { Icon } from '../components/Icon';

const PHASE_RANGE = { reading: [0, 0.12], parsing: [0.12, 0.7], preparing: [0.7, 0.92], computing: [0.92, 1] } as const;

export function LoadingScreen() {
  const t = useT();
  const lang = useLang();
  const progress = useStore((s) => s.progress);
  const messages = dict(lang).loading.messages.split(';');
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % messages.length), 1700);
    return () => clearInterval(id);
  }, [messages.length]);
  const phase = progress?.phase ?? 'reading';
  const [a, b] = PHASE_RANGE[phase];
  const pct = Math.round((a + (b - a) * (progress?.fraction ?? 0)) * 100);
  return (
    <main id="main" className="grain relative grid min-h-[calc(100dvh-4rem)] place-items-center overflow-hidden px-4">
      <div className="blob animate-float-a left-[10%] top-[10%] h-80 w-80" style={{ background: 'var(--glow-a)' }} aria-hidden="true" />
      <div className="blob animate-float-b bottom-[5%] right-[10%] h-72 w-72" style={{ background: 'var(--glow-b)' }} aria-hidden="true" />
      <div className="relative w-full max-w-md text-center">
        <div className="mx-auto mb-8 w-fit animate-[float-a_4s_ease-in-out_infinite]">
          <LogoMark size={84} />
        </div>
        <h1 className="text-[2.4rem] font-[780] leading-none">{t('loading.title')}</h1>
        <p className="mt-3 h-6 text-lg text-ink-2" aria-live="polite" key={i}>
          <span className="inline-block animate-fade-up">{messages[i]}</span>
        </p>
        <div
          className="mt-8 h-3 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t(`loading.${phase}`)}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-[#6a4bff] via-[#c24bd8] to-[#ff6b57] transition-[width] duration-300" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-sm text-muted">
          <span>{t(`loading.${phase}`)}</span>
          <span className="tabular">{pct}%</span>
        </div>
        <p className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-muted">
          <Icon name="lock" size={15} /> {t('loading.stillPrivate')}
        </p>
      </div>
    </main>
  );
}
