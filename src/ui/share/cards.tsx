/**
 * Share card designs (fixed pixel sizes, always on a dark gradient). They
 * never contain message text.
 */
import type { ReactNode } from 'react';
import type { Award, ChatStats } from '../../engine/types';
import { useT, type TKey } from '../../i18n';
import { AWARD_META, awardValue } from '../awards';
import { personColor, onPersonColor } from '../colors';
import { fmtCompact, fmtDuration, fmtNum, fmtPct, fmtDateShort } from '../format';
import { initials, useNamer } from '../names';
import type { ShareFormat } from '../lib/share';

function Brand() {
  const t = useT();
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-white/75">
      <svg width="18" height="18" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="18" fill="#fff" fillOpacity="0.18" />
        <path d="M17 19h30a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H31l-9 7v-7h-5a6 6 0 0 1-6-6V25a6 6 0 0 1 6-6z" fill="#fff" />
      </svg>
      {t('share.madeWith')}
    </div>
  );
}

export function CardShell({ format, bg, children }: { format: ShareFormat; bg: string; children: ReactNode }) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden text-white"
      style={{ background: bg, fontFamily: "'Inter Variable', sans-serif", containerType: 'inline-size' }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div className={`relative flex flex-1 flex-col ${format === 'story' ? 'px-7 pb-7 pt-10' : 'px-8 pb-6 pt-8'}`}>{children}</div>
      <div className={`relative ${format === 'story' ? 'px-7 pb-6' : 'px-8 pb-5'}`}>
        <Brand />
      </div>
    </div>
  );
}

function Av({ person, size = 40 }: { person: number; size?: number }) {
  const { name } = useNamer();
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-bold ring-2 ring-white/50"
      style={{ width: size, height: size, fontSize: size * 0.36, background: personColor(person, false), color: onPersonColor(person), fontFamily: "'Bricolage Grotesque Variable', sans-serif" }}
    >
      {initials(name(person))}
    </span>
  );
}

const DISPLAY = { fontFamily: "'Bricolage Grotesque Variable', sans-serif", letterSpacing: '-0.03em' };

export function OverviewCard({ stats, format }: { stats: ChatStats; format: ShareFormat }) {
  const t = useT();
  const { title, name } = useNamer();
  const top = [...stats.people].sort((a, b) => b.messages - a.messages).slice(0, format === 'story' ? 4 : 3);
  const cells: [string, string][] = [
    [t('stats.messages'), fmtCompact(stats.meta.totalMessages)],
    [t('stats.perDay'), fmtNum(stats.meta.messagesPerDay, 1)],
    [t('stats.chatAge'), t('common.days', { n: fmtNum(stats.time.chatAgeDays) })],
    [t('stats.streak'), t('common.days', { n: stats.time.longestStreak.days })],
  ];
  return (
    <CardShell format={format} bg="linear-gradient(160deg,#1d1250 0%,#4b2fd9 55%,#c24bd8 100%)">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{t('app.tagline')}</p>
      <h1 className="mt-2 break-words text-[2.6rem] font-[800] leading-[0.92]" style={DISPLAY}>
        {title}
      </h1>
      <p className="mt-2 text-sm text-white/75">
        {fmtDateShort(stats.meta.firstTs)} – {fmtDateShort(stats.meta.lastTs)}
      </p>
      <div className={`mt-6 grid grid-cols-2 gap-2.5 ${format === 'square' ? 'mt-5' : ''}`}>
        {cells.map(([k, v]) => (
          <div key={k} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.13)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">{k}</p>
            <p className="mt-1 text-[1.9rem] font-[780] leading-none" style={DISPLAY}>
              {v}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2.5">
        {top.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <Av person={p.id} size={30} />
            <span className="min-w-0 flex-1 truncate font-semibold">{name(p.id)}</span>
            <span className="text-sm text-white/80">{fmtPct(p.share)}</span>
            <span className="h-2 w-24 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full rounded-full" style={{ width: `${p.share * 100}%`, background: personColor(p.id, false) }} />
            </span>
          </div>
        ))}
      </div>
      {format === 'story' && stats.emojis.top.length > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <span className="emoji text-4xl">{stats.emojis.top.slice(0, 3).map((e) => e.display).join('')}</span>
          <span className="text-sm text-white/80">{t('stats.topEmojis')}</span>
        </div>
      )}
      {format === 'story' && stats.awards[0] && (
        <div className="mt-auto pt-5">
          <AwardStrip award={[...stats.awards].sort((a, b) => b.margin - a.margin)[0]!} />
        </div>
      )}
    </CardShell>
  );
}

function AwardStrip({ award }: { award: Award }) {
  const t = useT();
  const { name } = useNamer();
  const m = AWARD_META[award.id];
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3.5" style={{ background: `linear-gradient(135deg, ${m.from}, ${m.to})` }}>
      <span className="emoji text-4xl">{m.emoji}</span>
      <div className="min-w-0">
        <p className="truncate text-lg font-[780] leading-tight" style={DISPLAY}>
          {t(`awards.${award.id}.title` as TKey)}
        </p>
        <p className="truncate text-sm text-white/85">{name(award.winner)}</p>
      </div>
    </div>
  );
}

