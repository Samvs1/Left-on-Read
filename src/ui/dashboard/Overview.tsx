import { useState } from 'react';
import type { PersonStats } from '../../engine/types';
import { BarList, PersonChip, SectionHeader, StatTile, ChartCard, Swatch } from '../components/data';
import { Segmented } from '../components/controls';
import { ShareButton } from '../components/ShareButton';
import { fmtCompact, fmtDuration, fmtNum, fmtPct, fmtMonth } from '../format';
import { timelineOption } from '../charts/options';
import { go } from '../router';
import { tk } from '../takeaways';
import { useEraName } from '../pages/StoryPage';
import { OverviewCard, VsCard } from '../share/cards';
import { ChartBlock } from './ChartBlock';
import type { Kit } from './hooks';

export function Overview({ k }: { k: Kit }) {
  const { s, t } = k;
  const eraName = useEraName();
  const [gran, setGran] = useState<'day' | 'week' | 'month'>(s.time.monthly.starts.length >= 4 ? 'month' : s.time.weekly.starts.length >= 4 ? 'week' : 'day');
  const series = gran === 'day' ? s.time.daily : gran === 'week' ? s.time.weekly : s.time.monthly;
  const duo = !s.meta.isGroup && s.people.length === 2;
  return (
    <section aria-labelledby="overview-heading">
      <SectionHeader id="overview" title={t('dash.sections.overview')}>
        <ShareButton variant="button" filename="left-on-read-overview" make={(f) => <OverviewCard stats={s} format={f} />} />
      </SectionHeader>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon="message" accent="#6250d6" label={t('stats.messages')} value={fmtCompact(s.meta.totalMessages)} sub={`${fmtNum(s.meta.messagesPerDay, 1)} ${t('common.perDay')}`} />
        <StatTile icon="book" accent="#eb6834" label={t('stats.words')} value={fmtCompact(s.meta.totalWords)} sub={`${fmtNum(s.words.avgWordsPerMessage, 1)} ${t('common.perMessage')}`} />
        <StatTile icon="calendar" accent="#1baf7a" label={t('stats.activeDays')} value={fmtNum(s.meta.activeDays)} sub={`${fmtPct(s.time.activeDaysPct)} · ${t('common.days', { n: fmtNum(s.time.chatAgeDays) })}`} />
        <StatTile icon="users" accent="#2a78d6" label={t('stats.conversations')} value={fmtCompact(s.dynamics.conversations)} sub={s.dynamics.responseTime ? `${t('stats.replyTime')} ${fmtDuration(s.dynamics.responseTime.median)}` : undefined} />
        <StatTile icon="smile" accent="#c98500" label={t('stats.emojis')} value={fmtCompact(s.emojis.total)} sub={s.emojis.top.slice(0, 4).map((e) => e.display).join(' ')} />
        <StatTile icon="sparkles" accent="#e87ba4" label={t('stats.laughs')} value={fmtCompact(s.laughter.total)} />
        <StatTile icon="image" accent="#e34948" label={t('stats.media')} value={fmtCompact(s.meta.totalMedia)} />
        <StatTile icon="zap" accent="#6250d6" label={t('stats.streak')} value={t('common.days', { n: fmtNum(s.time.longestStreak.days) })} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartBlock
          k={k}
          id="timeline"
          wide
          title={t('charts.timeline')}
          takeaway={tk.timeline(s, t)}
          height={(narrow) => (narrow ? 260 : 320)}
          deps={[gran]}
          extra={
            <div className="mb-3 flex justify-end">
              <Segmented
                size="sm"
                label={t('charts.timeline')}
                value={gran}
                onChange={setGran}
                options={[
                  { value: 'day', label: t('common.day') },
                  { value: 'week', label: t('common.week') },
                  { value: 'month', label: t('common.month') },
                ]}
              />
            </div>
          }
          build={(th) =>
            timelineOption(
              th,
              series.starts,
              k.rows.map((r, i) => ({ name: r.name, color: r.color, data: series.byPerson[i] ?? [] })),
              gran,
              gran === 'month' && s.eras.length > 1 ? s.eras.map((e) => ({ start: e.start, end: e.end, label: eraName(e.kind, e.ordinal) })) : [],
            )
          }
          table={{
            columns: [t('common.date'), ...k.rows.map((r) => r.name), t('common.total')],
            rows: series.starts.map((st, i) => [gran === 'month' ? fmtMonth(st) : new Date(st).toISOString().slice(0, 10), ...k.rows.map((_, r) => series.byPerson[r]?.[i] ?? 0), series.totals[i] ?? 0]),
          }}
          onClick={(p) => {
            const row = k.rows.find((r) => r.name === p.seriesName);
            if (row && row.person >= 0) go('person', row.person);
          }}
        />
        {duo ? <HeadToHead k={k} /> : <Leaderboard k={k} />}
        {duo && s.dynamics.effort && <Effort k={k} />}
      </div>
    </section>
  );
}

