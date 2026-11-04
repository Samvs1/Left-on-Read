import type { PersonStats } from '../../engine/types';
import { Avatar, ChartCard, SectionHeader, StatTile, Swatch } from '../components/data';
import { fmtCompact, fmtDuration, fmtFixed, fmtHourShort, fmtMonth, fmtMonthShort, fmtNum, fmtPct } from '../format';
import { boxplotOption, columnsOption, linesOption, matrixOption, durFmt } from '../charts/options';
import { go } from '../router';
import { tk } from '../takeaways';
import { ChartBlock } from './ChartBlock';
import { mainActive, personSeries, type Kit } from './hooks';
import { Icon } from '../components/Icon';

/* ------------------------------------------------------------------ */
/* People                                                               */
/* ------------------------------------------------------------------ */

export function People({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const ranked = [...s.people].filter((p) => p.messages > 0).sort((a, b) => b.messages - a.messages);
  const main = mainActive(k);
  const styleRows: [string, (p: PersonStats) => number, (v: number) => string][] = [
    [t('stats.avgWords'), (p) => p.avgWords, (v) => fmtNum(v, 1)],
    [t('stats.richness'), (p) => p.lexicalRichness ?? 0, (v) => (v ? fmtNum(v) : '–')],
    [t('stats.wordLength'), (p) => p.avgWordLength, (v) => fmtFixed(v, 1)],
    [t('stats.emojis'), (p) => p.emojisPerMessage, (v) => fmtFixed(v, 2)],
    [t('stats.questions'), (p) => p.questionRate, (v) => fmtPct(v)],
    [t('stats.exclaim'), (p) => p.exclamationRate, (v) => fmtPct(v)],
    [t('stats.caps'), (p) => p.capsRate, (v) => fmtPct(v)],
    [t('stats.lowercase'), (p) => p.lowercaseRate, (v) => fmtPct(v)],
    [t('stats.period'), (p) => p.periodRate, (v) => fmtPct(v)],
    [t('stats.ellipsis'), (p) => p.ellipsisRate, (v) => fmtPct(v)],
    [t('stats.emojiOnly'), (p) => p.emojiOnlyRate, (v) => fmtPct(v)],
    [t('stats.elongations'), (p) => p.elongations, (v) => fmtNum(v)],
    [t('stats.edited'), (p) => p.edited, (v) => fmtNum(v)],
    [t('stats.deleted'), (p) => p.deleted, (v) => fmtNum(v)],
  ];
  const cols = ranked.filter((p) => main.includes(p.id)).slice(0, 6);
  return (
    <section aria-labelledby="people-heading">
      <SectionHeader id="people" title={t('dash.sections.people')} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.slice(0, 9).map((p) => (
          <button key={p.id} type="button" onClick={() => go('person', p.id)} className="card group flex flex-col gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
            <div className="flex items-center gap-3">
              <Avatar person={p.id} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-bold">{name(p.id)}</p>
                <p className="text-sm text-muted">
                  {t('common.messages', { n: fmtCompact(p.messages) })} · {fmtPct(p.share)}
                </p>
              </div>
              {p.signatureEmoji && <span className="emoji text-3xl">{p.signatureEmoji.key}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.signatureWords.slice(0, 4).map((w) => (
                <span key={w.key} className="chip">
                  {w.key}
                </span>
              ))}
            </div>
            {p.catchphrases[0] && <p className="text-sm text-ink-2">“{p.catchphrases[0].key}”</p>}
            <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
              <div>
                <p className="num text-xl">{p.responseTime ? fmtDuration(p.responseTime.median) : '–'}</p>
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{t('stats.replyTime')}</p>
              </div>
              <div>
                <p className="num text-xl">{fmtPct(p.initiationShare)}</p>
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{t('stats.initiations')}</p>
              </div>
              <div>
                <p className="num text-xl">{fmtNum(p.avgWords, 1)}</p>
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">{t('stats.avgWords')}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
              {t('dash.openProfile')} <Icon name="arrowRight" size={15} />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <ChartCard id="style" title={t('charts.style')} takeaway={tk.style(s, t, name)}>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th scope="col" className="py-2 pr-3 font-semibold text-muted" />
                  {cols.map((p) => (
                    <th key={p.id} scope="col" className="px-2 py-2 text-right font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <Swatch person={p.id} />
                        <span className="max-w-[7rem] truncate">{name(p.id)}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {styleRows.map(([label, get, f]) => {
                  const vals = cols.map(get);
                  const max = Math.max(...vals);
                  return (
                    <tr key={label} className="border-t border-line">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-ink-2">
                        {label}
                      </th>
                      {vals.map((v, i) => (
                        <td key={cols[i]!.id} className={`tabular px-2 py-2 text-right ${v === max && max > 0 ? 'font-bold text-ink' : 'text-ink-2'}`}>
                          {f(v)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dynamics                                                             */
/* ------------------------------------------------------------------ */

export function Dynamics({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const main = mainActive(k);
  const withRt = main.filter((p) => s.people[p]!.responseTime && s.people[p]!.responseTime!.count >= 3);
  const bins = s.dynamics.responseBins.map((b) => b.label);
  const im = s.dynamics.interest;
  const total = (p: number) => s.people[p]!.responseHistogram.reduce((a, b) => a + b, 0) || 1;
  const openPerson = (p: { seriesName?: string; name?: string }) => {
    const idx = s.people.findIndex((x) => name(x.id) === (p.seriesName ?? p.name));
    if (idx >= 0) go('person', idx);
  };
  return (
    <section aria-labelledby="dynamics-heading">
      <SectionHeader id="dynamics" title={t('dash.sections.dynamics')} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon="message" label={t('stats.conversations')} value={fmtCompact(s.dynamics.conversations)} sub={`${fmtNum(s.dynamics.avgConversationMessages, 1)} ${t('common.messagesShort')}`} />
        <StatTile icon="clock" label={t('stats.replyTime')} value={s.dynamics.responseTime ? fmtDuration(s.dynamics.responseTime.median) : '–'} sub={s.dynamics.responseTime ? `P90 ${fmtDuration(s.dynamics.responseTime.p90)}` : undefined} />
        <StatTile icon="users" label={t('stats.perTurn')} value={fmtNum(s.dynamics.avgMessagesPerTurn, 1)} />
        <StatTile icon="refresh" label={t('stats.revives')} value={fmtNum(s.people.reduce((a, p) => a + p.revives, 0))} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartBlock
          k={k}
          id="initiations"
          title={t('charts.initiations')}
          takeaway={tk.initiations(s, t, name)}
          height={(n) => Math.max(180, main.length * (n ? 56 : 52) + 60)}
          build={(th) =>
            columnsOption(
              th,
              main.map(name),
              [
                { name: t('stats.initiations'), color: th.brand, data: main.map((p) => s.people[p]!.initiationShare) },
                { name: t('stats.endings'), color: th.dark ? '#d95926' : '#eb6834', data: main.map((p) => s.people[p]!.endingShare) },
              ],
              { horizontal: true, valueFmt: (v) => fmtPct(v) },
            )
          }
          table={{ columns: [t('common.person'), t('stats.initiations'), t('stats.endings')], rows: main.map((p) => [name(p), fmtPct(s.people[p]!.initiationShare), fmtPct(s.people[p]!.endingShare)]) }}
        />
        {withRt.length > 0 && (
          <ChartBlock
            k={k}
            id="reply-box"
            title={t('charts.replyBox')}
            takeaway={tk.reply(s, t, name)}
            height={Math.max(170, withRt.length * 54 + 50)}
            build={(th) =>
              boxplotOption(
                th,
                withRt.map((p) => {
                  const r = s.people[p]!.responseTime!;
                  return { name: name(p), color: k.color(p), p: [r.p5, r.p25, r.median, r.p75, r.p95] };
                }),
              )
            }
            table={{
              columns: [t('common.person'), 'P25', t('common.median'), 'P75', 'P90'],
              rows: withRt.map((p) => {
                const r = s.people[p]!.responseTime!;
                return [name(p), fmtDuration(r.p25), fmtDuration(r.median), fmtDuration(r.p75), fmtDuration(r.p90)];
              }),
            }}
          />
        )}
        {withRt.length > 0 && (
          <ChartBlock
            k={k}
            id="reply-hist"
            title={t('charts.replyHist')}
            takeaway={tk.replyHist(s, t)}
            height={280}
            build={(th) => columnsOption(th, bins, personSeries(k, withRt, (p) => s.people[p]!.responseHistogram.map((v) => v / total(p))), { valueFmt: (v) => fmtPct(v) })}
            table={{ columns: [t('common.value'), ...withRt.map(name)], rows: bins.map((b, i) => [b, ...withRt.map((p) => fmtPct((s.people[p]!.responseHistogram[i] ?? 0) / total(p)))]) }}
            onClick={openPerson}
          />
        )}
        {withRt.length > 0 && (
          <ChartBlock
            k={k}
            id="reply-hour"
            title={t('charts.replyHour')}
            takeaway={tk.replyHour(s, t)}
            height={280}
            build={(th) =>
              linesOption(
                th,
                Array.from({ length: 24 }, (_, h) => fmtHourShort(h)),
                personSeries(k, withRt, (p) => s.people[p]!.responseByHour.map((v) => (v === null ? null : v))),
                { valueFmt: durFmt, log: true },
              )
            }
            table={{ columns: [t('common.hour'), ...withRt.map(name)], rows: Array.from({ length: 24 }, (_, h) => [fmtHourShort(h), ...withRt.map((p) => { const v = s.people[p]!.responseByHour[h]; return v === null || v === undefined ? '–' : fmtDuration(v); })]) }}
            onClick={openPerson}
          />
        )}
        <ChartBlock
          k={k}
          id="double-ghost"
          title={t('charts.doubleGhost')}
          takeaway={tk.doubleGhost(s, t, name)}
          height={(n) => Math.max(200, main.length * (n ? 70 : 60) + 60)}
          build={(th) =>
            columnsOption(
              th,
              main.map(name),
              [
                { name: t('stats.doubleTexts'), color: th.dark ? '#9085e9' : '#6250d6', data: main.map((p) => s.people[p]!.doubleTexts) },
                { name: t('stats.ghosted'), color: th.dark ? '#d95926' : '#eb6834', data: main.map((p) => s.people[p]!.ghostedOthers) },
                { name: t('stats.gotGhosted'), color: th.dark ? '#199e70' : '#1baf7a', data: main.map((p) => s.people[p]!.gotGhosted) },
              ],
              { horizontal: true },
            )
          }
          table={{ columns: [t('common.person'), t('stats.doubleTexts'), t('stats.ghosted'), t('stats.gotGhosted'), t('stats.ghostRate')], rows: main.map((p) => { const x = s.people[p]!; return [name(p), x.doubleTexts, x.ghostedOthers, x.gotGhosted, fmtPct(x.ghostRate)]; }) }}
        />
        <ChartBlock
          k={k}
          id="questions"
          title={t('charts.questions')}
          takeaway={tk.questions(s, t, name)}
          height={(n) => Math.max(200, main.length * (n ? 70 : 60) + 60)}
          build={(th) =>
            columnsOption(
              th,
              main.map(name),
              [
                { name: t('stats.asked'), color: th.dark ? '#9085e9' : '#6250d6', data: main.map((p) => s.people[p]!.questionsAsked) },
                { name: t('stats.gotAnswered'), color: th.dark ? '#d95926' : '#eb6834', data: main.map((p) => s.people[p]!.questionsAnsweredByOthers) },
                { name: t('stats.answered'), color: th.dark ? '#199e70' : '#1baf7a', data: main.map((p) => s.people[p]!.questionsAnswered) },
              ],
              { horizontal: true },
            )
          }
          table={{ columns: [t('common.person'), t('stats.asked'), t('stats.gotAnswered'), t('stats.answered')], rows: main.map((p) => { const x = s.people[p]!; return [name(p), x.questionsAsked, x.questionsAnsweredByOthers, x.questionsAnswered]; }) }}
        />
        <ChartBlock
          k={k}
          id="conv-length"
          title={t('charts.convLength')}
          takeaway={tk.convLength(s, t)}
          height={260}
          build={(th) => columnsOption(th, s.dynamics.conversationLengthBins.map((b) => b.label), [{ name: t('stats.conversations'), color: th.brand, data: s.dynamics.conversationLengthBins.map((b) => b.count) }])}
          table={{ columns: [t('common.messages', { n: '' }).trim() || t('stats.messages'), t('common.count')], rows: s.dynamics.conversationLengthBins.map((b) => [b.label, b.count]) }}
        />
        {im.months.length >= 3 && (
          <ChartBlock
            k={k}
            id="interest-init"
            title={t('charts.interestInit')}
            takeaway={tk.interestInit(s, t, name)}
            height={280}
            build={(th) =>
              linesOption(
                th,
                im.months,
                s.meta.mainPeople.map((p, r) => ({ name: name(p), color: k.color(p), data: im.initiationShare[r] ?? [] })).filter((x) => x.data.some((v) => v !== null)),
                { valueFmt: (v) => fmtPct(v), xFmt: (v) => fmtMonthShort(Number(v)), min: 0, max: 1 },
              )
            }
            table={{ columns: [t('common.month'), ...s.meta.mainPeople.map(name)], rows: im.months.map((m, i) => [fmtMonth(m), ...s.meta.mainPeople.map((_, r) => { const v = im.initiationShare[r]?.[i]; return v === null || v === undefined ? '–' : fmtPct(v); })]) }}
            onClick={openPerson}
          />
        )}
        {im.months.length >= 3 && withRt.length > 0 && (
          <ChartBlock
            k={k}
            id="interest-speed"
            title={t('charts.interestSpeed')}
            height={280}
            build={(th) =>
              linesOption(
                th,
                im.months,
                s.meta.mainPeople.map((p, r) => ({ name: name(p), color: k.color(p), data: im.medianResponse[r] ?? [] })).filter((x) => x.data.some((v) => v !== null)),
                { valueFmt: durFmt, xFmt: (v) => fmtMonthShort(Number(v)), log: true },
              )
            }
            table={{ columns: [t('common.month'), ...s.meta.mainPeople.map(name)], rows: im.months.map((m, i) => [fmtMonth(m), ...s.meta.mainPeople.map((_, r) => { const v = im.medianResponse[r]?.[i]; return v === null || v === undefined ? '–' : fmtDuration(v); })]) }}
            onClick={openPerson}
          />
        )}
        {s.meta.isGroup && s.dynamics.matrixPeople.length >= 3 && (
          <ChartBlock
            k={k}
            id="reply-matrix"
            wide
            title={t('charts.replyMatrix')}
            takeaway={tk.replyMatrix(s, t, name)}
            height={(n) => Math.max(300, k.rows.length * (n ? 40 : 46) + 100)}
            build={(th) => matrixOption(th, k.rows.map((r) => r.name), s.dynamics.replyMatrix)}
            table={{ columns: ['→', ...k.rows.map((r) => r.name)], rows: k.rows.map((r, i) => [r.name, ...(s.dynamics.replyMatrix[i] ?? [])]) }}
          />
        )}
      </div>
    </section>
  );
}
