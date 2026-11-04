/**
 * Story slides. Every slide is a pure presentational component; `still`
 * renders the final state without animation and without message excerpts,
 * which is exactly what share cards need.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Award, ChatStats } from '../../engine/types';
import type { ChatSummary } from '../../worker/protocol';
import type { TKey, TParams } from '../../i18n';
import { AWARD_META, awardValue } from '../awards';
import { personColor, onPersonColor } from '../colors';
import { initials } from '../names';
import { fmtCompact, fmtDate, fmtDuration, fmtHour, fmtMonthRange, fmtNum, fmtPct, fmtTimes, weekdayName } from '../format';
import { CountUp } from '../components/controls';
import { prefersReducedMotion } from '../theme';

export interface SlideCtx {
  stats: ChatStats | null;
  summary: ChatSummary;
  name: (i: number) => string;
  title: string;
  anonymous: boolean;
  t: (k: TKey, p?: TParams) => string;
  eraName: (kind: string, ordinal: number) => string;
  still: boolean;
}

export interface SlideDef {
  id: string;
  duration: number;
  bg: string;
  dark?: boolean;
  needsStats: boolean;
  render: (c: SlideCtx) => ReactNode;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function Rise({ children, delay = 0, still, className }: { children: ReactNode; delay?: number; still: boolean; className?: string }) {
  if (still || prefersReducedMotion()) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.8, ease: EASE }}>
      {children}
    </motion.div>
  );
}

function Big({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`num text-[clamp(3.6rem,19cqw,7.5rem)] leading-[0.88] ${className}`}>{children}</div>;
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="font-display text-[clamp(1.35rem,6.4cqw,2.1rem)] font-[650] leading-[1.08] opacity-90">{children}</p>;
}

function Line({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[clamp(1rem,4.6cqw,1.35rem)] font-medium leading-snug opacity-85 ${className}`}>{children}</p>;
}

function Avatar({ c, person, size = 44 }: { c: SlideCtx; person: number; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-display font-bold ring-2 ring-white/60"
      style={{ width: size, height: size, fontSize: size * 0.36, background: personColor(person, false), color: onPersonColor(person) }}
      aria-hidden="true"
    >
      {initials(c.name(person))}
    </span>
  );
}

function Bubble({ c, author, text }: { c: SlideCtx; author: number; text: string }) {
  if (c.still || c.anonymous) return null;
  return (
    <div className="max-w-[92%] rounded-[1.3rem] rounded-bl-md bg-white/15 px-4 py-2.5 text-left text-[clamp(0.9rem,4cqw,1.1rem)] leading-snug ring-1 ring-white/20 backdrop-blur" data-private>
      <span className="mb-0.5 block text-xs font-semibold opacity-70">{c.name(author)}</span>
      <span className="line-clamp-4">{text}</span>
    </div>
  );
}

/** Deterministic pseudo-random for decorative layouts. */
function rand(i: number) {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function Frame({ children, align = 'center' }: { children: ReactNode; align?: 'center' | 'top' | 'bottom' }) {
  return (
    <div className={`relative z-10 flex h-full flex-col px-[7%] pb-[12%] pt-[19%] ${align === 'center' ? 'justify-center' : align === 'bottom' ? 'justify-end' : 'justify-start'}`}>
      {children}
    </div>
  );
}

function Decor({ seed, color = 'rgba(255,255,255,0.12)' }: { seed: number; color?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {[0, 1, 2].map((k) => (
        <div
          key={k}
          className="absolute rounded-full blur-2xl animate-float-a"
          style={{
            width: `${45 + rand(seed + k) * 40}%`,
            aspectRatio: '1',
            left: `${rand(seed * 3 + k) * 80 - 20}%`,
            top: `${rand(seed * 7 + k) * 90 - 10}%`,
            background: color,
            animationDelay: `${-k * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slides                                                               */
/* ------------------------------------------------------------------ */

const G = {
  violet: 'linear-gradient(160deg,#1d1250 0%,#4b2fd9 55%,#8f5bff 100%)',
  coral: 'linear-gradient(160deg,#5c1230 0%,#e2412f 50%,#ff9a3d 100%)',
  teal: 'linear-gradient(160deg,#03211f 0%,#0b6b5c 50%,#19c2a0 100%)',
  ink: 'linear-gradient(160deg,#0b0a10 0%,#1d1830 60%,#3a2a6e 100%)',
  pink: 'linear-gradient(160deg,#3d0a2c 0%,#b8236f 50%,#ff7ab6 100%)',
  sun: 'linear-gradient(160deg,#ff8a3d 0%,#ffb547 50%,#ffe08a 100%)',
  blue: 'linear-gradient(160deg,#06173d 0%,#1d4fb8 55%,#4aa3ff 100%)',
  plum: 'linear-gradient(160deg,#1a0b2e 0%,#5b1f8f 55%,#d14bd8 100%)',
};

export function buildSlides(stats: ChatStats | null, _summary: ChatSummary, awards: Award[]): SlideDef[] {
  const slides: SlideDef[] = [];
  const s = stats;
  slides.push({ id: 'intro', duration: 6000, bg: G.violet, needsStats: false, render: (c) => <Intro c={c} /> });
  slides.push({ id: 'total', duration: 6500, bg: G.coral, needsStats: true, render: (c) => <Total c={c} /> });
  if (!s) return slides; // the rest is decided once stats arrive
  if (s.time.firstMessage) slides.push({ id: 'beginning', duration: 6500, bg: G.ink, needsStats: true, render: (c) => <Beginning c={c} /> });
  if (s.people.filter((p) => p.messages > 0).length >= 2) slides.push({ id: 'talk', duration: 6500, bg: G.plum, needsStats: true, render: (c) => <Talk c={c} /> });
  if (s.time.busiestDay && s.time.busiestDay.count >= 10) slides.push({ id: 'busy', duration: 7000, bg: G.blue, needsStats: true, render: (c) => <Busy c={c} /> });
  if (s.meta.totalMessages >= 20) slides.push({ id: 'clock', duration: 6500, bg: G.ink, needsStats: true, render: (c) => <Clock c={c} /> });
  if (s.meta.totalMessages >= 50) slides.push({ id: 'week', duration: 6000, bg: G.teal, needsStats: true, render: (c) => <Week c={c} /> });
  if (s.people.some((p) => p.responseTime && p.responseTime.count >= 5)) slides.push({ id: 'speed', duration: 6500, bg: G.violet, needsStats: true, render: (c) => <Speed c={c} /> });
  if (s.dynamics.conversations >= 5 && s.people.length >= 2) slides.push({ id: 'starter', duration: 6500, bg: G.pink, needsStats: true, render: (c) => <Starter c={c} /> });
  if (s.eras.length >= 2) slides.push({ id: 'eras', duration: 8000, bg: G.ink, needsStats: true, render: (c) => <Eras c={c} /> });
  if (s.emojis.total >= 10) slides.push({ id: 'emoji', duration: 6500, bg: G.sun, dark: true, needsStats: true, render: (c) => <Emoji c={c} /> });
  if (s.people.some((p) => p.signatureWords.length > 0) || s.words.topWords.length > 0) slides.push({ id: 'words', duration: 6500, bg: G.blue, needsStats: true, render: (c) => <Words c={c} /> });
  if (s.laughter.total >= 10) slides.push({ id: 'laughs', duration: 6500, bg: G.coral, needsStats: true, render: (c) => <Laughs c={c} /> });
  const ghosts = s.people.reduce((a, p) => a + p.gotGhosted, 0);
  if (ghosts >= 3) slides.push({ id: 'ghost', duration: 6500, bg: G.ink, needsStats: true, render: (c) => <Ghost c={c} /> });
  if (s.sentiment.goodVibes >= 0) slides.push({ id: 'mood', duration: 6500, bg: G.teal, needsStats: true, render: (c) => <Mood c={c} /> });
  if (s.time.longestStreak.days >= 3) slides.push({ id: 'streak', duration: 6000, bg: G.plum, needsStats: true, render: (c) => <Streak c={c} /> });
  for (const a of awards.slice(0, 3)) {
    slides.push({ id: `award-${a.id}`, duration: 9000, bg: `linear-gradient(160deg,#0b0a10 0%,${AWARD_META[a.id].from} 60%,${AWARD_META[a.id].to} 100%)`, needsStats: true, render: (c) => <AwardReveal c={c} award={a} /> });
  }
  slides.push({ id: 'summary', duration: 0, bg: G.violet, needsStats: true, render: (c) => <Summary c={c} awards={awards} /> });
  return slides.slice(0, 20);
}

function Intro({ c }: { c: SlideCtx }) {
  const { summary, t, title } = c;
  const days = Math.max(1, Math.round((summary.lastTs - summary.firstTs) / 86_400_000) + 1);
  const people = summary.people.slice(0, 6);
  return (
    <>
      <Decor seed={1} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{summary.isGroup ? t('story.introGroup') : t('story.introDuo')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.15}>
          <h2 className="mt-3 break-words font-display text-[clamp(2.8rem,15cqw,6rem)] font-[800] leading-[0.9]">{title}</h2>
        </Rise>
        <Rise still={c.still} delay={0.45} className="mt-8 flex -space-x-2">
          {people.map((_, i) => (
            <Avatar key={i} c={c} person={i} size={52} />
          ))}
        </Rise>
        <Rise still={c.still} delay={0.7} className="mt-8">
          <Line>{t('story.introSub', { messages: fmtNum(summary.personMessages), days: fmtNum(days) })}</Line>
        </Rise>
      </Frame>
    </>
  );
}

function Total({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const novels = s.meta.totalWords / 90_000;
  return (
    <>
      <Decor seed={2} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.totalPre')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.1}>
          <Big className="mt-3">{c.still ? fmtNum(s.meta.totalMessages) : <CountUp value={s.meta.totalMessages} format={(v) => fmtNum(Math.round(v))} />}</Big>
        </Rise>
        <Rise still={c.still} delay={0.2}>
          <Kicker>{c.t('story.totalPost')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={1.2} className="mt-10 space-y-3">
          <Line>{c.t('story.perDay', { n: fmtNum(s.meta.messagesPerDay, 1) })}</Line>
          <Line>
            {novels >= 1
              ? c.t('story.novels', { words: fmtCompact(s.meta.totalWords), novels: fmtNum(novels, novels < 10 ? 1 : 0) })
              : c.t('story.pages', { words: fmtCompact(s.meta.totalWords), pages: fmtNum(Math.max(1, Math.round(s.meta.totalWords / 250))) })}
          </Line>
        </Rise>
      </Frame>
    </>
  );
}

function Beginning({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const f = s.time.firstMessage!;
  return (
    <>
      <Decor seed={3} color="rgba(143,91,255,0.25)" />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.startedPre')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.15}>
          <h2 className="mt-3 font-display text-[clamp(2.6rem,13cqw,5.4rem)] font-[800] leading-[0.92]">{fmtDate(f.ts)}</h2>
        </Rise>
        <Rise still={c.still} delay={0.8} className="mt-8 space-y-3">
          <Line>{c.t('story.startedFirst', { name: c.name(f.author) })}</Line>
          <Bubble c={c} author={f.author} text={f.text || '…'} />
        </Rise>
        <Rise still={c.still} delay={1.6} className="mt-8">
          <Line className="font-display text-[clamp(1.2rem,6cqw,1.9rem)] font-bold opacity-100">
            {c.t('story.startedAgo', { days: fmtNum(s.time.chatAgeDays), us: c.summary.isGroup ? c.t('story.usGroup') : c.t('story.usDuo') })}
          </Line>
        </Rise>
      </Frame>
    </>
  );
}

function Talk({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const ranked = [...s.people].filter((p) => p.messages > 0).sort((a, b) => b.messages - a.messages);
  const top = ranked[0]!;
  if (!c.summary.isGroup && ranked.length === 2) {
    const [a, b] = ranked as [typeof top, typeof top];
    return (
      <>
        <Decor seed={4} />
        <Frame>
          <Rise still={c.still}>
            <Kicker>{c.t('story.talkTitle')}</Kicker>
          </Rise>
          <div className="mt-8 space-y-6">
            {[a, b].map((p, i) => (
              <Rise key={p.id} still={c.still} delay={0.25 + i * 0.25}>
                <div className="mb-2 flex items-center gap-3">
                  <Avatar c={c} person={p.id} size={40} />
                  <span className="truncate font-display text-xl font-bold">{c.name(p.id)}</span>
                  <span className="num ml-auto text-[clamp(1.8rem,9cqw,3rem)]">{fmtPct(p.share)}</span>
                </div>
                <div className="h-5 overflow-hidden rounded-full bg-white/15">
                  <div className={`h-full rounded-full ${c.still ? '' : 'animate-grow-x'}`} style={{ width: `${p.share * 100}%`, background: personColor(p.id, false), animationDelay: `${600 + i * 250}ms` }} />
                </div>
                <p className="mt-1.5 text-sm opacity-75">{c.t('common.messages', { n: p.messages })}</p>
              </Rise>
            ))}
          </div>
          <Rise still={c.still} delay={1.4} className="mt-8">
            <Line>{c.t('story.talkDuo', { name: c.name(top.id), pct: fmtPct(top.share) })}</Line>
          </Rise>
        </Frame>
      </>
    );
  }
  const podium = ranked.slice(0, 3);
  const order = [podium[1], podium[0], podium[2]].filter(Boolean) as typeof podium;
  const heights = { 0: 100, 1: 72, 2: 52 } as Record<number, number>;
  return (
    <>
      <Decor seed={4} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.talkTitle')}</Kicker>
        </Rise>
        <div className="mt-10 flex h-[48%] items-end justify-center gap-3">
          {order.map((p) => {
            const rank = podium.indexOf(p);
            return (
              <Rise key={p.id} still={c.still} delay={0.3 + (2 - rank) * 0.25} className="flex h-full w-[30%] flex-col items-center justify-end">
                <Avatar c={c} person={p.id} size={rank === 0 ? 64 : 48} />
                <p className="mt-2 w-full truncate text-center font-display text-lg font-bold">{c.name(p.id)}</p>
                <p className="mb-2 text-sm opacity-80">{fmtCompact(p.messages)}</p>
                <div className="w-full rounded-t-2xl bg-white/20 ring-1 ring-white/25" style={{ height: `${heights[rank]}%` }}>
                  <p className="num pt-3 text-center text-4xl">{rank + 1}</p>
                </div>
              </Rise>
            );
          })}
        </div>
        <Rise still={c.still} delay={1.3} className="mt-8">
          <Line>{c.t('story.talkGroup', { name: c.name(top.id) })}</Line>
        </Rise>
      </Frame>
    </>
  );
}

function Busy({ c }: { c: SlideCtx }) {
  const b = c.stats!.time.busiestDay!;
  return (
    <>
      <Decor seed={5} />
      <Frame align="center">
        <Rise still={c.still}>
          <Kicker>{c.t('story.busyTitle')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.15}>
          <h2 className="mt-3 font-display text-[clamp(2.4rem,12cqw,5rem)] font-[800] leading-[0.92]">{fmtDate(b.day)}</h2>
        </Rise>
        <Rise still={c.still} delay={0.5} className="mt-4">
          <Line className="font-display text-[clamp(1.2rem,6cqw,2rem)] font-bold opacity-100">{c.t('story.busyCount', { n: fmtNum(b.count) })}</Line>
        </Rise>
        {b.keywords.length > 0 && (
          <Rise still={c.still} delay={0.9} className="mt-6">
            <Line>{c.t('story.busyAbout')}</Line>
            <div className="mt-3 flex flex-wrap gap-2">
              {b.keywords.slice(0, 4).map((k) => (
                <span key={k} className="rounded-full bg-white/20 px-4 py-1.5 font-display text-lg font-bold ring-1 ring-white/25">
                  {k}
                </span>
              ))}
              {b.topEmoji && <span className="emoji rounded-full bg-white/20 px-3 py-1.5 text-lg ring-1 ring-white/25">{b.topEmoji}</span>}
            </div>
          </Rise>
        )}
        <Rise still={c.still} delay={1.5} className="mt-6 space-y-2">
          {b.excerpt.slice(0, 2).map((e, i) => (
            <Bubble key={i} c={c} author={e.author} text={e.text} />
          ))}
        </Rise>
      </Frame>
    </>
  );
}

function Clock({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const max = Math.max(1, ...s.time.hourly);
  const R0 = 26;
  const R1 = 92;
  return (
    <>
      <Decor seed={6} color="rgba(143,91,255,0.22)" />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.clockTitle')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.2} className="mx-auto mt-6 w-[86%]">
          <svg viewBox="-100 -100 200 200" className="w-full" role="img" aria-label={c.t('charts.hourly')}>
            <circle r={R0 - 4} fill="rgba(255,255,255,0.08)" />
            {s.time.hourly.map((v, h) => {
              const a = ((h + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
              const len = R0 + (R1 - R0) * (v / max);
              const w = 0.11;
              const p = (r: number, ang: number) => `${(Math.cos(ang) * r).toFixed(2)},${(Math.sin(ang) * r).toFixed(2)}`;
              const d = `M${p(R0, a - w)} L${p(len, a - w)} L${p(len, a + w)} L${p(R0, a + w)} Z`;
              const night = h < 5;
              return (
                <path
                  key={h}
                  d={d}
                  fill={night ? '#ffd34d' : 'rgba(255,255,255,0.85)'}
                  style={c.still ? undefined : { transformOrigin: '0 0', animation: `grow-y 900ms cubic-bezier(.16,1,.3,1) ${300 + h * 30}ms both` }}
                />
              );
            })}
            {[0, 6, 12, 18].map((h) => {
              const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
              return (
                <text key={h} x={Math.cos(a) * 14} y={Math.sin(a) * 14 + 3} fontSize="7" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontFamily="Inter Variable, sans-serif">
                  {h}
                </text>
              );
            })}
          </svg>
        </Rise>
        <Rise still={c.still} delay={1} className="mt-6 space-y-2">
          <Line className="font-display text-[clamp(1.3rem,6.4cqw,2.1rem)] font-bold opacity-100">{c.t('story.clockPeak', { hour: fmtHour(s.time.busiestHour) })}</Line>
          <Line>{s.time.nightOwlPct >= s.time.earlyBirdPct ? c.t('story.clockNight', { pct: fmtPct(s.time.nightOwlPct) }) : c.t('story.clockMorning', { pct: fmtPct(s.time.earlyBirdPct) })}</Line>
        </Rise>
      </Frame>
    </>
  );
}

function Week({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const max = Math.max(1, ...s.time.weekday);
  return (
    <>
      <Decor seed={7} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.weekTitle')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.15}>
          <h2 className="mt-3 font-display text-[clamp(3rem,15cqw,6rem)] font-[800] capitalize leading-[0.9]">{weekdayName(s.time.busiestWeekday)}</h2>
        </Rise>
        <div className="mt-10 flex h-[30%] items-end gap-2">
          {s.time.weekday.map((v, d) => (
            <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div
                className={`w-full rounded-t-xl ${c.still ? '' : 'animate-grow-y'}`}
                style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: d === s.time.busiestWeekday ? '#ffd34d' : 'rgba(255,255,255,0.35)', animationDelay: `${400 + d * 80}ms` }}
              />
              <span className="text-sm font-semibold opacity-80">{weekdayName(d, 'narrow')}</span>
            </div>
          ))}
        </div>
        <Rise still={c.still} delay={1.3} className="mt-8">
          <Line>{c.t('story.weekSub', { weekday: weekdayName(s.time.busiestWeekday), ratio: fmtTimes(s.time.weekendRatio) })}</Line>
        </Rise>
      </Frame>
    </>
  );
}

function Speed({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const rows = s.people.filter((p) => p.responseTime && p.responseTime.count >= 5).sort((a, b) => a.responseTime!.median - b.responseTime!.median).slice(0, 5);
  const maxLog = Math.log10(Math.max(...rows.map((r) => r.responseTime!.median)) + 10);
  return (
    <>
      <Decor seed={8} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.speedTitle')}</Kicker>
        </Rise>
        <div className="mt-8 space-y-5">
          {rows.map((p, i) => (
            <Rise key={p.id} still={c.still} delay={0.25 + i * 0.2}>
              <div className="flex items-center gap-3">
                <Avatar c={c} person={p.id} size={40} />
                <span className="min-w-0 flex-1 truncate font-display text-lg font-bold">{c.name(p.id)}</span>
                <span className="num text-[clamp(1.6rem,8cqw,2.6rem)]">{fmtDuration(p.responseTime!.median)}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div className={`h-full rounded-full bg-white ${c.still ? '' : 'animate-grow-x'}`} style={{ width: `${Math.max(6, (Math.log10(p.responseTime!.median + 10) / maxLog) * 100)}%`, animationDelay: `${500 + i * 200}ms` }} />
              </div>
            </Rise>
          ))}
        </div>
        <Rise still={c.still} delay={1.4} className="mt-8">
          <Line>{c.t('story.speedSub')}</Line>
        </Rise>
      </Frame>
    </>
  );
}

function Starter({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const top = [...s.people].sort((a, b) => b.initiationShare - a.initiationShare)[0]!;
  const morning = [...s.people].sort((a, b) => b.morningFirsts - a.morningFirsts)[0]!;
  const ring = 2 * Math.PI * 80;
  return (
    <>
      <Decor seed={9} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.starterTitle')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.2} className="relative mx-auto mt-6 w-[64%]">
          <svg viewBox="0 0 200 200" className="w-full -rotate-90" aria-hidden="true">
            <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="22" />
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#fff"
              strokeWidth="22"
              strokeLinecap="round"
              strokeDasharray={`${ring * top.initiationShare} ${ring}`}
              style={c.still ? undefined : { transition: 'stroke-dasharray 1.4s cubic-bezier(.16,1,.3,1)' }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="num text-[clamp(2.6rem,13cqw,4.6rem)]">{fmtPct(top.initiationShare)}</div>
              <div className="mt-1 truncate px-4 font-display text-lg font-bold">{c.name(top.id)}</div>
            </div>
          </div>
        </Rise>
        <Rise still={c.still} delay={1.1} className="mt-8 space-y-2">
          <Line className="font-display text-[clamp(1.2rem,6cqw,1.8rem)] font-bold opacity-100">{c.t('story.starterLine', { name: c.name(top.id), pct: fmtPct(top.initiationShare) })}</Line>
          {morning.morningFirsts > 0 && <Line>{c.t('story.morningLine', { name: c.name(morning.id), n: fmtNum(morning.morningFirsts) })}</Line>}
        </Rise>
      </Frame>
    </>
  );
}

function Eras({ c }: { c: SlideCtx }) {
  const eras = c.stats!.eras;
  const maxI = Math.max(...eras.map((e) => e.intensity));
  return (
    <>
      <Decor seed={10} color="rgba(143,91,255,0.22)" />
      <Frame align="top">
        <Rise still={c.still}>
          <Kicker>{c.t('story.erasTitle')}</Kicker>
          <Line className="mt-2">{c.t('story.erasSub')}</Line>
        </Rise>
        <ol className="mt-6 space-y-3">
          {eras.slice(0, 6).map((e, i) => (
            <Rise key={e.index} still={c.still} delay={0.3 + i * 0.3}>
              <li className="rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15">
                <div className="flex items-center gap-3">
                  <span className="emoji text-3xl">{e.topEmoji ?? '✨'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[clamp(1.05rem,5cqw,1.4rem)] font-bold leading-tight">{c.eraName(e.kind, e.ordinal)}</p>
                    <p className="text-sm opacity-75">{fmtMonthRange(e.start, e.end)}</p>
                  </div>
                  <span className="num text-xl">{fmtNum(e.perDay, e.perDay < 10 ? 1 : 0)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-white" style={{ width: `${(e.intensity / maxI) * 100}%` }} />
                </div>
              </li>
            </Rise>
          ))}
        </ol>
      </Frame>
    </>
  );
}

function EmojiRain({ emoji, still }: { emoji: string; still: boolean }) {
  const drops = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: rand(i + 1) * 100, d: 2.8 + rand(i + 7) * 2.6, delay: rand(i + 13) * 3, size: 1.4 + rand(i + 21) * 2 })), []);
  if (still || prefersReducedMotion()) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {drops.map((p, i) => (
        <span
          key={i}
          className="emoji absolute -top-16"
          style={{ left: `${p.x}%`, fontSize: `${p.size}rem`, animation: `emoji-fall ${p.d}s linear ${p.delay}s infinite`, opacity: 0.85 }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

function Emoji({ c }: { c: SlideCtx }) {
  const e = c.stats!.emojis;
  const top = e.top[0]!;
  return (
    <>
      <EmojiRain emoji={top.display} still={c.still} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.emojiTitle')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.3} className="my-4">
          <div className="emoji text-[clamp(7rem,42cqw,13rem)] leading-none drop-shadow-xl">{top.display}</div>
        </Rise>
        <Rise still={c.still} delay={0.8}>
          <Line className="font-display text-[clamp(1.3rem,6.4cqw,2.1rem)] font-bold opacity-100">{c.t('story.emojiLine', { emoji: top.display, n: fmtNum(top.count) })}</Line>
        </Rise>
        <Rise still={c.still} delay={1.3} className="mt-6 flex gap-2">
          {e.top.slice(1, 6).map((x) => (
            <span key={x.key} className="flex flex-col items-center rounded-2xl bg-black/10 px-3 py-2">
              <span className="emoji text-3xl">{x.display}</span>
              <span className="text-xs font-bold">{fmtCompact(x.count)}</span>
            </span>
          ))}
        </Rise>
      </Frame>
    </>
  );
}

function Words({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const rows = s.people
    .filter((p) => p.messages > 0)
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 3)
    .map((p) => ({ p, word: p.signatureWords[0]?.key ?? p.catchphrases[0]?.key ?? p.topWords[0]?.key }))
    .filter((r) => r.word);
  return (
    <>
      <Decor seed={12} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.wordsTitle')}</Kicker>
        </Rise>
        <div className="mt-8 space-y-7">
          {rows.map(({ p, word }, i) => (
            <Rise key={p.id} still={c.still} delay={0.3 + i * 0.45}>
              <div className="flex items-center gap-2.5">
                <Avatar c={c} person={p.id} size={34} />
                <Line>{c.t('story.wordsLine', { name: c.name(p.id) })}</Line>
              </div>
              <p className="mt-2 break-words font-display text-[clamp(2.4rem,12cqw,4.8rem)] font-[800] leading-[0.95]">“{word}”</p>
            </Rise>
          ))}
        </div>
      </Frame>
    </>
  );
}

function Laughs({ c }: { c: SlideCtx }) {
  const l = c.stats!.laughter;
  return (
    <>
      <Decor seed={13} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.laughTitle')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.15}>
          <Big className="mt-3">{c.still ? fmtNum(l.total) : <CountUp value={l.total} format={(v) => fmtNum(Math.round(v))} />}</Big>
        </Rise>
        <Rise still={c.still} delay={0.3}>
          <Kicker>{c.t('story.laughLine', { n: '' }).trim()}</Kicker>
          <Line className="mt-2">{c.t('story.laughSub')}</Line>
        </Rise>
        <Rise still={c.still} delay={0.9} className="mt-5 flex flex-wrap gap-2">
          {l.kinds.slice(0, 5).map((k) => (
            <span key={k.key} className="rounded-full bg-white/20 px-3.5 py-1.5 font-display text-base font-bold ring-1 ring-white/25">
              <span className={/\p{Extended_Pictographic}/u.test(k.key) ? 'emoji' : ''}>{k.key}</span> · {fmtCompact(k.count)}
            </span>
          ))}
        </Rise>
        {l.comedian >= 0 && (
          <Rise still={c.still} delay={1.6} className="mt-8 flex items-center gap-3 rounded-2xl bg-black/15 p-4">
            <span className="emoji text-4xl">🎤</span>
            <Line className="opacity-100">{c.t('story.comedianLine', { name: c.name(l.comedian), n: fmtNum(l.triggeredByPerson[l.comedian]!) })}</Line>
          </Rise>
        )}
      </Frame>
    </>
  );
}

function Ghost({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const total = s.people.reduce((a, p) => a + p.gotGhosted, 0);
  const ghost = [...s.people].sort((a, b) => b.ghostedOthers - a.ghostedOthers)[0]!;
  return (
    <>
      <Decor seed={14} color="rgba(255,255,255,0.07)" />
      <Frame>
        <Rise still={c.still}>
          <span className={`emoji block text-[clamp(5rem,30cqw,9rem)] leading-none ${c.still ? '' : 'animate-float-a'}`}>👻</span>
        </Rise>
        <Rise still={c.still} delay={0.2} className="mt-4">
          <Kicker>{c.t('story.ghostTitle')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.3}>
          <Big className="mt-2">{fmtNum(total)}</Big>
        </Rise>
        <Rise still={c.still} delay={0.9} className="mt-5 space-y-3">
          <Line>{c.t('story.ghostLine', { n: fmtNum(total), threshold: fmtDuration(24 * 3_600_000) })}</Line>
          {ghost.ghostedOthers > 0 && <Line className="font-display text-[clamp(1.2rem,6cqw,1.8rem)] font-bold opacity-100">{c.t('story.ghostWho', { name: c.name(ghost.id) })}</Line>}
        </Rise>
      </Frame>
    </>
  );
}

function Mood({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const vals = s.sentiment.monthly.overall.map((v) => v ?? 0);
  const min = Math.min(0, ...vals);
  const max = Math.max(0.01, ...vals);
  const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * 300},${100 - ((v - min) / (max - min)) * 90}`).join(' ');
  return (
    <>
      <Decor seed={15} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.moodTitle')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.2} className="mt-6">
          <svg viewBox="0 0 300 110" className="w-full" aria-hidden="true">
            <polyline points={pts} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={c.still ? undefined : { strokeDasharray: 1200, strokeDashoffset: 1200, animation: 'draw 2s cubic-bezier(.16,1,.3,1) .4s forwards' }} />
          </svg>
        </Rise>
        <Rise still={c.still} delay={1} className="mt-6 flex items-center gap-3">
          <Avatar c={c} person={s.sentiment.goodVibes} size={52} />
          <p className="font-display text-[clamp(1.5rem,7.5cqw,2.6rem)] font-[800] leading-[1]">{c.t('story.moodLine', { name: c.name(s.sentiment.goodVibes) })}</p>
        </Rise>
        <Rise still={c.still} delay={1.5} className="mt-6">
          <Line className="text-sm">{c.t('story.moodSub')}</Line>
        </Rise>
      </Frame>
    </>
  );
}

function Streak({ c }: { c: SlideCtx }) {
  const s = c.stats!;
  const st = s.time.longestStreak;
  const sil = s.time.longestSilence;
  return (
    <>
      <Decor seed={16} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.streakTitle')}</Kicker>
        </Rise>
        <Rise still={c.still} delay={0.15}>
          <Big className="mt-3">{fmtNum(st.days)}</Big>
          <Kicker>{c.t('story.streakLine', { n: '' }).replace(/^\s*/, '')}</Kicker>
          <Line className="mt-2">
            {fmtDate(st.start)} – {fmtDate(st.end)}
          </Line>
        </Rise>
        <Rise still={c.still} delay={0.7} className="mt-6 flex flex-wrap gap-1.5">
          {Array.from({ length: Math.min(st.days, 60) }, (_, i) => (
            <span key={i} className="h-3.5 w-3.5 rounded-[4px] bg-white" style={{ opacity: 0.45 + 0.55 * (i / Math.min(st.days, 60)) }} />
          ))}
        </Rise>
        {sil && (
          <Rise still={c.still} delay={1.3} className="mt-8">
            <Line>{c.t('story.silenceLine', { duration: fmtDuration(sil.ms), name: c.name(sil.brokenBy) })}</Line>
          </Rise>
        )}
      </Frame>
    </>
  );
}

function AwardReveal({ c, award }: { c: SlideCtx; award: Award }) {
  const meta = AWARD_META[award.id];
  const [revealed, setRevealed] = useState(c.still || prefersReducedMotion());
  useEffect(() => {
    if (revealed) return;
    const id = setTimeout(() => setRevealed(true), 2200);
    return () => clearTimeout(id);
  }, [revealed]);
  const title = c.t(`awards.${award.id}.title` as TKey);
  const line = c.t(`awards.${award.id}.line` as TKey, { value: awardValue(award) });
  return (
    <>
      <Decor seed={17} />
      <Frame>
        <Rise still={c.still}>
          <Kicker>{c.t('story.awardIntro')}</Kicker>
          <h2 className="mt-2 font-display text-[clamp(2.4rem,12cqw,4.6rem)] font-[800] leading-[0.92]">{title}</h2>
          <Kicker>{c.t('story.awardGoesTo')}</Kicker>
        </Rise>
        <div className="mt-8 [perspective:1200px]">
          {revealed ? (
            <motion.div
              initial={c.still ? false : { rotateY: 90, opacity: 0, scale: 0.9 }}
              animate={{ rotateY: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: EASE }}
              className="relative overflow-hidden rounded-[1.75rem] p-6 text-white shadow-2xl ring-1 ring-white/30"
              style={{ background: `linear-gradient(140deg, ${meta.from}, ${meta.to})` }}
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15" />
              <div className="flex items-center gap-4">
                <span className="emoji text-6xl drop-shadow-lg">{meta.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">{c.t('awards.winner')}</p>
                  <p className="truncate font-display text-[clamp(1.8rem,9cqw,3rem)] font-[800] leading-none">{c.name(award.winner)}</p>
                </div>
              </div>
              <p className="mt-5 text-[clamp(1rem,4.6cqw,1.3rem)] font-medium leading-snug">{line}</p>
            </motion.div>
          ) : (
            <div className="grid h-40 place-items-center rounded-[1.75rem] bg-white/10 ring-1 ring-white/20">
              <span className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="typing-dot h-3 w-3 rounded-full bg-white" style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </span>
            </div>
          )}
        </div>
      </Frame>
    </>
  );
}

function Summary({ c, awards }: { c: SlideCtx; awards: Award[] }) {
  const s = c.stats!;
  const top = s.emojis.top[0];
  const fastest = [...s.people].filter((p) => p.responseTime).sort((a, b) => a.responseTime!.median - b.responseTime!.median)[0];
  const cells: [string, string][] = [
    [c.t('stats.messages'), fmtCompact(s.meta.totalMessages)],
    [c.t('stats.chatAge'), c.t('common.days', { n: fmtNum(s.time.chatAgeDays) })],
    [c.t('stats.perDay'), fmtNum(s.meta.messagesPerDay, 1)],
    [c.t('stats.streak'), c.t('common.days', { n: s.time.longestStreak.days })],
  ];
  return (
    <>
      <Decor seed={18} />
      <Frame align="top">
        <Rise still={c.still}>
          <h2 className="font-display text-[clamp(2.6rem,13cqw,5rem)] font-[800] leading-[0.9]">{c.t('story.summaryTitle')}</h2>
          <p className="mt-2 truncate font-display text-xl font-bold opacity-85">{c.title}</p>
        </Rise>
        <Rise still={c.still} delay={0.3} className="mt-6 grid grid-cols-2 gap-2.5">
          {cells.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/12 p-3.5 ring-1 ring-white/20" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-75">{k}</p>
              <p className="num mt-1.5 text-[clamp(1.6rem,8cqw,2.4rem)]">{v}</p>
            </div>
          ))}
          {top && (
            <div className="rounded-2xl p-3.5 ring-1 ring-white/20" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-75">{c.t('stats.topEmojis')}</p>
              <p className="emoji mt-1 text-4xl">{s.emojis.top.slice(0, 3).map((e) => e.display).join('')}</p>
            </div>
          )}
          {fastest && (
            <div className="rounded-2xl p-3.5 ring-1 ring-white/20" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-75">{c.t('awards.speedrunner.title')}</p>
              <p className="mt-1.5 truncate font-display text-xl font-bold">{c.name(fastest.id)}</p>
              <p className="text-sm opacity-80">{fmtDuration(fastest.responseTime!.median)}</p>
            </div>
          )}
        </Rise>
        {awards.length > 0 && (
          <Rise still={c.still} delay={0.6} className="mt-4 flex flex-wrap gap-2">
            {awards.slice(0, 4).map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-white/25" style={{ background: 'rgba(255,255,255,0.14)' }}>
                <span className="emoji">{AWARD_META[a.id].emoji}</span>
                {c.t(`awards.${a.id}.title` as TKey)}: {c.name(a.winner)}
              </span>
            ))}
          </Rise>
        )}
      </Frame>
    </>
  );
}
