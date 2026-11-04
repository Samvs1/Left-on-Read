import { useMemo } from 'react';
import type { ChatStats, PersonStats } from '../../engine/types';
import { useStore } from '../store';
import { useKit } from '../dashboard/hooks';
import { ChartBlock } from '../dashboard/ChartBlock';
import { AwardTile } from '../dashboard/MoodGroupAwards';
import { Avatar, BarList, Bubble, ChartCard, StatTile } from '../components/data';
import { Icon } from '../components/Icon';
import { radarOption, weekHourOption, columnsOption } from '../charts/options';
import { fmtCompact, fmtDate, fmtDuration, fmtHourShort, fmtNum, fmtPct, weekdayName } from '../format';
import { go } from '../router';
import { useT, dict, useLang } from '../../i18n';
import { Footer } from '../components/Footer';

/** Normalised (0–1) profile metrics for the radar. */
function radarValues(s: ChatStats, p: PersonStats): number[] {
  const act = s.people.filter((x) => x.messages > 0);
  const speed = (x: PersonStats) => (x.responseTime ? 1 / (x.responseTime.median / 60_000 + 1) : 0);
  const metrics: ((x: PersonStats) => number)[] = [
    (x) => x.share,
    (x) => x.avgWords,
    (x) => x.emojisPerMessage,
    speed,
    (x) => x.initiationShare,
    (x) => x.laughRate,
    (x) => x.questionRate,
    (x) => x.nightOwlPct,
  ];
  return metrics.map((f) => {
    const max = Math.max(...act.map(f), 1e-9);
    return f(p) / max;
  });
}

function averageValues(s: ChatStats): number[] {
  const act = s.people.filter((x) => x.messages > 0);
  const all = act.map((p) => radarValues(s, p));
  return all[0]!.map((_, i) => all.reduce((a, r) => a + r[i]!, 0) / all.length);
}

export function PersonPage({ personId }: { personId: number }) {
  const t = useT();
  const lang = useLang();
  const stats = useStore((s) => s.chat?.stats ?? null);
  if (!stats || !stats.people[personId]) {
    return (
      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        <div className="skeleton h-40 rounded-3xl" />
      </main>
    );
  }
  return <Profile stats={stats} personId={personId} lang={lang} t={t} />;
}

