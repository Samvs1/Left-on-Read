/**
 * Realistic fake chat generator. Produces export *text* (iOS or Android
 * format) so the demo exercises the real parser end to end.
 *
 * Model: per-person personalities (activity, speed, language mix, emoji and
 * laugh style, media habits …), month-level "era" multipliers, daily rhythms
 * (weekday/weekend, hour-of-day preference), conversations made of turns,
 * ghosting episodes and one huge "event day".
 */
import {
  ANSWERS, APOLOGIES, EVENT_LINES, GOODNIGHT, GREETING, JOKES, LINKS, LOVE, MORNING, PLANS, QUESTIONS, REACTIONS, SAD, STATEMENTS,
  type Bank, type Lang,
} from './phrases';

export interface DemoOptions {
  kind: 'duo' | 'group';
  months?: number;
  seed?: number;
  /** Override the volume (e.g. 200_000 for stress tests). */
  targetMessages?: number;
}

export interface DemoChat {
  text: string;
  fileName: string;
  title: string;
}

interface Persona {
  name: string;
  weight: number; // activity
  starter: number; // propensity to start conversations
  speedMin: number; // median response minutes
  nl: number; // probability of Dutch
  emoji: number; // probability a message carries emojis
  emojis: string[];
  laugh: string[];
  laughRate: number;
  caps: number;
  exclaim: number;
  question: number;
  night: number; // preference for late hours (0..1)
  early: number; // preference for early hours (0..1)
  media: { image: number; audio: number; sticker: number; gif: number; video: number; doc: number };
  double: number;
  deletes: number;
  edits: number;
  catch: string[];
  ghost: number;
  links: number;
  swears: string[];
  long: number; // tendency to write long messages
  love: number;
  jokes: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DUO: Persona[] = [
  {
    name: 'Sam', weight: 1.1, starter: 0.6, speedMin: 7, nl: 0.3, emoji: 0.28, emojis: ['❤️', '😂', '😅', '🙃', '👀', '🔥'],
    laugh: ['hahaha', 'hahahaha', 'haha', '😂'], laughRate: 0.1, caps: 0.01, exclaim: 0.12, question: 0.22, night: 0.75, early: 0.1,
    media: { image: 0.025, audio: 0.03, sticker: 0.005, gif: 0.01, video: 0.006, doc: 0.002 }, double: 0.12, deletes: 0.004, edits: 0.012,
    catch: ['no way', 'for real though', 'honestly though'], ghost: 0.08, links: 0.02, swears: ['damn', 'shit'], long: 0.35, love: 0.02, jokes: 0.03,
  },
  {
    name: 'Noor', weight: 1.0, starter: 0.4, speedMin: 2, nl: 0.75, emoji: 0.55, emojis: ['🥰', '😂', '✨', '🙈', '😍', '💕', '🌸', '😴'],
    laugh: ['😂😂', 'hihi', 'HAHAHA', 'haha', '😂'], laughRate: 0.14, caps: 0.04, exclaim: 0.25, question: 0.15, night: 0.1, early: 0.7,
    media: { image: 0.05, audio: 0.006, sticker: 0.03, gif: 0.004, video: 0.01, doc: 0.001 }, double: 0.04, deletes: 0.01, edits: 0.004,
    catch: ['echt waar?', 'ik ga stuk', 'oke maar'], ghost: 0.02, links: 0.01, swears: ['kut'], long: 0.1, love: 0.025, jokes: 0.012,
  },
];

const GROUP: Persona[] = [
  { name: 'Sam', weight: 1.2, starter: 0.35, speedMin: 6, nl: 0.4, emoji: 0.25, emojis: ['👀', '😂', '🔥'], laugh: ['hahaha', 'haha'], laughRate: 0.08, caps: 0.01, exclaim: 0.15, question: 0.3, night: 0.4, early: 0.3, media: { image: 0.02, audio: 0.01, sticker: 0.005, gif: 0.01, video: 0.005, doc: 0.004 }, double: 0.05, deletes: 0.004, edits: 0.01, catch: ['who is in', 'let us vote'], ghost: 0.02, links: 0.02, swears: [], long: 0.2, love: 0, jokes: 0.01 },
  { name: 'Noor', weight: 1.1, starter: 0.15, speedMin: 2, nl: 0.7, emoji: 0.6, emojis: ['🥰', '😂', '✨', '🙈', '💅'], laugh: ['😂😂', 'hihi'], laughRate: 0.14, caps: 0.03, exclaim: 0.25, question: 0.12, night: 0.2, early: 0.6, media: { image: 0.04, audio: 0.004, sticker: 0.04, gif: 0.004, video: 0.01, doc: 0 }, double: 0.03, deletes: 0.01, edits: 0.004, catch: ['ik ga stuk'], ghost: 0.01, links: 0.005, swears: [], long: 0.1, love: 0, jokes: 0.005 },
  { name: 'Daan', weight: 1.0, starter: 0.12, speedMin: 3, nl: 0.6, emoji: 0.15, emojis: ['💀', '😭', '🤡'], laugh: ['lol', 'LMAO', '💀'], laughRate: 0.06, caps: 0.02, exclaim: 0.05, question: 0.1, night: 0.6, early: 0.05, media: { image: 0.01, audio: 0.003, sticker: 0.002, gif: 0.04, video: 0.008, doc: 0 }, double: 0.04, deletes: 0.006, edits: 0.006, catch: ['ik zeg niks', 'plot twist'], ghost: 0.02, links: 0.015, swears: ['tering', 'shit'], long: 0.1, love: 0, jokes: 0.12 },
  { name: 'Lotte', weight: 0.8, starter: 0.12, speedMin: 12, nl: 0.8, emoji: 0.2, emojis: ['☺️', '🌱', '❤️'], laugh: ['haha', 'hahaha'], laughRate: 0.07, caps: 0, exclaim: 0.08, question: 0.18, night: 0.2, early: 0.4, media: { image: 0.02, audio: 0.08, sticker: 0, gif: 0, video: 0.004, doc: 0.006 }, double: 0.08, deletes: 0.002, edits: 0.02, catch: ['even een update'], ghost: 0.03, links: 0.01, swears: [], long: 0.75, love: 0, jokes: 0.005 },
  { name: 'Max', weight: 0.9, starter: 0.1, speedMin: 4, nl: 0.5, emoji: 0.15, emojis: ['💪', '🔥', '😤'], laugh: ['HAHAHAHA', 'LOL'], laughRate: 0.06, caps: 0.22, exclaim: 0.3, question: 0.08, night: 0.3, early: 0.5, media: { image: 0.02, audio: 0.005, sticker: 0.01, gif: 0.01, video: 0.02, doc: 0 }, double: 0.04, deletes: 0.004, edits: 0.004, catch: ['LETS GOOO', 'beast mode'], ghost: 0.02, links: 0.005, swears: ['fuck', 'kanker', 'shit', 'fucking'], long: 0.05, love: 0, jokes: 0.02 },
  { name: 'Priya', weight: 0.75, starter: 0.1, speedMin: 8, nl: 0.25, emoji: 0.2, emojis: ['🎧', '📚', '👏'], laugh: ['haha', 'hehe'], laughRate: 0.06, caps: 0, exclaim: 0.1, question: 0.15, night: 0.3, early: 0.2, media: { image: 0.01, audio: 0.004, sticker: 0, gif: 0.004, video: 0.004, doc: 0.01 }, double: 0.05, deletes: 0.002, edits: 0.008, catch: ['have you heard this'], ghost: 0.02, links: 0.15, swears: [], long: 0.3, love: 0, jokes: 0.01 },
  { name: 'Jules', weight: 0.55, starter: 0.06, speedMin: 30, nl: 0.5, emoji: 0.1, emojis: ['🌙', '🦉', '😴'], laugh: ['haha'], laughRate: 0.05, caps: 0, exclaim: 0.02, question: 0.06, night: 0.95, early: 0, media: { image: 0.01, audio: 0, sticker: 0.004, gif: 0.002, video: 0.002, doc: 0 }, double: 0.02, deletes: 0.02, edits: 0.002, catch: ['still awake?'], ghost: 0.2, links: 0.01, swears: [], long: 0.1, love: 0, jokes: 0.01 },
  { name: 'Kees', weight: 0.05, starter: 0.01, speedMin: 60, nl: 0.9, emoji: 0.05, emojis: ['👍'], laugh: ['haha'], laughRate: 0.05, caps: 0, exclaim: 0, question: 0.05, night: 0.1, early: 0.2, media: { image: 0, audio: 0, sticker: 0, gif: 0, video: 0, doc: 0 }, double: 0, deletes: 0, edits: 0, catch: [], ghost: 0.1, links: 0, swears: [], long: 0, love: 0, jokes: 0 },
];

interface Out {
  t: number;
  author: string | null;
  text: string;
  kind: 'text' | 'image' | 'audio' | 'sticker' | 'gif' | 'video' | 'doc' | 'deleted' | 'missed' | 'call' | 'system' | 'poll' | 'location';
  edited?: boolean;
}

const MIN = 60_000;
const DAY = 86_400_000;
const LINK_INTROS: Bank = {
  en: ['look at this', 'this is so good', 'have you seen this?', 'listen to this', 'thought of you'],
  nl: ['kijk dit', 'deze is zo goed', 'al gezien?', 'luister deze', 'moest aan je denken'],
};

export function generateDemoChat(opts: DemoOptions): DemoChat {
  let out = build(opts, 1);
  if (opts.targetMessages) {
    // Calibrate the volume to the requested size.
    const persons = out.filter((o) => o.author !== null).length;
    out = build(opts, opts.targetMessages / Math.max(1, persons));
  }
  const platform = opts.kind === 'duo' ? 'ios' : 'android';
  const text = platform === 'ios' ? renderIos(out) : renderAndroid(out);
  const fileName = opts.kind === 'duo' ? 'WhatsApp Chat with Noor.txt' : 'WhatsApp Chat - Weekend Crew.txt';
  return { text, fileName, title: opts.kind === 'duo' ? 'Noor' : 'Weekend Crew 🍕' };
}

function build(opts: DemoOptions, scale: number): Out[] {
  const rnd = mulberry32(opts.seed ?? (opts.kind === 'duo' ? 20240214 : 19990101));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const chance = (p: number) => rnd() < p;
  const people = opts.kind === 'duo' ? DUO : GROUP;
  const months = Math.max(6, Math.min(24, opts.months ?? (opts.kind === 'duo' ? 16 : 14)));

  // Era curve: slow start → golden age → quiet era → comeback
  const eraCurve: number[] = [];
  for (let m = 0; m < months; m++) {
    const x = m / (months - 1);
    let v: number;
    if (x < 0.15) v = 0.35 + x * 3;
    else if (x < 0.5) v = 1.35 + 0.25 * Math.sin(x * 9);
    else if (x < 0.72) v = 0.4;
    else v = 0.95 + 0.1 * Math.sin(x * 7);
    eraCurve.push(v * (0.9 + rnd() * 0.2));
  }

  const start = Date.UTC(2024, 0, 8, 0, 0) - months * 30 * DAY;
  const startDay = Math.floor(start / DAY);
  const endDay = startDay + Math.round(months * 30.4);
  const baseConvPerDay = opts.kind === 'duo' ? 2.6 : 3.2;

  const out: Out[] = [];
  const say = (_p: Persona, lang: Lang, bank: Bank) => pick(bank[lang]);

  // Opening system lines
  const t0 = startDay * DAY + 9 * 3600_000;
  if (opts.kind === 'group') {
    out.push({ t: t0, author: null, text: 'Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.', kind: 'system' });
    out.push({ t: t0, author: null, text: 'Sam created group "Weekend Crew"', kind: 'system' });
    out.push({ t: t0 + MIN, author: null, text: 'Sam added Noor, Daan, Lotte, Max and Priya', kind: 'system' });
    out.push({ t: t0 + 12 * DAY, author: null, text: "Jules joined using this group's invite link", kind: 'system' });
    out.push({ t: t0 + 40 * DAY, author: null, text: 'Sam added Kees', kind: 'system' });
    out.push({ t: t0 + 61 * DAY, author: null, text: 'Max changed the subject from "Weekend Crew" to "Weekend Crew 🍕"', kind: 'system' });
    out.push({ t: t0 + 62 * DAY, author: null, text: "Lotte changed this group's icon", kind: 'system' });
    out.push({ t: t0 + 90 * DAY, author: null, text: 'Daan added Bram', kind: 'system' });
    out.push({ t: t0 + 133 * DAY, author: null, text: 'Bram left', kind: 'system' });
  } else {
    out.push({ t: t0, author: null, text: 'Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.', kind: 'system' });
  }

  const eventDay = startDay + Math.floor((endDay - startDay) * 0.33);
  const activePeople = (day: number) =>
    people.filter((p) => !(opts.kind === 'group' && ((p.name === 'Jules' && day < startDay + 12) || (p.name === 'Kees' && day < startDay + 40))));

  let lastEnd = 0;
  let skipUntil = 0;
  let pendingApology: Persona | null = null;

  const hourWeights = (p: Persona) => {
    const w: number[] = [];
    for (let h = 0; h < 24; h++) {
      let v = 0.05;
      if (h >= 7 && h <= 9) v = 0.6 + p.early;
      else if (h >= 12 && h <= 13) v = 0.8;
      else if (h >= 17 && h <= 22) v = 1.3;
      else if (h >= 23 || h <= 1) v = 0.25 + p.night * 1.2;
      else if (h >= 2 && h <= 4) v = 0.02 + p.night * 0.35;
      else if (h >= 5 && h <= 6) v = 0.05 + p.early * 0.6;
      else v = 0.45;
      w.push(v);
    }
    return w;
  };
  const sampleHour = (p: Persona) => {
    const w = hourWeights(p);
    const total = w.reduce((a, b) => a + b, 0);
    let r = rnd() * total;
    for (let h = 0; h < 24; h++) {
      r -= w[h]!;
      if (r <= 0) return h;
    }
    return 20;
  };
  const weightedPick = (list: Persona[], weight: (p: Persona) => number, exclude?: Persona) => {
    const cands = list.filter((p) => p !== exclude);
    const total = cands.reduce((a, p) => a + weight(p), 0);
    let r = rnd() * total;
    for (const p of cands) {
      r -= weight(p);
      if (r <= 0) return p;
    }
    return cands[cands.length - 1]!;
  };
  const lognormal = (median: number, sigma = 1) => {
    const u1 = Math.max(1e-9, rnd());
    const u2 = rnd();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return median * Math.exp(sigma * z);
  };

  const decorate = (p: Persona, text: string): string => {
    let s = text;
    if (chance(p.emoji)) s += ` ${pick(p.emojis)}${chance(0.3) ? pick(p.emojis) : ''}`;
    if (chance(p.exclaim) && !/[?!]$/.test(s)) s += chance(0.3) ? '!!' : '!';
    if (chance(p.caps)) s = s.toUpperCase();
    if (p.swears.length && chance(0.02)) s = `${pick(p.swears)}, ${s}`;
    if (chance(0.015)) s = s.replace(/\b(hey|so|no|yes|ja|nee)\b/i, (w) => w + w.slice(-1).repeat(3));
    return s;
  };

  const contentFor = (p: Persona, ctx: { first: boolean; hour: number; event: boolean; last: boolean; prevQuestion: boolean; prevJoke: boolean }): Out['kind'] | string => {
    const lang: Lang = chance(p.nl) ? 'nl' : 'en';
    if (ctx.event) return decorate(p, say(p, lang, EVENT_LINES));
    if (ctx.prevJoke && chance(0.75)) return pick(p.laugh) + (chance(0.3) ? ` ${say(p, lang, REACTIONS)}` : '');
    if (ctx.first) {
      if (pendingApology === p) {
        pendingApology = null;
        return say(p, lang, APOLOGIES);
      }
      if (ctx.hour >= 5 && ctx.hour < 11 && chance(0.5)) return decorate(p, say(p, lang, MORNING));
      if (chance(0.35)) return say(p, lang, GREETING);
      if (chance(0.3)) return decorate(p, say(p, lang, PLANS));
    }
    if (ctx.last && (ctx.hour >= 22 || ctx.hour < 2) && chance(0.6)) return decorate(p, say(p, lang, GOODNIGHT));
    // Media
    const r = rnd();
    let acc = 0;
    for (const [k, v] of Object.entries(p.media) as [keyof Persona['media'], number][]) {
      acc += v;
      if (r < acc) return k === 'doc' ? 'doc' : k;
    }
    if (chance(0.003)) return 'location';
    if (chance(p.links)) return `${chance(0.5) ? `${say(p, lang, LINK_INTROS)} ` : ''}${pick(LINKS)}`;
    if (chance(p.jokes)) return say(p, lang, JOKES);
    if (ctx.prevQuestion) return decorate(p, say(p, lang, ANSWERS));
    if (chance(p.laughRate)) return pick(p.laugh);
    if (chance(p.love)) return say(p, lang, LOVE);
    if (p.catch.length && chance(0.04)) return decorate(p, pick(p.catch));
    if (chance(p.question)) return decorate(p, say(p, lang, QUESTIONS));
    if (chance(0.03)) return say(p, lang, SAD);
    if (chance(0.25)) return decorate(p, say(p, lang, REACTIONS));
    let s = say(p, lang, STATEMENTS);
    if (chance(p.long)) s += `${chance(0.5) ? ', ' : '. '}${say(p, lang, STATEMENTS)}${chance(0.4) ? `. ${say(p, lang, STATEMENTS)}` : ''}`;
    return decorate(p, s);
  };

  for (let day = startDay; day < endDay; day++) {
    if (day < skipUntil) continue;
    const month = Math.min(months - 1, Math.floor((day - startDay) / 30.4));
    const wd = (((day + 3) % 7) + 7) % 7;
    const weekendBoost = wd >= 5 ? 1.25 : 1;
    const lambda = baseConvPerDay * eraCurve[month]! * weekendBoost * scale;
    let convs = 0;
    // Poisson sample
    const L = Math.exp(-Math.min(lambda, 60));
    let pr = 1;
    do {
      convs++;
      pr *= rnd();
    } while (pr > L && convs < 200);
    convs--;
    if (day === eventDay) convs = Math.max(convs, 2);
    const present = activePeople(day);
    const starts: number[] = [];
    for (let c = 0; c < convs; c++) {
      const starter = weightedPick(present, (p) => p.starter * p.weight);
      starts.push(day * DAY + sampleHour(starter) * 3600_000 + Math.floor(rnd() * 3600_000));
    }
    starts.sort((a, b) => a - b);

    for (let c = 0; c < starts.length; c++) {
      let t = scale > 2 ? starts[c]! : Math.max(starts[c]!, lastEnd + 6.5 * 3600_000 * (rnd() < 0.5 ? 0.1 : 0.03));
      const isEvent = day === eventDay && c === 0;
      let speaker = weightedPick(present, (p) => p.starter * p.weight);
      if (pendingApology && present.includes(pendingApology)) speaker = pendingApology;
      const turns = isEvent ? 140 : Math.max(1, Math.round(lognormal(opts.kind === 'duo' ? 5 : 6, 0.7)));
      let prevQuestion = false;
      let prevJoke = false;
      let lastSpeaker: Persona | null = null;
      for (let turn = 0; turn < turns; turn++) {
        const msgs = 1 + (chance(0.35) ? 1 : 0) + (chance(0.12) ? 1 : 0) + (isEvent && chance(0.3) ? 2 : 0);
        for (let k = 0; k < msgs; k++) {
          const hour = Math.floor((t % DAY) / 3600_000);
          const content = contentFor(speaker, {
            first: turn === 0 && k === 0,
            hour,
            event: isEvent && rnd() < 0.7,
            last: turn === turns - 1 && k === msgs - 1,
            prevQuestion,
            prevJoke,
          });
          prevJoke = false;
          const kinds = ['image', 'audio', 'sticker', 'gif', 'video', 'doc', 'location'];
          if (kinds.includes(content)) {
            out.push({ t, author: speaker.name, text: '', kind: content as Out['kind'] });
          } else if (chance(speaker.deletes)) {
            out.push({ t, author: speaker.name, text: '', kind: 'deleted' });
          } else {
            const text = content as string;
            out.push({ t, author: speaker.name, text, kind: 'text', edited: chance(speaker.edits) });
            prevJoke = JOKES.en.includes(text) || JOKES.nl.includes(text);
          }
          prevQuestion = /\?$/.test(out[out.length - 1]!.text);
          t += Math.round(4000 + rnd() * 40_000);
        }
        // Double text: the same speaker comes back after a while
        if (chance(speaker.double) && !isEvent) {
          t += Math.round((65 + rnd() * 120) * MIN);
          const lang: Lang = chance(speaker.nl) ? 'nl' : 'en';
          out.push({ t, author: speaker.name, text: decorate(speaker, chance(0.5) ? say(speaker, lang, QUESTIONS) : say(speaker, lang, REACTIONS)), kind: 'text' });
          t += 30_000;
        }
        lastSpeaker = speaker;
        const next = opts.kind === 'duo' ? present.find((p) => p !== speaker)! : weightedPick(present, (p) => p.weight * (prevJoke ? 1.5 : 1), speaker);
        const delay = isEvent ? lognormal(0.4, 0.6) : lognormal(next.speedMin, 1.1);
        t += Math.round(Math.min(delay, 300) * MIN);
        speaker = next;
      }
      lastEnd = t;
      // Ghosting episode: the conversation ended with a question nobody answered for days
      const last = out[out.length - 1]!;
      if (last.text.endsWith('?') && lastSpeaker) {
        const other = opts.kind === 'duo' ? present.find((p) => p !== lastSpeaker)! : weightedPick(present, (p) => p.ghost, lastSpeaker);
        if (chance((other.ghost * 3) / Math.max(1, scale))) {
          skipUntil = day + 2 + Math.floor(rnd() * 2);
          pendingApology = other;
          break;
        }
      }
      // Occasional calls in duos
      if (opts.kind === 'duo' && chance(0.02)) {
        const caller = pick(present);
        out.push({ t: t + 5 * MIN, author: caller.name, text: '', kind: chance(0.5) ? 'missed' : 'call' });
      }
    }
    // Polls in groups
    if (opts.kind === 'group' && chance(0.012)) {
      const author = weightedPick(present, (p) => p.starter);
      out.push({ t: day * DAY + 11 * 3600_000, author: author.name, text: 'POLL:\nWhere do we go saturday?\nOPTION: Beach (4 votes)\nOPTION: City (2 votes)\nOPTION: Stay home (1 vote)', kind: 'poll' });
    }
  }

  out.sort((a, b) => a.t - b.t);
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
const LRM = '‎';

function stamp(t: number, seconds: boolean): { date: string; time: string } {
  const d = new Date(t);
  return {
    date: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${seconds ? `:${pad(d.getUTCSeconds())}` : ''}`,
  };
}

function renderIos(out: Out[]): string {
  const lines: string[] = [];
  let n = 0;
  for (const o of out) {
    const { date, time } = stamp(o.t, true);
    const head = `[${date}, ${time}]`;
    const author = o.author ?? 'Noor';
    let body: string;
    switch (o.kind) {
      case 'system': body = `${LRM}${o.text}`; break;
      case 'image': body = `${LRM}image omitted`; break;
      case 'audio': body = `${LRM}audio omitted`; break;
      case 'sticker': body = `${LRM}sticker omitted`; break;
      case 'gif': body = `${LRM}GIF omitted`; break;
      case 'video': body = `${LRM}video omitted`; break;
      case 'doc': body = `${LRM}Plan.pdf • ${LRM}2 pages ${LRM}document omitted`; break;
      case 'deleted': body = `${LRM}This message was deleted.`; break;
      case 'missed': body = `${LRM}Missed voice call`; break;
      case 'call': body = `${LRM}Voice call, ${LRM}${10 + (n % 50)} min`; break;
      case 'location': body = `${LRM}Location: https://maps.google.com/?q=52.37${n % 10},4.89${n % 7}`; break;
      default: body = o.text + (o.edited ? ` ${LRM}<This message was edited>` : '');
    }
    n++;
    const prefix = o.kind !== 'text' ? LRM : '';
    lines.push(`${prefix}${head} ${author}: ${body}`);
  }
  return lines.join('\n');
}

function renderAndroid(out: Out[]): string {
  const lines: string[] = [];
  let n = 1;
  for (const o of out) {
    const { date, time } = stamp(o.t, false);
    const d = new Date(o.t);
    const ymd = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
    const wa = `WA${String(n++ % 10000).padStart(4, '0')}`;
    if (o.kind === 'system') {
      lines.push(`${date}, ${time} - ${o.text}`);
      continue;
    }
    let body: string;
    switch (o.kind) {
      case 'image': body = `IMG-${ymd}-${wa}.jpg (file attached)`; break;
      case 'audio': body = `PTT-${ymd}-${wa}.opus (file attached)`; break;
      case 'sticker': body = `STK-${ymd}-${wa}.webp (file attached)`; break;
      case 'gif': body = `VID-${ymd}-${wa}.mp4 (file attached)`; break;
      case 'video': body = `VID-${ymd}-${wa}.mp4 (file attached)`; break;
      case 'doc': body = `Planning-${ymd}.pdf (file attached)`; break;
      case 'deleted': body = 'This message was deleted'; break;
      case 'location': body = `location: https://maps.google.com/?q=52.0${n % 10},4.3${n % 7}`; break;
      case 'missed':
      case 'call':
        continue; // Android exports do not include calls
      default: body = o.text + (o.edited ? ' <This message was edited>' : '');
    }
    lines.push(`${date}, ${time} - ${o.author}: ${body}`);
  }
  return lines.join('\n');
}
