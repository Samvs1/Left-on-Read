import type { ChatStats } from '../../engine/types';
import { useT } from '../../i18n';
import { clearCompare, loadCompareDemo, loadCompareFile, useStore } from '../store';
import { DropZone } from '../components/DropZone';
import { Icon } from '../components/Icon';
import { useNamer } from '../names';
import { go } from '../router';
import { fmtCompact, fmtDuration, fmtFixed, fmtNum, fmtPct } from '../format';
import { Footer } from '../components/Footer';

type Row = [label: string, get: (s: ChatStats) => number | null, fmt: (v: number) => string];

export function ComparePage() {
  const t = useT();
  const chat = useStore((s) => s.chat)!;
  const cmp = useStore((s) => s.compare);
  const loading = useStore((s) => s.compareLoading);
  const { title } = useNamer();
  const a = chat.stats;
  const b = cmp?.stats ?? null;
  const titleB = cmp ? (cmp.summary.title ?? cmp.summary.people.join(' & ')) : '';
  const rows: Row[] = [
    [t('stats.messages'), (s) => s.meta.totalMessages, fmtCompact],
    [t('stats.perDay'), (s) => s.meta.messagesPerDay, (v) => fmtNum(v, 1)],
    [t('stats.activeDays'), (s) => s.time.activeDaysPct, (v) => fmtPct(v)],
    [t('stats.chatAge'), (s) => s.time.chatAgeDays, (v) => t('common.days', { n: fmtNum(v) })],
    [t('stats.replyTime'), (s) => s.dynamics.responseTime?.median ?? null, fmtDuration],
    [t('stats.conversations'), (s) => s.dynamics.conversations, fmtCompact],
    [t('stats.avgWords'), (s) => s.words.avgWordsPerMessage, (v) => fmtNum(v, 1)],
    [t('stats.emojis'), (s) => s.emojis.perMessage, (v) => `${fmtFixed(v, 2)} ${t('common.perMessage')}`],
    [t('stats.laughs'), (s) => (s.laughter.laughMessages / Math.max(1, s.meta.totalMessages)) * 100, (v) => `${fmtNum(v, 1)} / 100`],
    [t('stats.nightOwl'), (s) => s.time.nightOwlPct, (v) => fmtPct(v)],
    [t('stats.weekend'), (s) => s.time.weekendPct, (v) => fmtPct(v)],
    [t('stats.sentiment'), (s) => s.sentiment.positiveShare, (v) => fmtPct(v)],
    [t('stats.streak'), (s) => s.time.longestStreak.days, (v) => t('common.days', { n: fmtNum(v) })],
    [t('stats.gotGhosted'), (s) => s.people.reduce((x, p) => x + p.gotGhosted, 0), fmtNum],
    [t('stats.doubleTexts'), (s) => s.people.reduce((x, p) => x + p.doubleTexts, 0), fmtNum],
    [t('stats.media'), (s) => s.meta.totalMedia, fmtCompact],
  ];
  return (
    <>
      <main id="main" className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <div className="pt-6">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('dashboard')}>
            <Icon name="arrowLeft" size={16} />
            {t('nav.dashboard')}
          </button>
        </div>
        <h1 className="mt-6 text-[2.6rem] font-[800] leading-[0.95] sm:text-[3.6rem]">{t('compare.title')}</h1>
        <p className="mt-3 text-lg text-ink-2">{t('compare.subtitle')}</p>
        {!cmp && (
          <div className="mt-8 space-y-4">
            {loading ? (
              <div className="skeleton h-48 rounded-3xl" />
            ) : (
              <>
                <DropZone onFile={(f) => void loadCompareFile(f, f.name)} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void loadCompareDemo(chat.summary.isGroup ? 'duo' : 'group')}>
                  <Icon name="sparkles" size={16} />
                  {t('compare.loadDemo')}
                </button>
              </>
            )}
          </div>
        )}
        {cmp && (
          <div className="mt-8">
            <div className="card overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line bg-surface-2 p-4 sm:p-5">
                <p className="truncate font-display text-lg font-bold sm:text-2xl">{title}</p>
                <span className="font-display font-bold text-muted">{t('common.vs')}</span>
                <p className="truncate text-right font-display text-lg font-bold sm:text-2xl">{titleB}</p>
              </div>
              {!a || !b ? (
                <div className="skeleton m-5 h-64 rounded-2xl" />
              ) : (
                <ul className="divide-y divide-line">
                  {rows.map(([label, get, f]) => {
                    const va = get(a);
                    const vb = get(b);
                    const total = (va ?? 0) + (vb ?? 0) || 1;
                    return (
                      <li key={label} className="px-4 py-3 sm:px-5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="tabular font-semibold">{va === null ? '–' : f(va)}</span>
                          <span className="text-center text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
                          <span className="tabular font-semibold">{vb === null ? '–' : f(vb)}</span>
                        </div>
                        <div className="mt-1.5 flex h-2 gap-[2px]" aria-hidden="true">
                          <span className="h-full rounded-l-full bg-[#6250d6] dark:bg-[#9085e9]" style={{ width: `${((va ?? 0) / total) * 100}%` }} />
                          <span className="h-full flex-1 rounded-r-full bg-[#eb6834] dark:bg-[#d95926]" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="mt-3 text-sm text-muted">{t('compare.winnerHint')}</p>
            <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={clearCompare}>
              <Icon name="x" size={16} />
              {t('compare.remove')}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