export function AwardCard({ award, format }: { award: Award; format: ShareFormat }) {
  const t = useT();
  const { name } = useNamer();
  const m = AWARD_META[award.id];
  return (
    <CardShell format={format} bg={`linear-gradient(160deg,#0b0a10 0%,${m.from} 55%,${m.to} 100%)`}>
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{t('awards.title')}</p>
        <div className={`emoji mt-4 leading-none drop-shadow-xl ${format === 'story' ? 'text-[7rem]' : 'text-[5.5rem]'}`}>{m.emoji}</div>
        <h1 className={`mt-5 font-[800] leading-[0.92] ${format === 'story' ? 'text-[3rem]' : 'text-[2.6rem]'}`} style={DISPLAY}>
          {t(`awards.${award.id}.title` as TKey)}
        </h1>
        <div className="mt-5 flex items-center gap-3">
          <Av person={award.winner} size={44} />
          <span className="truncate text-2xl font-[780]" style={DISPLAY}>
            {name(award.winner)}
          </span>
        </div>
        <p className="mt-4 text-lg leading-snug text-white/90">{t(`awards.${award.id}.line` as TKey, { value: awardValue(award) })}</p>
      </div>
    </CardShell>
  );
}

export function ChartShareCard({ title, takeaway, svg, format }: { title: string; takeaway?: string | null; svg: string; format: ShareFormat }) {
  return (
    <CardShell format={format} bg="linear-gradient(160deg,#0f0d17 0%,#1d1830 60%,#2e2458 100%)">
      <h1 className="text-[2rem] font-[800] leading-[0.95]" style={DISPLAY}>
        {title}
      </h1>
      {takeaway && <p className="mt-3 text-[0.95rem] leading-snug text-white/80">{takeaway}</p>}
      <div className="mt-5 flex-1 overflow-hidden rounded-2xl bg-white/[0.04] p-2" dangerouslySetInnerHTML={{ __html: svg }} />
    </CardShell>
  );
}

export function VsCard({ stats, format }: { stats: ChatStats; format: ShareFormat }) {
  const t = useT();
  const { name } = useNamer();
  const [a, b] = [...stats.people].sort((x, y) => x.id - y.id).slice(0, 2) as [ChatStats['people'][number], ChatStats['people'][number]];
  const rows: [string, string, string, number, number][] = [
    [t('stats.messages'), fmtCompact(a.messages), fmtCompact(b.messages), a.messages, b.messages],
    [t('stats.avgWords'), fmtNum(a.avgWords, 1), fmtNum(b.avgWords, 1), a.avgWords, b.avgWords],
    [t('stats.replyTime'), a.responseTime ? fmtDuration(a.responseTime.median) : '–', b.responseTime ? fmtDuration(b.responseTime.median) : '–', b.responseTime?.median ?? 0, a.responseTime?.median ?? 0],
    [t('stats.initiations'), fmtPct(a.initiationShare), fmtPct(b.initiationShare), a.initiationShare, b.initiationShare],
    [t('stats.emojis'), fmtCompact(a.emojis), fmtCompact(b.emojis), a.emojis, b.emojis],
    [t('stats.laughs'), fmtCompact(a.laughs), fmtCompact(b.laughs), a.laughs, b.laughs],
    [t('stats.questions'), fmtCompact(a.questionsAsked), fmtCompact(b.questionsAsked), a.questionsAsked, b.questionsAsked],
  ];
  const shown = format === 'story' ? rows : rows.slice(0, 5);
  return (
    <CardShell format={format} bg="linear-gradient(160deg,#120b2e 0%,#3b1f8f 50%,#e2412f 100%)">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col items-center gap-2">
          <Av person={a.id} size={format === 'story' ? 64 : 52} />
          <span className="max-w-[9rem] truncate text-lg font-[780]" style={DISPLAY}>
            {name(a.id)}
          </span>
        </div>
        <span className="text-4xl font-[800] text-white/80" style={DISPLAY}>
          {t('common.vs')}
        </span>
        <div className="flex min-w-0 flex-col items-center gap-2">
          <Av person={b.id} size={format === 'story' ? 64 : 52} />
          <span className="max-w-[9rem] truncate text-lg font-[780]" style={DISPLAY}>
            {name(b.id)}
          </span>
        </div>
      </div>
      <div className={`flex-1 ${format === 'story' ? 'mt-8 space-y-4' : 'mt-5 space-y-2.5'}`}>
        {shown.map(([label, va, vb, na, nb]) => {
          const total = na + nb || 1;
          return (
            <div key={label}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-[780] text-lg" style={DISPLAY}>
                  {va}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">{label}</span>
                <span className="font-[780] text-lg" style={DISPLAY}>
                  {vb}
                </span>
              </div>
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
                <span className="h-full rounded-l-full" style={{ width: `${(na / total) * 100}%`, background: personColor(a.id, false) }} />
                <span className="h-full flex-1 rounded-r-full" style={{ background: personColor(b.id, false) }} />
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}
