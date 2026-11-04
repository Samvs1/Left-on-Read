import type { Award } from '../../engine/types';
import { BarList, Bubble, ChartCard, PersonChip, SectionHeader, Swatch } from '../components/data';
import { Icon } from '../components/Icon';
import { ShareButton } from '../components/ShareButton';
import { fmtCompact, fmtDate, fmtDuration, fmtFixed, fmtMonth, fmtMonthShort, fmtNum, fmtPct, fmtTimes, listFormat } from '../format';
import { linesOption, networkOption } from '../charts/options';
import { tk } from '../takeaways';
import { ChartBlock } from './ChartBlock';
import { mainActive, type Kit } from './hooks';
import { AWARD_META, awardValue } from '../awards';
import { AwardCard } from '../share/cards';
import { go } from '../router';
import { useT, type TKey } from '../../i18n';
import { useNamer } from '../names';

/* ------------------------------------------------------------------ */
/* Mood + laughter                                                      */
/* ------------------------------------------------------------------ */

export function Mood({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const main = mainActive(k);
  const m = s.sentiment.monthly;
  const ranked = [...main].sort((a, b) => s.people[b]!.sentiment - s.people[a]!.sentiment);
  const bestJokes = s.laughter.bestJokes;
  return (
    <section aria-labelledby="mood-heading">
      <SectionHeader id="mood" title={t('dash.sections.mood')} />
      <p className="card mb-4 flex gap-3 p-4 text-sm text-ink-2">
        <Icon name="info" className="mt-0.5 shrink-0 text-brand" />
        {t('mood.disclaimer')}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {m.starts.length >= 2 && (
          <ChartBlock
            k={k}
            id="mood-time"
            wide
            title={t('charts.mood')}
            takeaway={tk.mood(s, t)}
            height={(n) => (n ? 260 : 300)}
            build={(th) =>
              linesOption(
                th,
                m.starts,
                [
                  ...s.meta.mainPeople.map((p, r) => ({ name: name(p), color: k.color(p), data: m.byPerson[r] ?? [] })),
                  ...(s.meta.mainPeople.length > 1 ? [{ name: t('common.everyone'), color: th.muted, data: m.overall, dashed: true }] : []),
                ],
                { xFmt: (v) => fmtMonthShort(Number(v)), valueFmt: (v) => fmtFixed(v, 2), zeroLine: true },
              )
            }
            table={{ columns: [t('common.month'), ...s.meta.mainPeople.map(name), t('common.everyone')], rows: m.starts.map((st, i) => [fmtMonth(st), ...s.meta.mainPeople.map((_, r) => { const v = m.byPerson[r]?.[i]; return v === null || v === undefined ? '–' : fmtFixed(v, 2); }), m.overall[i] === null ? '–' : fmtFixed(m.overall[i]!, 2)]) }}
          />
        )}
        <ChartCard id="good-vibes" title={t('charts.moodPeople')} takeaway={tk.moodPeople(s, t, name)}>
          <ul className="space-y-3">
            {ranked.map((p) => {
              const ps = s.people[p]!;
              return (
                <li key={p}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <Swatch person={p} />
                      {name(p)}
                    </span>
                    <span className="tabular text-ink-2">
                      😊 {fmtPct(ps.positiveShare)} · 😞 {fmtPct(ps.negativeShare)}
                    </span>
                  </div>
                  <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <span style={{ width: `${ps.positiveShare * 100}%`, background: k.dark ? '#3987e5' : '#2a78d6' }} />
                    <span style={{ width: `${ps.negativeShare * 100}%`, background: k.dark ? '#e66767' : '#e34948' }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </ChartCard>
        <ChartCard id="mood-days" title={`${t('mood.best')} · ${t('mood.worst')}`}>
          <div className="grid gap-5">
            {s.sentiment.mostPositiveDay && (
              <div>
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  ☀️ {t('mood.best')}: <span className="text-ink-2">{fmtDate(s.sentiment.mostPositiveDay.day)}</span>
                </p>
                <div className="space-y-2">
                  {s.sentiment.mostPositiveDay.excerpt.slice(0, 2).map((e, i) => (
                    <Bubble key={i} ex={e} compact />
                  ))}
                </div>
              </div>
            )}
            {s.sentiment.mostNegativeDay && (
              <div>
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  🌧️ {t('mood.worst')}: <span className="text-ink-2">{fmtDate(s.sentiment.mostNegativeDay.day)}</span>
                </p>
                <div className="space-y-2">
                  {s.sentiment.mostNegativeDay.excerpt.slice(0, 2).map((e, i) => (
                    <Bubble key={i} ex={e} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        </ChartCard>
        <ChartCard id="laughter" title={t('charts.laughs')} takeaway={tk.laughs(s, t, name)}>
          <div className="mb-4 flex flex-wrap gap-2">
            {s.laughter.kinds.slice(0, 8).map((x) => (
              <span key={x.key} className="chip">
                <span className={/\p{Extended_Pictographic}/u.test(x.key) ? 'emoji' : ''}>{x.key}</span> {fmtCompact(x.count)}
              </span>
            ))}
          </div>
          <BarList items={main.map((p) => ({ key: String(p), person: p, value: s.people[p]!.laughRate, display: `${fmtNum(s.people[p]!.laughs)} · ${fmtPct(s.people[p]!.laughRate / 100)}`, label: name(p) })).sort((a, b) => b.value - a.value)} />
        </ChartCard>
        <ChartCard id="comedian" title={t('charts.comedian')} takeaway={tk.comedian(s, t, name)}>
          <BarList items={main.map((p) => ({ key: String(p), person: p, value: s.laughter.triggeredByPerson[p] ?? 0, label: name(p) })).sort((a, b) => b.value - a.value)} />
          {bestJokes.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 text-sm font-semibold text-muted">{t('charts.bestJokes')}</h4>
              <div className="space-y-3">
                {bestJokes.slice(0, 3).map((j, i) => (
                  <div key={i}>
                    <Bubble ex={j} compact />
                    <p className="mt-1 px-1 text-xs font-semibold text-muted">😂 × {j.laughs}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Group                                                                */
/* ------------------------------------------------------------------ */

export function Group({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const g = s.group;
  if (!g) return null;
  const active = s.people.filter((p) => p.messages > 0);
  const boards: [TKey, (p: (typeof active)[number]) => number, (v: number) => string, boolean?][] = [
    ['stats.words', (p) => p.words, fmtCompact],
    ['stats.avgWords', (p) => p.avgWords, (v) => fmtNum(v, 1)],
    ['stats.replyTime', (p) => (p.responseTime && p.responseTime.count >= 10 ? p.responseTime.median : Infinity), fmtDuration, true],
    ['stats.initiations', (p) => p.initiations, fmtCompact],
    ['stats.emojis', (p) => p.emojis, fmtCompact],
    ['stats.triggered', (p) => p.laughsTriggered, fmtCompact],
    ['stats.media', (p) => p.mediaTotal, fmtCompact],
    ['stats.asked', (p) => p.questionsAsked, fmtCompact],
    ['stats.links', (p) => p.links, fmtCompact],
  ];
  const events = g.memberEvents.slice(-14).reverse();
  return (
    <section aria-labelledby="group-heading">
      <SectionHeader id="group" title={t('dash.sections.group')} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map(([key, get, f, asc]) => {
          const ranked = active
            .map((p) => ({ p, v: get(p) }))
            .filter((x) => Number.isFinite(x.v) && x.v > 0)
            .sort((a, b) => (asc ? a.v - b.v : b.v - a.v))
            .slice(0, 3);
          return (
            <div key={key} className="card p-5">
              <h3 className="text-lg font-bold">{t(key)}</h3>
              <ol className="mt-3 space-y-2">
                {ranked.map(({ p, v }, i) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'bg-sun text-[#16141d]' : 'bg-surface-2 text-muted'}`}>{i + 1}</span>
                    <PersonChip person={p.id} onClick={() => go('person', p.id)} />
                    <span className="tabular ml-auto text-sm font-semibold">{f(v)}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {g.network.edges.length > 0 && (
          <ChartBlock
            k={k}
            id="network"
            wide
            title={t('charts.network')}
            takeaway={tk.network(s, t, name)}
            height={(n) => (n ? 360 : 440)}
            build={(th) => networkOption(th, g.network.nodes.map((n) => ({ id: n.id, name: name(n.id), value: n.messages, color: k.color(n.id) })), g.network.edges)}
            table={{ columns: [t('common.person'), t('common.person'), t('common.count')], rows: g.network.edges.slice(0, 40).map((e) => [name(e.a), name(e.b), e.weight]) }}
            onClick={(p) => {
              const idx = s.people.findIndex((x) => name(x.id) === p.name);
              if (idx >= 0) go('person', idx);
            }}
          />
        )}
        {g.memberCount.length >= 2 && (
          <ChartBlock
            k={k}
            id="membership"
            title={t('charts.membership')}
            takeaway={tk.membership(s, t)}
            height={260}
            build={(th) => linesOption(th, g.memberCount.map((m) => m.ts), [{ name: t('charts.membership'), color: th.brand, data: g.memberCount.map((m) => m.count) }], { xFmt: (v) => fmtMonthShort(Number(v)), min: 0 })}
            table={{ columns: [t('common.month'), t('common.count')], rows: g.memberCount.map((m) => [fmtMonth(m.ts), m.count]) }}
          />
        )}
        {events.length > 0 && (
          <ChartCard id="member-events" title={t('group.events')}>
            <ol className="relative space-y-3 border-l-2 border-line pl-5">
              {events.map((e, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-[var(--surface)] ${e.kind === 'left' || e.kind === 'removed' ? 'bg-coral' : 'bg-mint'}`} aria-hidden="true" />
                  <p className="text-sm">
                    <b>{k.namer.anonymous ? '•••' : e.person}</b> {t(`group.${e.kind}` as TKey)}
                    {e.actor && !k.namer.anonymous ? ` (${e.actor})` : ''}
                  </p>
                  <p className="text-xs text-muted">{fmtDate(e.ts)}</p>
                </li>
              ))}
            </ol>
          </ChartCard>
        )}
        <ChartCard id="lurkers" title={t('charts.lurkers')} takeaway={tk.lurkers(s, t, name)}>
          <ul className="space-y-2">
            {g.lurkers.map((p) => (
              <li key={p} className="flex items-center justify-between gap-3">
                <PersonChip person={p} onClick={() => go('person', p)} />
                <span className="text-sm text-muted">
                  {fmtNum(s.people[p]!.messages)} · {fmtPct(s.people[p]!.share)}
                </span>
              </li>
            ))}
          </ul>
          {g.silentMembers.length > 0 && !k.namer.anonymous && <p className="mt-4 text-sm text-muted">{t('group.silent', { names: listFormat(g.silentMembers.slice(0, 8)) })}</p>}
        </ChartCard>
        <ChartCard id="fastest-pairs" title={t('charts.fastestPairs')} takeaway={tk.fastestPairs(s, t, name)}>
          <ul className="divide-y divide-line">
            {g.fastestPairs.slice(0, 6).map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Swatch person={f.to} />
                  <span className="truncate font-semibold">{name(f.to)}</span>
                  <span className="text-muted">→</span>
                  <Swatch person={f.from} />
                  <span className="truncate">{name(f.from)}</span>
                </span>
                <span className="tabular shrink-0 font-semibold">{fmtDuration(f.medianMs)}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard id="cliques" title={t('charts.cliques')} takeaway={tk.cliques(s, t, name)}>
          <ul className="space-y-2">
            {g.cliques.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Swatch person={c.a} />
                  <b className="truncate">{name(c.a)}</b>
                  <span>＋</span>
                  <Swatch person={c.b} />
                  <b className="truncate">{name(c.b)}</b>
                </span>
                <span className="shrink-0 text-ink-2">
                  {fmtTimes(c.score)} · {fmtCompact(c.replies)}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
        {g.glue >= 0 && (
          <ChartCard id="glue" title={t('charts.glue')} takeaway={tk.glue(s, t, name)}>
            <BarList items={mainActive(k).map((p) => ({ key: String(p), person: p, value: g.revivesByPerson[p] ?? 0, label: name(p) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value)} />
          </ChartCard>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Awards                                                               */
/* ------------------------------------------------------------------ */

export function AwardTile({ award }: { award: Award }) {
  const t = useT();
  const { name } = useNamer();
  const m = AWARD_META[award.id];
  return (
    <li className="group relative">
      <div className="relative h-full overflow-hidden rounded-[1.6rem] p-5 text-white shadow-[var(--shadow-lift)] transition-transform duration-300 [transform-style:preserve-3d] group-hover:-translate-y-1 group-hover:rotate-[-1deg]" style={{ background: `linear-gradient(145deg, ${m.from}, ${m.to})` }}>
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.22)_45%,transparent_60%)] bg-[length:250%_100%] opacity-0 transition-opacity group-hover:animate-[shimmer_1.6s_ease] group-hover:opacity-100" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-2">
          <span className="emoji text-5xl drop-shadow-md">{m.emoji}</span>
          <ShareButton variant="icon" filename={`left-on-read-award-${award.id}`} make={(f) => <AwardCard award={award} format={f} />} />
        </div>
        <h3 className="relative mt-3 text-2xl font-[780] leading-tight">{t(`awards.${award.id}.title` as TKey)}</h3>
        <p className="relative mt-2 flex items-center gap-2 font-display text-lg font-bold">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-white" aria-hidden="true" />
          {name(award.winner)}
        </p>
        <p className="relative mt-2 text-[0.95rem] leading-snug text-white/90">{t(`awards.${award.id}.line` as TKey, { value: awardValue(award) })}</p>
        {award.runnerUp !== null && <p className="relative mt-3 text-xs font-semibold text-white/70">{t('awards.runnerUp', { name: name(award.runnerUp) })}</p>}
      </div>
    </li>
  );
}

export function Awards({ k }: { k: Kit }) {
  const { s, t } = k;
  return (
    <section aria-labelledby="awards-heading">
      <SectionHeader id="awards" title={t('awards.title')}>
        <p className="text-sm text-muted">{t('awards.subtitle')}</p>
      </SectionHeader>
      {s.awards.length === 0 ? (
        <p className="card p-6 text-ink-2">{t('awards.none')}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&_.icon-btn]:text-white [&_.icon-btn:hover]:bg-white/15">
          {s.awards.map((a) => (
            <AwardTile key={a.id} award={a} />
          ))}
        </ul>
      )}
    </section>
  );
}
