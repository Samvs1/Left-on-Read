import { useT, type TKey } from '../../i18n';
import { DropZone, GlobalDrop, useFilePicker } from '../components/DropZone';
import { ExportGuide } from '../components/ExportGuide';
import { Icon, type IconName } from '../components/Icon';
import { go, href } from '../router';
import { loadDemo, setState, useStore, warmup } from '../store';
import { useNamer } from '../names';
import { Footer } from '../components/Footer';

/** Animated mock dashboard for the hero: pure CSS, no chart library. */
function HeroMock() {
  const t = useT();
  const bars = [32, 54, 41, 68, 90, 74, 58, 82, 100, 77, 63, 86];
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[25rem] select-none sm:aspect-square lg:max-w-none" aria-hidden="true">
      {/* main card */}
      <div className="card absolute inset-x-[6%] top-[4%] rotate-[-2.5deg] p-5 shadow-[var(--shadow-lift)] animate-fade-up">
        <div className="flex items-center gap-2">
          <span className="inline-grid h-8 w-8 place-items-center rounded-full bg-[#6250d6] text-xs font-bold text-white">Y</span>
          <span className="-ml-3 inline-grid h-8 w-8 place-items-center rounded-full bg-[#eb6834] text-xs font-bold text-white ring-2 ring-[var(--surface)]">N</span>
          <span className="ml-1 font-display text-lg font-bold">{t('landing.mockTitle')}</span>
          <span className="chip ml-auto !py-0.5 !text-[0.7rem]">{t('landing.statsPreview')}</span>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <span className="num text-5xl">18,402</span>
          <span className="pb-1 text-sm font-semibold text-muted">{t('landing.mockStat1')}</span>
        </div>
        <div className="mt-4 flex h-24 items-end gap-1.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t-[4px] animate-grow-y"
              style={{
                height: `${h}%`,
                animationDelay: `${300 + i * 70}ms`,
                background: `linear-gradient(180deg, ${i % 3 === 2 ? '#eb6834' : '#6250d6'} 0%, ${i % 3 === 2 ? '#eb6834' : '#6250d6'}cc 100%)`,
              }}
            />
          ))}
        </div>
      </div>
      {/* chat bubbles card */}
      <div className="card absolute bottom-[8%] left-[0%] w-[58%] rotate-[3deg] p-3.5 shadow-[var(--shadow-lift)] animate-float-b">
        <div className="space-y-2 text-[0.8rem]">
          <div className="w-fit rounded-2xl rounded-bl-md bg-surface-2 px-3 py-1.5 animate-bubble" style={{ animationDelay: '900ms' }}>
            pizza tonight? 🍕
          </div>
          <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-brand-soft px-3 py-1.5 animate-bubble" style={{ animationDelay: '1500ms' }}>
            obviously
          </div>
          <div className="flex w-fit gap-1 rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2.5 animate-bubble" style={{ animationDelay: '2100ms' }}>
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: '150ms' }} />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
      {/* award */}
      <div className="absolute bottom-[14%] right-[2%] w-[44%] rotate-[-4deg] animate-float-a">
        <div className="relative overflow-hidden rounded-[1.4rem] p-4 text-white shadow-[var(--shadow-lift)]" style={{ background: 'linear-gradient(135deg,#2a2a72,#7c5cff)' }}>
          <div className="emoji text-4xl">🦉</div>
          <div className="mt-2 font-display text-lg font-bold leading-tight">The Night Owl</div>
          <div className="text-xs opacity-80">Noor · 23% after midnight</div>
          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
        </div>
      </div>
      {/* reply time pill */}
      <div className="glass absolute right-[0%] top-[52%] flex items-center gap-2 rounded-full px-3.5 py-2 shadow-lg animate-float-b" style={{ animationDelay: '-4s' }}>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1baf7a] text-white">
          <Icon name="zap" size={14} />
        </span>
        <span className="text-sm">
          <b className="font-display">2 min</b> <span className="text-muted">{t('landing.mockStat2')}</span>
        </span>
      </div>
    </div>
  );
}

const FEATURES: [IconName, TKey, TKey, string][] = [
  ['play', 'landing.f1t', 'landing.f1b', '#6250d6'],
  ['layers', 'landing.f2t', 'landing.f2b', '#eb6834'],
  ['trophy', 'landing.f3t', 'landing.f3b', '#c98500'],
  ['clock', 'landing.f4t', 'landing.f4b', '#1baf7a'],
  ['image', 'landing.f5t', 'landing.f5b', '#e87ba4'],
  ['mask', 'landing.f6t', 'landing.f6b', '#2a78d6'],
  ['users', 'landing.f7t', 'landing.f7b', '#e34948'],
  ['compare', 'landing.f8t', 'landing.f8b', '#6250d6'],
];