function Profile({ stats: s, personId }: { stats: ChatStats; personId: number; lang: string; t: ReturnType<typeof useT> }) {
  const k = useKit(s);
  const { t, name } = k;
  const lang = useLang();
  const p = s.people[personId]!;
  const indicators = dict(lang).person.radarMetrics.split(';');
  const values = useMemo(() => radarValues(s, p), [s, p]);
  const avg = useMemo(() => averageValues(s), [s]);
  const won = s.awards.filter((a) => a.winner === personId);
  const others = s.people.filter((x) => x.id !== personId && x.messages > 0);
  const rt = p.responseTime;
  const bins = s.dynamics.responseBins.map((b) => b.label);
  return (
    <>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="pt-6">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('dashboard', 'people')}>
            <Icon name="arrowLeft" size={16} />
            {t('nav.dashboard')}
          </button>
        </div>
        <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar person={personId} size={88} ring />
          <div className="min-w-0">
            <p className="eyebrow">{t('person.title')}</p>
            <h1 className="break-words text-[2.6rem] font-[800] leading-[0.95] sm:text-[3.6rem]">{name(personId)}</h1>
            <p className="mt-2 text-ink-2">
              {t('person.shareOf', { pct: fmtPct(p.share) })}
              {p.firstMessage && ` · ${t('person.firstSeen', { date: fmtDate(p.firstMessage.ts) })}`}
            </p>
          </div>
          {p.signatureEmoji && <span className="emoji text-6xl sm:ml-auto">{p.signatureEmoji.key}</span>}
        </header>
        {others.length > 0 && (
          <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {s.people
              .filter((x) => x.messages > 0)
              .slice(0, 12)
              .map((x) => (
                <button key={x.id} type="button" onClick={() => go('person', x.id)} className={`chip shrink-0 ${x.id === personId ? '!border-brand !bg-brand-soft !text-brand' : ''}`} aria-current={x.id === personId ? 'page' : undefined}>
                  {name(x.id)}
                </button>
              ))}
          </div>
        )}

        <h2 className="mb-4 mt-10 text-2xl font-bold">{t('person.overview')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile icon="message" label={t('stats.messages')} value={fmtCompact(p.messages)} sub={`${fmtNum(p.messagesPerActiveDay, 1)} ${t('stats.perActiveDay').toLowerCase()}`} />
          <StatTile icon="book" label={t('stats.avgWords')} value={fmtNum(p.avgWords, 1)} sub={`${t('stats.vocabulary')}: ${fmtCompact(p.vocabulary)}`} />
          <StatTile icon="clock" label={t('stats.replyTime')} value={rt ? fmtDuration(rt.median) : '–'} sub={rt ? `P25 ${fmtDuration(rt.p25)} · P90 ${fmtDuration(rt.p90)}` : undefined} />
          <StatTile icon="zap" label={t('stats.initiations')} value={fmtPct(p.initiationShare)} sub={`${t('stats.endings')}: ${fmtPct(p.endingShare)}`} />
          <StatTile icon="smile" label={t('stats.emojis')} value={fmtCompact(p.emojis)} sub={`${fmtNum(p.emojisPerMessage, 2)} ${t('common.perMessage')}`} />
          <StatTile icon="sparkles" label={t('stats.laughs')} value={fmtCompact(p.laughs)} sub={`${t('stats.triggered')}: ${fmtNum(p.laughsTriggered)}`} />
          <StatTile icon="moon" label={t('stats.nightOwl')} value={fmtPct(p.nightOwlPct)} sub={`${t('stats.earlyBird')}: ${fmtPct(p.earlyBirdPct)}`} />
          <StatTile icon="eyeOff" label={t('stats.ghosted')} value={fmtNum(p.ghostedOthers)} sub={`${t('stats.gotGhosted')}: ${fmtNum(p.gotGhosted)}`} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {others.length > 0 && (
            <ChartBlock
              k={k}
              id="radar"
              title={t('charts.radar')}
              takeaway={t('takeaways.radar', { group: s.meta.isGroup ? t('dash.sections.group').toLowerCase() : t('common.everyone').toLowerCase() })}
              height={340}
              deps={[personId]}
              build={(th) => radarOption(th, indicators, { name: name(personId), color: k.color(personId), values }, { name: t('person.vsAverage'), values: avg })}
              table={{ columns: [t('common.value'), name(personId), t('person.vsAverage')], rows: indicators.map((ind, i) => [ind, fmtPct(values[i]!), fmtPct(avg[i]!)]) }}
            />
          )}
          <ChartBlock
            k={k}
            id="person-heat"
            title={t('person.timing')}
            takeaway={(() => {
              const c = p.weekdayHour;
              let b = 0;
              for (let i = 1; i < c.length; i++) if (c[i]! > c[b]!) b = i;
              return t('takeaways.weekdayHour', { weekday: weekdayName(Math.floor(b / 24)), hour: fmtHourShort(b % 24) });
            })()}
            height={(n) => (n ? 250 : 300)}
            deps={[personId]}
            build={(th, narrow) => weekHourOption(th, p.weekdayHour, narrow)}
          />
          {rt && (
            <ChartBlock
              k={k}
              id="person-reply"
              title={t('person.reply')}
              takeaway={t('takeaways.replyHist', { pct: fmtPct(((p.responseHistogram[0] ?? 0) + (p.responseHistogram[1] ?? 0)) / Math.max(1, p.responseHistogram.reduce((a, b) => a + b, 0))) })}
              height={260}
              deps={[personId]}
              build={(th) => columnsOption(th, bins, [{ name: name(personId), color: k.color(personId), data: p.responseHistogram }])}
              table={{ columns: [t('common.value'), t('common.count')], rows: bins.map((b, i) => [b, p.responseHistogram[i] ?? 0]) }}
            />
          )}
          <ChartCard id="person-words" title={t('person.words')}>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {p.signatureWords.slice(0, 10).map((w) => (
                <span key={w.key} className="chip !bg-brand-soft !text-brand">
                  {w.key}
                </span>
              ))}
            </div>
            {p.catchphrases.length > 0 && (
              <ul className="mb-4 space-y-1">
                {p.catchphrases.slice(0, 3).map((c) => (
                  <li key={c.key} className="font-display text-lg font-semibold">
                    “{c.key}” <span className="text-sm font-normal text-muted">{c.count}×</span>
                  </li>
                ))}
              </ul>
            )}
            <BarList items={p.topWords.slice(0, 8).map((w) => ({ key: w.key, label: w.key, value: w.count, person: personId }))} />
          </ChartCard>
          <ChartCard id="person-emojis" title={t('person.emojis')}>
            <div className="grid grid-cols-5 gap-2">
              {p.topEmojis.slice(0, 10).map((e) => (
                <div key={e.key} className="flex flex-col items-center rounded-2xl bg-surface-2 py-2.5">
                  <span className="emoji text-3xl">{e.key}</span>
                  <span className="text-xs font-bold">{fmtCompact(e.count)}</span>
                </div>
              ))}
            </div>
            {p.topEmojis.length === 0 && <p className="text-sm text-muted">{t('common.notEnoughData')}</p>}
          </ChartCard>
          <ChartCard id="person-style" title={t('person.style')}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {(
                [
                  [t('stats.questions'), fmtPct(p.questionRate)],
                  [t('stats.exclaim'), fmtPct(p.exclamationRate)],
                  [t('stats.caps'), fmtPct(p.capsRate)],
                  [t('stats.lowercase'), fmtPct(p.lowercaseRate)],
                  [t('stats.ellipsis'), fmtPct(p.ellipsisRate)],
                  [t('stats.richness'), p.lexicalRichness ? fmtNum(p.lexicalRichness) : '–'],
                  [t('stats.doubleTexts'), fmtNum(p.doubleTexts)],
                  [t('stats.monologue'), p.longestMonologue ? fmtNum(p.longestMonologue.messages) : '–'],
                  [t('stats.apologies'), fmtNum(p.apologies)],
                  [t('stats.loveYous'), fmtNum(p.loveYous)],
                  [t('stats.swears'), fmtNum(p.swears)],
                  [t('stats.media'), fmtNum(p.mediaTotal)],
                ] as [string, string][]
              ).map(([label, v]) => (
                <div key={label} className="flex justify-between gap-2 border-b border-line pb-2">
                  <dt className="text-ink-2">{label}</dt>
                  <dd className="tabular font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </ChartCard>
          {p.longestMessage && (
            <ChartCard id="person-longest" title={t('stats.longest')} takeaway={t('common.words', { n: fmtNum(p.longestMessage.words) })}>
              <div className="max-h-72 overflow-y-auto">
                <Bubble ex={p.longestMessage} />
              </div>
            </ChartCard>
          )}
        </div>

        <h2 className="mb-4 mt-12 text-2xl font-bold">{t('person.awards')}</h2>
        {won.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&_.icon-btn]:text-white">
            {won.map((a) => (
              <AwardTile key={a.id} award={a} />
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">{t('person.noAwards')}</p>
        )}
      </main>
      <Footer />
    </>
  );
}
