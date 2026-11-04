import { useState } from 'react';
import { Bubble, ChartCard, SectionHeader, StatTile } from '../components/data';
import { fmtCompact, fmtDate, fmtDuration, fmtHour, fmtHourShort, fmtMonthRange, fmtNum, fmtPct, fmtTimes, weekdayName, fmtDateShort } from '../format';
import { calendarOption, clockOption, columnsOption, erasOption, weekHourOption } from '../charts/options';
import { tk } from '../takeaways';
import { ChartBlock } from './ChartBlock';
import { mainActive, personSeries, type Kit } from './hooks';
import { useEraName } from '../pages/StoryPage';
import { useWidth } from '../components/controls';
import { EChart } from '../charts/EChart';
import { go } from '../router';

export function Time({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const main = mainActive(k);
  const [who, setWho] = useState<number>(-1);
  const cells = who < 0 ? s.time.weekdayHour : s.people[who]!.weekdayHour;
  const silence = s.time.longestSilence;
  const bd = s.time.busiestDay;
  return (
    <section aria-labelledby="time-heading">
      <SectionHeader id="time" title={t('dash.sections.time')} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon="calendar" label={t('stats.busiestDay')} value={bd ? fmtCompact(bd.count) : '–'} sub={bd ? fmtDateShort(bd.day) : undefined} />
        <StatTile icon="clock" label={t('stats.busiestHour')} value={fmtHour(s.time.busiestHour)} sub={weekdayName(s.time.busiestWeekday)} />
        <StatTile icon="zap" label={t('stats.streak')} value={t('common.days', { n: s.time.longestStreak.days })} sub={s.time.longestStreak.days ? `${fmtDateShort(s.time.longestStreak.start)} – ${fmtDateShort(s.time.longestStreak.end)}` : undefined} />
        <StatTile icon="wifiOff" label={t('stats.silence')} value={silence ? fmtDuration(silence.ms) : '–'} sub={silence ? t('stats.brokenBy', { name: name(silence.brokenBy) }) : undefined} />
        <StatTile icon="moon" label={t('stats.nightOwl')} value={fmtPct(s.time.nightOwlPct)} sub="00:00–05:00" />
        <StatTile icon="sun" label={t('stats.earlyBird')} value={fmtPct(s.time.earlyBirdPct)} sub="05:00–08:00" />
        <StatTile icon="sparkles" label={t('stats.weekend')} value={fmtPct(s.time.weekendPct)} sub={`${fmtTimes(s.time.weekendRatio)} / ${t('common.perDay')}`} />
        <StatTile icon="book" label={t('stats.chatAge')} value={t('common.days', { n: fmtNum(s.time.chatAgeDays) })} sub={fmtDateShort(s.meta.firstTs)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CalendarCard k={k} />
        <ChartBlock
          k={k}
          id="weekday-hour"
          wide
          title={t('charts.weekdayHour')}
          takeaway={tk.weekdayHour(s, t)}
          height={(n) => (n ? 260 : 300)}
          deps={[who]}
          extra={
            main.length > 1 ? (
              <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none" role="radiogroup" aria-label={t('common.person')}>
                {[-1, ...main].map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={who === p} className={`chip ${who === p ? '!border-brand !bg-brand-soft !text-brand' : ''}`} onClick={() => setWho(p)}>
                    {p < 0 ? t('common.everyone') : name(p)}
                  </button>
                ))}
              </div>
            ) : null
          }
          build={(th, narrow) => weekHourOption(th, cells, narrow)}
          table={{ columns: [t('common.weekday'), ...Array.from({ length: 24 }, (_, h) => fmtHourShort(h))], rows: Array.from({ length: 7 }, (_, d) => [weekdayName(d, 'short'), ...cells.slice(d * 24, d * 24 + 24)]) }}
        />
        <ChartBlock
          k={k}
          id="hourly"
          title={t('charts.hourly')}
          takeaway={tk.hourly(s, t)}
          height={300}
          build={(th) => clockOption(th, s.time.hourly, th.brand)}
          table={{ columns: [t('common.hour'), t('common.count')], rows: s.time.hourly.map((v, h) => [fmtHourShort(h), v]) }}
        />
        <ChartBlock
          k={k}
          id="weekday"
          title={t('charts.weekday')}
          takeaway={tk.weekday(s, t)}
          height={300}
          build={(th) =>
            columnsOption(
              th,
              Array.from({ length: 7 }, (_, d) => weekdayName(d, 'short')),
              main.length > 1 ? personSeries(k, main, (p) => s.people[p]!.weekday) : [{ name: t('stats.messages'), color: th.brand, data: s.time.weekday }],
              { stack: main.length > 1 },
            )
          }
          table={{ columns: [t('common.weekday'), t('common.count')], rows: s.time.weekday.map((v, d) => [weekdayName(d), v]) }}
          onClick={(p) => {
            const idx = s.people.findIndex((x) => name(x.id) === p.seriesName);
            if (idx >= 0) go('person', idx);
          }}
        />
        {bd && bd.excerpt.length > 0 && (
          <ChartCard id="busiest-day" title={`${t('stats.busiestDay')}: ${fmtDate(bd.day)}`} takeaway={`${t('common.messages', { n: fmtNum(bd.count) })}${bd.keywords.length ? ` · ${bd.keywords.slice(0, 4).join(', ')}` : ''}`}>
            <div className="space-y-3">
              {bd.excerpt.slice(0, 5).map((e, i) => (
                <Bubble key={i} ex={e} />
              ))}
            </div>
          </ChartCard>
        )}
        <ChartCard id="firsts-msg" title={t('stats.firstMessage')} takeaway={s.time.firstMessage ? fmtDate(s.time.firstMessage.ts) : null}>
          <div className="space-y-3">
            {s.time.firstMessage && <Bubble ex={s.time.firstMessage} />}
            <ul className="mt-4 divide-y divide-line text-sm">
              {main.map((p) => {
                const f = s.people[p]!.firstMessage;
                return f ? (
                  <li key={p} className="flex justify-between gap-3 py-2">
                    <span className="font-semibold">{name(p)}</span>
                    <span className="text-muted">{fmtDate(f.ts)}</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        </ChartCard>
      </div>
    </section>
  );
}

function CalendarCard({ k }: { k: Kit }) {
  const { s, t } = k;
  const [ref, w] = useWidth<HTMLDivElement>();
  const narrow = w > 0 && w < 640;
  const built = w > 0 ? calendarOption(k.th, s.time.firstDay, s.time.daily.totals, narrow) : null;
  // Vertical calendars sit side by side; cap columns to what fits and scroll otherwise.
  return (
    <ChartCard
      id="calendar"
      wide
      title={t('charts.calendar')}
      takeaway={tk.calendar(s, t)}
      table={{ columns: [t('common.date'), t('common.count')], rows: s.time.daily.totals.map((v, i) => [new Date(s.time.firstDay + i * 86_400_000).toISOString().slice(0, 10), v]).filter((r) => (r[1] as number) > 0) }}
    >
      <div ref={ref} className={narrow ? 'overflow-x-auto' : ''}>
        {built && (
          <div style={{ minWidth: narrow ? Math.max(w, new Set(s.time.daily.starts.map((d) => new Date(d).getUTCFullYear())).size * 135 + 40) : undefined }}>
            <EChart option={built.option} height={built.height} label={`${t('charts.calendar')}. ${tk.calendar(s, t)}`} />
          </div>
        )}
      </div>
    </ChartCard>
  );
}

export function Eras({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const eraName = useEraName();
  if (s.eras.length === 0) return null;
  const m = s.time.monthly;
  return (
    <section aria-labelledby="eras-heading">
      <SectionHeader id="eras" title={t('dash.sections.eras')} />
      <div className="grid gap-4">
        <ChartBlock
          k={k}
          id="eras-chart"
          title={t('charts.eras')}
          takeaway={tk.eras(s, t, eraName)}
          height={(n) => (n ? 260 : 320)}
          build={(th) => erasOption(th, m.starts, m.totals, s.eras.map((e) => ({ start: e.start, end: e.end, label: eraName(e.kind, e.ordinal), color: th.brand })))}
          table={{ columns: [t('common.value'), t('common.date'), t('eras.perDay', { n: '' }).trim()], rows: s.eras.map((e) => [eraName(e.kind, e.ordinal), fmtMonthRange(e.start, e.end), fmtNum(e.perDay, 1)]) }}
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {s.eras.map((e) => (
            <li key={e.index} className="card relative overflow-hidden p-5">
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, #6a4bff ${e.intensity * 40}%, transparent)` }} aria-hidden="true" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">{fmtMonthRange(e.start, e.end)}</p>
                  <h3 className="mt-1 text-2xl font-[780] leading-tight">{eraName(e.kind, e.ordinal)}</h3>
                </div>
                {e.topEmoji && <span className="emoji text-4xl">{e.topEmoji}</span>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted">{t('stats.perDay')}</dt>
                  <dd className="num text-2xl">{fmtNum(e.perDay, e.perDay < 10 ? 1 : 0)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('stats.messages')}</dt>
                  <dd className="num text-2xl">{fmtCompact(e.messages)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('stats.replyTime')}</dt>
                  <dd className="font-semibold">{e.medianResponseMs !== null ? fmtDuration(e.medianResponseMs) : '–'}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('eras.loudest', { name: '' }).replace(/[:\s]+$/, '')}</dt>
                  <dd className="truncate font-semibold">{name(e.topPerson)}</dd>
                </div>
              </dl>
              {e.topWords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.topWords.map((w) => (
                    <span key={w} className="chip">
                      {w}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-sm text-muted">{t('eras.intensity', { x: fmtTimes(e.intensity) })}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