function HeadToHead({ k }: { k: Kit }) {
  const { s, t, name, color } = k;
  const [a, b] = s.people as [PersonStats, PersonStats];
  const rows: [string, number, number, (v: number) => string, boolean?][] = [
    [t('stats.messages'), a.messages, b.messages, fmtCompact],
    [t('stats.words'), a.words, b.words, fmtCompact],
    [t('stats.avgWords'), a.avgWords, b.avgWords, (v) => fmtNum(v, 1)],
    [t('stats.replyTime'), a.responseTime?.median ?? 0, b.responseTime?.median ?? 0, fmtDuration, true],
    [t('stats.initiations'), a.initiationShare, b.initiationShare, (v) => fmtPct(v)],
    [t('stats.endings'), a.endingShare, b.endingShare, (v) => fmtPct(v)],
    [t('stats.emojis'), a.emojis, b.emojis, fmtCompact],
    [t('stats.laughs'), a.laughs, b.laughs, fmtCompact],
    [t('stats.asked'), a.questionsAsked, b.questionsAsked, fmtCompact],
    [t('stats.media'), a.mediaTotal, b.mediaTotal, fmtCompact],
    [t('stats.doubleTexts'), a.doubleTexts, b.doubleTexts, fmtCompact],
    [t('stats.ghosted'), a.ghostedOthers, b.ghostedOthers, fmtCompact],
  ];
  return (
    <ChartCard
      id="head-to-head"
      title={t('charts.headToHead')}
      takeaway={t('takeaways.headToHead')}
      actions={<ShareButton filename="left-on-read-vs" make={(f) => <VsCard stats={s} format={f} />} />}
      table={{ columns: [t('common.value'), name(a.id), name(b.id)], rows: rows.map(([l, va, vb, f]) => [l, f(va), f(vb)]) }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <PersonChip person={a.id} onClick={() => go('person', a.id)} />
        <span className="font-display text-lg font-bold text-muted">{t('common.vs')}</span>
        <PersonChip person={b.id} onClick={() => go('person', b.id)} />
      </div>
      <ul className="space-y-3">
        {rows.map(([label, va, vb, f, inverse]) => {
          const total = va + vb || 1;
          // For reply time, the faster person "wins": invert the split.
          const left = inverse ? (vb || 0) / total : va / total;
          return (
            <li key={label}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="tabular font-semibold">{f(va)}</span>
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
                <span className="tabular font-semibold">{f(vb)}</span>
              </div>
              <div className="flex h-2 gap-[2px]" aria-hidden="true">
                <span className="h-full rounded-l-full" style={{ width: `${left * 100}%`, background: color(a.id) }} />
                <span className="h-full flex-1 rounded-r-full" style={{ background: color(b.id) }} />
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

function Leaderboard({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const ranked = [...s.people].filter((p) => p.messages > 0).sort((a, b) => b.messages - a.messages);
  return (
    <ChartCard
      id="leaderboard"
      title={t('charts.leaderboard')}
      takeaway={tk.leaderboard(s, t, name)}
      table={{ columns: [t('common.rank'), t('common.person'), t('stats.messages'), t('stats.share')], rows: ranked.map((p, i) => [i + 1, name(p.id), p.messages, fmtPct(p.share)]) }}
    >
      <BarList
        onSelect={(key) => go('person', Number(key))}
        items={ranked.slice(0, 12).map((p) => ({
          key: String(p.id),
          person: p.id,
          value: p.messages,
          display: `${fmtCompact(p.messages)} · ${fmtPct(p.share)}`,
          label: (
            <span className="inline-flex items-center gap-2">
              <Swatch person={p.id} />
              {name(p.id)}
            </span>
          ),
        }))}
      />
    </ChartCard>
  );
}

function Effort({ k }: { k: Kit }) {
  const { s, t, name, color } = k;
  const e = s.dynamics.effort!;
  const [a, b] = s.people as [PersonStats, PersonStats];
  const labels: Record<string, string> = {
    messages: t('stats.messages'),
    initiations: t('stats.initiations'),
    speed: t('stats.replyTime'),
    length: t('stats.avgWords'),
  };
  return (
    <ChartCard id="effort" title={t('charts.effort')} takeaway={tk.effort(s, t, name)} wide>
      <div className="flex items-center justify-between text-sm font-semibold">
        <PersonChip person={a.id} />
        <PersonChip person={b.id} />
      </div>
      <div className="relative mt-4 h-6 rounded-full" style={{ background: `linear-gradient(90deg, ${color(a.id)} 0%, ${color(a.id)} ${e.score}%, ${color(b.id)} ${e.score}%, ${color(b.id)} 100%)` }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(e.score)} aria-label={t('charts.effort')}>
        <span className="absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[var(--surface)] bg-white shadow-lg" style={{ left: `${e.score}%` }} />
        <span className="absolute left-1/2 top-full mt-1 h-2 w-px bg-line-strong" />
      </div>
      <div className="mt-3 flex justify-between font-display text-2xl font-bold">
        <span>{fmtPct(e.score / 100)}</span>
        <span>{fmtPct(1 - e.score / 100)}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {e.components.map((c) => (
          <div key={c.key} className="rounded-2xl bg-surface-2 p-3">
            <p className="text-xs font-semibold text-muted">
              {labels[c.key]} · {fmtPct(c.weight)}
            </p>
            <p className="mt-1 font-semibold">
              {fmtPct(c.share)} / {fmtPct(1 - c.share)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{t('how.effortBody')}</p>
    </ChartCard>
  );
}