export function Landing() {
  const t = useT();
  const chat = useStore((s) => s.chat);
  const error = useStore((s) => s.error);
  const { title } = useNamer();
  const picker = useFilePicker();
  return (
    <>
      <GlobalDrop />
      <main id="main" onPointerDown={() => void warmup()} onKeyDown={() => void warmup()}>
        {/* ---------------- Hero ---------------- */}
        <section className="grain relative overflow-hidden">
          <div className="blob animate-float-a left-[-10%] top-[-12%] h-[26rem] w-[26rem]" style={{ background: 'var(--glow-a)' }} aria-hidden="true" />
          <div className="blob animate-float-b right-[-8%] top-[18%] h-[22rem] w-[22rem]" style={{ background: 'var(--glow-b)' }} aria-hidden="true" />
          <div className="blob animate-float-a bottom-[-10%] left-[30%] h-[18rem] w-[18rem]" style={{ background: 'var(--glow-c)' }} aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-8 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24">
            <div className="min-w-0">
              <p className="chip mb-5 max-w-full !whitespace-normal !bg-surface/70 text-left backdrop-blur">
                <Icon name="lock" size={14} />
                {t('landing.eyebrow')}
              </p>
              <h1 className="text-[3.1rem] font-[800] leading-[0.92] sm:text-[4.6rem] lg:text-[5.4rem]">
                {t('landing.title')} <span className="text-gradient">{t('landing.titleEm')}</span>
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2 sm:text-xl">{t('landing.subtitle')}</p>
              {chat && (
                <button type="button" className="btn btn-ghost mt-6" onClick={() => go('dashboard')}>
                  {t('landing.continue', { title })}
                  <Icon name="arrowRight" size={18} />
                </button>
              )}
              {error && (
                <div role="alert" className="card mt-6 border-coral/40 p-4">
                  <p className="font-display text-lg font-bold">{t('errors.title')}</p>
                  <p className="mt-1 text-sm text-ink-2">{t(`errors.${error.code}` as TKey) || t('errors.UNKNOWN')}</p>
                  <p className="mt-3 text-sm font-semibold">{t('errors.howTo')}</p>
                  <a href="#export" className="text-sm font-semibold text-brand underline underline-offset-4">
                    {t('landing.exportTitle')}
                  </a>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={picker.open}>
                      {t('errors.back')}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setState({ pasteOpen: true, error: null })}>
                      {t('errors.pasteInstead')}
                    </button>
                  </div>
                  {picker.input}
                </div>
              )}
              <div className="mt-8">
                <DropZone />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadDemo('duo')}>
                  <Icon name="sparkles" size={16} />
                  {t('landing.ctaDemo')}
                </button>
                <button type="button" className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={() => void loadDemo('group')}>
                  {t('landing.ctaDemoGroup')}
                </button>
              </div>
            </div>
            <HeroMock />
          </div>
        </section>

        {/* ---------------- Privacy promise ---------------- */}
        <section className="px-4 sm:px-6" aria-labelledby="privacy-title">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#121019] p-7 text-white ring-1 ring-white/10 sm:p-12">
            <div className="blob left-[-6%] top-[-30%] h-72 w-72 opacity-70" style={{ background: 'rgba(124,92,255,0.45)' }} aria-hidden="true" />
            <div className="relative grid gap-10 lg:grid-cols-2">
              <div>
                <p className="eyebrow !text-white/60">{t('nav.privacy')}</p>
                <h2 id="privacy-title" className="mt-3 text-[2.3rem] font-[780] leading-[1] sm:text-[3.2rem]">
                  {t('landing.privacyTitle')}
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-white/75">{t('landing.privacyBody')}</p>
                <a href={href.privacy()} className="mt-5 inline-flex items-center gap-1.5 font-semibold text-[#c9bfff] underline-offset-4 hover:underline">
                  {t('nav.privacy')} <Icon name="arrowRight" size={16} />
                </a>
              </div>
              <div className="flex flex-col justify-center gap-3">
                {(
                  [
                    ['upload', 'landing.privacyPoint1'],
                    ['eyeOff', 'landing.privacyPoint2'],
                    ['wifiOff', 'landing.privacyPoint3'],
                    ['shield', 'landing.privacyPoint4'],
                  ] as [IconName, TKey][]
                ).map(([icon, key]) => (
                  <div key={key} className="flex items-center gap-4 rounded-2xl bg-white/[0.06] px-4 py-3.5 ring-1 ring-white/10">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                      <Icon name={icon} size={20} />
                    </span>
                    <span className="font-semibold">{t(key)}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-[#6a4bff]/40 to-[#ff6b57]/30 p-4 ring-1 ring-white/15">
                  <Icon name="plane" size={22} className="mt-0.5 shrink-0" />
                  <p className="text-[0.95rem] leading-snug">{t('landing.privacyAirplane')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="features-title">
          <h2 id="features-title" className="max-w-2xl text-[2.3rem] font-[780] leading-[1] sm:text-[3.2rem]">
            {t('landing.featuresTitle')}
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(([icon, title, body, color]) => (
              <div key={title} className="card p-5 transition-transform hover:-translate-y-0.5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: color }}>
                  <Icon name={icon} size={20} />
                </span>
                <h3 className="mt-4 text-xl font-bold">{t(title)}</h3>
                <p className="mt-1.5 text-[0.95rem] leading-snug text-ink-2">{t(body)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Export guide ---------------- */}
        <section id="export" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="export-title">
          <div className="mb-8 text-center">
            <h2 id="export-title" className="text-[2.3rem] font-[780] leading-[1] sm:text-[3rem]">
              {t('landing.exportTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-2">{t('landing.exportSubtitle')}</p>
          </div>
          <ExportGuide />
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6" aria-labelledby="faq-title">
          <h2 id="faq-title" className="mb-6 text-[2rem] font-[780] leading-none sm:text-[2.6rem]">
            {t('landing.faqTitle')}
          </h2>
          <div className="space-y-3">
            {(
              [
                ['landing.q1', 'landing.a1'],
                ['landing.q2', 'landing.a2'],
                ['landing.q3', 'landing.a3'],
                ['landing.q4', 'landing.a4'],
              ] as [TKey, TKey][]
            ).map(([q, a]) => (
              <details key={q} className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {t(q)}
                  <Icon name="chevronDown" className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 leading-relaxed text-ink-2">{t(a)}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
