import { useEffect, useRef, useState } from 'react';
import { useT, type TKey } from '../../i18n';
import { useStore, setState } from '../store';
import { useKit } from '../dashboard/hooks';
import { Overview } from '../dashboard/Overview';
import { Dynamics, People } from '../dashboard/PeopleDynamics';
import { Eras, Time } from '../dashboard/TimeEras';
import { Emojis, Media, Words } from '../dashboard/WordsEmojisMedia';
import { Awards, Group, Mood } from '../dashboard/MoodGroupAwards';
import { Avatar } from '../components/data';
import { Icon } from '../components/Icon';
import { useNamer } from '../names';
import { go } from '../router';
import { fmtDateRange, fmtDateShort, fmtNum } from '../format';
import { Footer } from '../components/Footer';

const SECTIONS = ['overview', 'people', 'dynamics', 'time', 'eras', 'words', 'emojis', 'media', 'mood', 'group', 'awards'] as const;

export function DashboardPage({ section }: { section?: string | null }) {
  const t = useT();
  const chat = useStore((s) => s.chat)!;
  const settings = useStore((s) => s.settings);
  const { title, name } = useNamer();
  const stats = chat.stats;
  const [active, setActive] = useState<string>('overview');
  const navRef = useRef<HTMLDivElement>(null);
  const sections = SECTIONS.filter((id) => (id === 'group' ? !!stats?.group : id === 'eras' ? (stats?.eras.length ?? 0) > 0 : id === 'emojis' ? (stats?.emojis.total ?? 0) > 0 : true));

  // Scroll-spy
  useEffect(() => {
    if (!stats) return;
    const els = sections.map((id) => document.getElementById(`section-${id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id.replace('section-', ''));
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [stats, sections.join()]);

  // Keep the active chip visible in the horizontally scrolling nav
  useEffect(() => {
    navRef.current?.querySelector(`[data-sec="${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  // Deep link to a section
  useEffect(() => {
    if (stats && section) setTimeout(() => document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [stats, section]);

  const filtered = settings.dateStart !== null || settings.dateEnd !== null;
  return (
    <>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <header className="pb-2 pt-8 sm:pt-12">
          {chat.summary.isDemo && <span className="chip mb-3 !bg-brand-soft !text-brand">{t('common.demoBadge')}</span>}
          <h1 className="break-words text-[2.6rem] font-[800] leading-[0.95] sm:text-[4rem]">{title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span className="flex -space-x-2">
              {chat.summary.people.slice(0, 8).map((_, i) => (
                <button key={i} type="button" onClick={() => go('person', i)} className="rounded-full" aria-label={name(i)} title={name(i)}>
                  <Avatar person={i} size={32} ring />
                </button>
              ))}
            </span>
            <span>
              {fmtDateRange(stats?.meta.firstTs || chat.summary.firstTs, stats?.meta.lastTs || chat.summary.lastTs)}
            </span>
            <span>{t('common.messages', { n: fmtNum(stats?.meta.totalMessages ?? chat.summary.messages) })}</span>
            {filtered && (
              <button type="button" className="chip !border-brand/40 !bg-brand-soft !text-brand" onClick={() => setState({ settingsOpen: true })}>
                <Icon name="calendar" size={14} />
                {t('dash.filtered', { range: `${settings.dateStart ? fmtDateShort(settings.dateStart) : '…'} – ${settings.dateEnd ? fmtDateShort(settings.dateEnd - 1) : '…'}` })}
              </button>
            )}
            {stats && stats.meta.excludedMessages > 0 && !filtered && <span>{t('dash.excluded', { n: fmtNum(stats.meta.excludedMessages) })}</span>}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go('story')}>
              <Icon name="play" size={14} />
              {t('dash.replayStory')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('compare')}>
              <Icon name="compare" size={16} />
              {t('dash.compareCta')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setState({ settingsOpen: true })}>
              <Icon name="sliders" size={16} />
              {t('nav.settings')}
            </button>
          </div>
        </header>

        <nav className="glass sticky top-16 z-30 -mx-4 mt-6 border-x-0 px-4 py-2.5 sm:mx-0 sm:rounded-full sm:border-x sm:px-2" aria-label={t('nav.dashboard')}>
          <div ref={navRef} className="flex gap-1 overflow-x-auto scrollbar-none">
            {sections.map((id) => (
              <a
                key={id}
                data-sec={id}
                href={`#/dashboard/${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth' });
                  history.replaceState(null, '', `#/dashboard/${id}`);
                }}
                aria-current={active === id ? 'true' : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active === id ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-surface-2'}`}
              >
                {t(`dash.sections.${id}` as TKey)}
              </a>
            ))}
          </div>
        </nav>

        {stats ? <Sections /> : <SkeletonBody />}
      </main>
      <Footer />
    </>
  );
}

function Sections() {
  const stats = useStore((s) => s.chat!.stats!);
  const computing = useStore((s) => s.chat!.computing);
  const k = useKit(stats);
  return (
    <div className={`transition-opacity duration-300 ${computing ? 'opacity-60' : ''}`} aria-busy={computing}>
      <Overview k={k} />
      <People k={k} />
      <Dynamics k={k} />
      <Time k={k} />
      <Eras k={k} />
      <Words k={k} />
      <Emojis k={k} />
      <Media k={k} />
      <Mood k={k} />
      <Group k={k} />
      <Awards k={k} />
    </div>
  );
}

function SkeletonBody() {
  return (
    <div className="mt-10 space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-32 rounded-3xl" />
        ))}
      </div>
      <div className="skeleton h-80 rounded-3xl" />
    </div>
  );
}
