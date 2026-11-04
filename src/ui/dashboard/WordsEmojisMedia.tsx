import { useEffect, useRef, useState } from 'react';
import type { MediaKind, WordSearchResult } from '../../engine/types';
import { BarList, Bubble, ChartCard, SectionHeader, StatTile, Swatch } from '../components/data';
import { Icon, type IconName } from '../components/Icon';
import { fmtCompact, fmtDate, fmtDuration, fmtMonth, fmtMonthShort, fmtNum, fmtPct } from '../format';
import { columnsOption, linesOption } from '../charts/options';
import { tk } from '../takeaways';
import { ChartBlock } from './ChartBlock';
import { mainActive, type Kit } from './hooks';
import { searchWord } from '../store';
import { EChart } from '../charts/EChart';
import { useT } from '../../i18n';

/* ------------------------------------------------------------------ */
/* Words                                                                */
/* ------------------------------------------------------------------ */

export function Words({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const main = mainActive(k);
  const split = (byPerson: number[]) => byPerson;
  return (
    <section aria-labelledby="words-heading">
      <SectionHeader id="words" title={t('dash.sections.words')} />
      <WordSearch k={k} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard id="top-words" title={t('charts.topWords')} takeaway={tk.topWords(s, t)} table={{ columns: [t('common.value'), t('common.count')], rows: s.words.topWords.map((w) => [w.key, w.count]) }}>
          <BarList items={s.words.topWords.slice(0, 15).map((w) => ({ key: w.key, label: w.key, value: w.count, split: split(w.byPerson) }))} />
        </ChartCard>
        <ChartCard id="bigrams" title={t('charts.bigrams')} takeaway={tk.bigrams(s, t)} table={{ columns: [t('common.value'), t('common.count')], rows: [...s.words.topBigrams, ...s.words.topTrigrams].map((w) => [w.key, w.count]) }}>
          <BarList items={s.words.topBigrams.slice(0, 8).map((w) => ({ key: w.key, label: w.key, value: w.count, split: w.byPerson }))} />
          {s.words.topTrigrams.length > 0 && (
            <>
              <h4 className="mb-3 mt-6 text-sm font-semibold text-muted">{t('charts.trigrams')}</h4>
              <BarList items={s.words.topTrigrams.slice(0, 6).map((w) => ({ key: w.key, label: w.key, value: w.count, split: w.byPerson }))} />
            </>
          )}
        </ChartCard>
        <ChartCard id="signature" title={t('charts.signature')} takeaway={tk.signature(s, t, name)}>
          <ul className="space-y-4">
            {main.map((p) => {
              const ps = s.people[p]!;
              return (
                <li key={p}>
                  <p className="mb-1.5 flex items-center gap-2 font-semibold">
                    <Swatch person={p} />
                    {name(p)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ps.signatureWords.length ? (
                      ps.signatureWords.slice(0, 8).map((w) => (
                        <span key={w.key} className="chip" title={`${w.count}×`}>
                          {w.key}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted">{t('common.notEnoughData')}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </ChartCard>
        <ChartCard id="catchphrases" title={t('charts.catchphrases')} takeaway={tk.catchphrases(s, t, name)}>
          <ul className="space-y-3">
            {main
              .filter((p) => s.people[p]!.catchphrases.length > 0)
              .map((p) => (
                <li key={p} className="rounded-2xl bg-surface-2 p-3.5">
                  <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                    <Swatch person={p} />
                    {name(p)}
                  </p>
                  <ul className="space-y-1">
                    {s.people[p]!.catchphrases.slice(0, 3).map((c) => (
                      <li key={c.key} className="flex justify-between gap-3">
                        <span className="font-display text-lg font-semibold">“{c.key}”</span>
                        <span className="tabular shrink-0 text-sm text-muted">
                          {c.count}× · {fmtPct(c.share)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            {main.every((p) => s.people[p]!.catchphrases.length === 0) && <li className="text-sm text-muted">{t('common.notEnoughData')}</li>}
          </ul>
        </ChartCard>
        <ChartCard id="greetings" title={t('charts.greetings')} takeaway={tk.greetings(s, t)}>
          <div className="grid grid-cols-2 gap-4">
            <BarList items={s.words.greetings.slice(0, 6).map((w) => ({ key: w.key, label: w.key, value: w.count }))} />
            <BarList items={s.words.goodbyes.slice(0, 6).map((w) => ({ key: w.key, label: w.key, value: w.count }))} />
          </div>
        </ChartCard>
        <ChartCard id="swears" title={t('charts.swears')} takeaway={tk.swears(s, t, name)}>
          <div className="mb-4 flex flex-wrap gap-2">
            {main.map((p) => (
              <span key={p} className="chip">
                <Swatch person={p} />
                {name(p)}: {fmtNum(s.people[p]!.swears)} · {fmtNum(s.people[p]!.swearsPer100, 1)}/100
              </span>
            ))}
          </div>
          <BarList items={s.words.swears.top.slice(0, 8).map((w) => ({ key: w.key, label: w.key, value: w.count }))} emptyText={t('takeaways.swearsNone')} />
        </ChartCard>
        {s.duo && s.duo.firsts.length > 0 && <Firsts k={k} />}
      </div>
    </section>
  );
}

function Firsts({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const duo = s.duo!;
  return (
    <ChartCard id="firsts" wide title={t('charts.firsts')} takeaway={t('takeaways.firsts')}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold" />
              {[duo.a, duo.b].map((p) => (
                <th key={p} scope="col" className="px-2 py-2 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Swatch person={p} />
                    {name(p)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {duo.firsts.map((f) => (
              <tr key={f.word} className="border-t border-line">
                <th scope="row" className="py-2.5 pr-3 text-left font-display text-base font-semibold">
                  “{f.word}”
                </th>
                {[duo.a, duo.b].map((p) => (
                  <td key={p} className="px-2 py-2.5 text-ink-2">
                    {f.byPerson[p] ? fmtDate(f.byPerson[p]!.ts) : '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function WordSearch({ k }: { k: Kit }) {
  const { s, t, name, th } = k;
  const [q, setQ] = useState('');
  const [res, setRes] = useState<WordSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setRes(null);
      return;
    }
    timer.current = setTimeout(() => {
      setBusy(true);
      void searchWord(q).then((r) => {
        setRes(r);
        setBusy(false);
      });
    }, 220);
  }, [q, s]);
  const top = res ? res.byPerson.reduce((best, v, i) => (v > (res.byPerson[best] ?? 0) ? i : best), 0) : 0;
  return (
    <ChartCard id="search" title={t('charts.search')} takeaway={res ? (res.total > 0 ? t('takeaways.search', { name: name(top), n: fmtNum(res.byPerson[top] ?? 0) }) : t('takeaways.searchNone')) : null}>
      <label className="relative block">
        <span className="sr-only">{t('charts.search')}</span>
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input className="field !rounded-full !py-3 !pl-11 text-lg" value={q} onChange={(e) => setQ(e.target.value)} placeholder="pizza, sorry, ❤️, love*" type="search" enterKeyHint="search" />
      </label>
      {busy && <p className="mt-3 text-sm text-muted">{t('common.loading')}</p>}
      {res && res.total > 0 && (
        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="num text-5xl">{fmtNum(res.total)}</p>
            <p className="text-sm text-muted">
              {t('stats.occurrences')} · {t('common.messages', { n: fmtNum(res.messages) })}
            </p>
            <div className="mt-4">
              <BarList items={res.byPerson.map((v, p) => ({ key: String(p), person: p, value: v, label: name(p) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 8)} />
            </div>
            {res.first && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{fmtDate(res.first.ts)}</p>
                <Bubble ex={res.first} compact />
              </div>
            )}
          </div>
          <EChart
            height={240}
            label={`${t('charts.search')}: ${res.query}`}
            option={linesOption(th, res.monthly.starts, [{ name: res.query, color: th.brand, data: res.monthly.counts }], { xFmt: (v) => fmtMonthShort(Number(v)) })}
          />
        </div>
      )}
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* Emojis                                                               */
/* ------------------------------------------------------------------ */

const TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];

export function Emojis({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const main = mainActive(k);
  if (s.emojis.total === 0) return null;
  const toned = s.emojis.skinTones.slice(1).reduce((a, b) => a + b, 0);
  const em = s.emojis.monthly;
  return (
    <section aria-labelledby="emojis-heading">
      <SectionHeader id="emojis" title={t('dash.sections.emojis')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard id="top-emojis" wide title={t('charts.topEmojis')} takeaway={tk.topEmojis(s, t)} table={{ columns: [t('common.value'), t('common.count'), ...main.map(name)], rows: s.emojis.top.map((e) => [e.display, e.count, ...main.map((p) => e.byPerson[p] ?? 0)]) }}>
          <ol className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-8">
            {s.emojis.top.slice(0, 16).map((e, i) => (
              <li key={e.key} className={`relative flex flex-col items-center rounded-2xl bg-surface-2 p-3 ${i === 0 ? 'col-span-1 ring-2 ring-brand/40' : ''}`}>
                <span className="absolute left-2 top-1.5 text-[0.65rem] font-bold text-muted">{i + 1}</span>
                <span className="emoji text-4xl">{e.display}</span>
                <span className="mt-1 text-sm font-bold">{fmtCompact(e.count)}</span>
                <span className="mt-1.5 flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
                  {main.map((p) => (e.byPerson[p] ? <span key={p} style={{ flex: e.byPerson[p], background: k.color(p) }} /> : null))}
                </span>
              </li>
            ))}
          </ol>
        </ChartCard>
        <ChartCard id="signature-emoji" title={t('stats.signatureEmoji')}>
          <ul className="grid grid-cols-2 gap-3">
            {main.map((p) => {
              const ps = s.people[p]!;
              return (
                <li key={p} className="rounded-2xl bg-surface-2 p-3.5">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Swatch person={p} />
                    <span className="truncate">{name(p)}</span>
                  </p>
                  <p className="emoji mt-2 text-4xl">{ps.signatureEmoji?.key ?? ps.topEmojis[0]?.key ?? '—'}</p>
                  <p className="mt-1 text-xs text-muted">{ps.topEmojis.slice(0, 5).map((e) => e.key).join(' ')}</p>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {fmtNum(ps.emojisPerMessage, 2)} {t('common.perMessage')}
                  </p>
                </li>
              );
            })}
          </ul>
        </ChartCard>
        {em.series.length > 0 && em.starts.length >= 2 && (
          <ChartBlock
            k={k}
            id="emoji-time"
            title={t('charts.emojiTime')}
            takeaway={tk.emojiTime(s, t)}
            height={280}
            build={(th) =>
              linesOption(
                th,
                em.starts,
                em.series.map((x, i) => ({ name: x.display, color: (th.dark ? ['#9085e9', '#d95926', '#199e70', '#c98500', '#d55181'] : ['#6250d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'])[i]!, data: x.counts })),
                { xFmt: (v) => fmtMonthShort(Number(v)) },
              )
            }
            table={{ columns: [t('common.month'), ...em.series.map((x) => x.display)], rows: em.starts.map((m, i) => [fmtMonth(m), ...em.series.map((x) => x.counts[i] ?? 0)]) }}
          />
        )}
        <ChartCard id="skin-hearts" title={t('charts.hearts')} takeaway={tk.hearts(s, t)}>
          <div className="flex flex-wrap gap-2">
            {s.emojis.hearts.slice(0, 12).map((h) => (
              <span key={h.color} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5">
                <span className="emoji text-xl">{h.display}</span>
                <span className="text-sm font-bold">{fmtCompact(h.count)}</span>
              </span>
            ))}
            {s.emojis.hearts.length === 0 && <p className="text-sm text-muted">{t('common.notEnoughData')}</p>}
          </div>
          {toned > 0 && (
            <>
              <h4 className="mb-2 mt-6 text-sm font-semibold text-muted">{t('charts.skinTones')}</h4>
              <div className="flex gap-2">
                {s.emojis.skinTones.slice(1).map((v, i) => (
                  <span key={i} className="flex flex-1 flex-col items-center rounded-2xl bg-surface-2 py-2.5">
                    <span className="emoji text-2xl">👋{TONES[i + 1]}</span>
                    <span className="text-xs font-bold">{fmtPct(v / toned)}</span>
                  </span>
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
/* Media                                                                */
/* ------------------------------------------------------------------ */

const MEDIA_ICON: Record<MediaKind, IconName> = {
  image: 'image',
  video: 'film',
  audio: 'mic',
  sticker: 'smile',
  gif: 'sparkles',
  document: 'file',
  contact: 'users',
  location: 'pin',
  poll: 'table',
  media: 'layers',
};

export function useMediaName() {
  const t = useT();
  return (k: string) =>
    ({
      image: t('media.image'),
      video: t('media.video'),
      audio: t('media.audio'),
      sticker: t('media.sticker'),
      gif: t('media.gif'),
      document: t('media.document'),
      contact: t('media.contact'),
      location: t('media.location'),
      poll: t('media.poll'),
      media: t('media.media'),
    })[k] ?? k;
}

export function Media({ k }: { k: Kit }) {
  const { s, t, name } = k;
  const main = mainActive(k);
  const mediaName = useMediaName();
  const kinds = (Object.keys(s.media.byType) as MediaKind[]).filter((x) => s.media.byType[x] > 0).sort((a, b) => s.media.byType[b] - s.media.byType[a]);
  return (
    <section aria-labelledby="media-heading">
      <SectionHeader id="media" title={t('dash.sections.media')} />
      {s.meta.unknownMediaShare > 0.5 && (
        <p className="card mb-4 flex gap-3 p-4 text-sm text-ink-2">
          <Icon name="info" className="mt-0.5 shrink-0 text-brand" />
          {t('dash.unknownMedia')}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {kinds.slice(0, 5).map((kd) => (
          <StatTile key={kd} icon={MEDIA_ICON[kd]} label={mediaName(kd)} value={fmtCompact(s.media.byType[kd])} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {kinds.length > 0 && (
          <ChartBlock
            k={k}
            id="media-people"
            title={t('charts.mediaPeople')}
            takeaway={tk.mediaPeople(s, t, name)}
            height={(n) => Math.max(220, main.length * (n ? 46 : 42) + 80)}
            build={(th) =>
              columnsOption(
                th,
                main.map(name),
                kinds.slice(0, 8).map((kd, i) => ({ name: mediaName(kd), color: (th.dark ? ['#9085e9', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#3987e5', '#e66767'] : ['#6250d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#2a78d6', '#e34948'])[i]!, data: main.map((p) => s.media.byPerson[kd][p] ?? 0) })),
                { horizontal: true, stack: true },
              )
            }
            table={{ columns: [t('common.person'), ...kinds.map(mediaName)], rows: main.map((p) => [name(p), ...kinds.map((kd) => s.media.byPerson[kd][p] ?? 0)]) }}
          />
        )}
        <ChartCard id="domains" title={t('charts.domains')} takeaway={tk.domains(s, t)}>
          <BarList items={s.media.links.topDomains.map((d) => ({ key: d.key, label: d.key, value: d.count }))} />
          <div className="mt-4 flex flex-wrap gap-2">
            {main.map((p) => (
              <span key={p} className="chip">
                <Swatch person={p} />
                {name(p)}: {fmtNum(s.people[p]!.links)}
              </span>
            ))}
          </div>
        </ChartCard>
        <ChartCard id="deleted-edited" title={t('charts.deletedEdited')} takeaway={t('takeaways.deletedEdited', { deleted: fmtNum(s.media.deleted.total), edited: fmtNum(s.media.edited.total) })}>
          <ul className="divide-y divide-line">
            {main.map((p) => (
              <li key={p} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2 font-semibold">
                  <Swatch person={p} />
                  {name(p)}
                </span>
                <span className="tabular text-sm text-ink-2">
                  🗑️ {fmtNum(s.people[p]!.deleted)} · ✏️ {fmtNum(s.people[p]!.edited)}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
        {s.media.calls.total > 0 && (
          <ChartCard id="calls" title={t('charts.calls')} takeaway={t('takeaways.calls', { n: fmtNum(s.media.calls.total), missed: fmtNum(s.media.calls.missed) })}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="num text-3xl">{fmtNum(s.media.calls.total)}</p>
                <p className="text-xs font-semibold text-muted">{t('stats.calls')}</p>
              </div>
              <div>
                <p className="num text-3xl">{fmtNum(s.media.calls.missed)}</p>
                <p className="text-xs font-semibold text-muted">{t('stats.missedCalls')}</p>
              </div>
              <div>
                <p className="num text-3xl">{s.media.calls.durationSec ? fmtDuration(s.media.calls.durationSec * 1000) : '–'}</p>
                <p className="text-xs font-semibold text-muted">{t('stats.callTime')}</p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-line text-sm">
              {main.map((p) => (
                <li key={p} className="flex justify-between py-2">
                  <span className="font-semibold">{name(p)}</span>
                  <span className="text-ink-2">
                    {fmtNum(s.media.calls.byPerson[p] ?? 0)} · {fmtNum(s.media.calls.missedByPerson[p] ?? 0)} {t('stats.missedCalls').toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </ChartCard>
        )}
        {s.media.polls.length > 0 && (
          <ChartCard id="polls" title={t('charts.polls')}>
            <ul className="space-y-4">
              {s.media.polls.slice(-4).reverse().map((p, i) => (
                <li key={i}>
                  <p className="font-semibold">{p.question}</p>
                  <p className="mb-2 text-xs text-muted">
                    {name(p.author)} · {fmtDate(p.ts)}
                  </p>
                  <BarList items={p.options.map((o) => ({ key: o.label, label: o.label, value: o.votes }))} />
                </li>
              ))}
            </ul>
          </ChartCard>
        )}
      </div>
    </section>
  );
}

