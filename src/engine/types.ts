import type { MessageType, Platform, SystemKind } from '../parser/types';

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

export interface Settings {
  /** Messages closer together than this belong to the same conversation. Default 6h. */
  conversationGapMinutes: number;
  /** A conversation-ending message with no reply from anyone else for this long counts as "ghosted". Default 24h. */
  ghostingThresholdMinutes: number;
  /** Consecutive messages by the same person further apart than this (without a reply) are a double text. Default 1h. */
  doubleTextMinutes: number;
  /** A silence at least this long that someone breaks counts as a "revive". Default 72h. */
  reviveThresholdHours: number;
  /** Members with less than this share (in %) of all messages are grouped as "Others" in charts. */
  othersThresholdPct: number;
  /** Extra words to ignore in word statistics. */
  stopwords: string[];
  /** Shifts every timestamp by this many hours (exports carry no time zone). */
  timezoneOffsetHours: number;
  /** Inclusive start / exclusive end of the analysed period (naive ms) or null for unbounded. */
  dateStart: number | null;
  dateEnd: number | null;
  includeMedia: boolean;
  includeSystem: boolean;
  /** Words or phrases for the "firsts" timeline. */
  firstsWords: string[];
}

/* ------------------------------------------------------------------ */
/* Shared shapes                                                        */
/* ------------------------------------------------------------------ */

export interface Excerpt {
  ts: number;
  author: number; // person index, -1 for system
  text: string;
  type: MessageType;
}

export interface Percentiles {
  count: number;
  mean: number;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
}

export interface Counted<T = string> {
  key: T;
  count: number;
}

export interface CountedByPerson {
  key: string;
  count: number;
  byPerson: number[];
}

export interface TimeSeries {
  /** Bucket start timestamps (naive ms). */
  starts: number[];
  totals: number[];
  /** Per main person (see meta.mainPeople); the last row is "Others" when meta.otherPeople is non-empty. */
  byPerson: number[][];
}

export type MediaKind = 'image' | 'video' | 'audio' | 'sticker' | 'gif' | 'document' | 'contact' | 'location' | 'poll' | 'media';
export const MEDIA_KINDS: MediaKind[] = ['image', 'video', 'audio', 'sticker', 'gif', 'document', 'contact', 'location', 'poll', 'media'];

export type HeartColor =
  | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'black' | 'white' | 'brown' | 'pink' | 'lightblue' | 'grey' | 'fire' | 'mending' | 'broken' | 'sparkle';

export type LaughKind = 'haha' | 'hihi' | 'hehe' | 'lol' | 'lmao' | 'rofl' | 'xd' | 'jaja' | 'kkk' | 'mdr' | 'other' | string;

/* ------------------------------------------------------------------ */
/* Per person                                                           */
/* ------------------------------------------------------------------ */

export interface PersonStats {
  id: number;
  name: string;
  // Volume & style
  messages: number;
  textMessages: number;
  words: number;
  chars: number;
  share: number;
  wordShare: number;
  activeDays: number;
  messagesPerActiveDay: number;
  avgWords: number;
  medianWords: number;
  longestMessage: (Excerpt & { words: number }) | null;
  turns: number;
  messagesPerTurn: number;
  vocabulary: number;
  /** Unique words / total words. */
  uniqueWordRatio: number;
  /** Mean unique words per 1,000-word segment (length-independent richness), null with < 1,000 words. */
  lexicalRichness: number | null;
  avgWordLength: number;
  capsRate: number;
  exclamationRate: number;
  exclamationsPerMessage: number;
  questionRate: number;
  ellipsisRate: number;
  lowercaseRate: number;
  periodRate: number;
  commaRate: number;
  emojiOnlyRate: number;
  elongations: number;
  elongationExamples: string[];
  // Media
  media: Record<MediaKind, number>;
  mediaTotal: number;
  links: number;
  topDomains: Counted[];
  deleted: number;
  edited: number;
  calls: number;
  missedCalls: number;
  // Emojis
  emojis: number;
  emojisPerMessage: number;
  topEmojis: Counted[];
  signatureEmoji: { key: string; score: number; count: number } | null;
  skinTones: number[];
  // Words
  topWords: Counted[];
  signatureWords: { key: string; score: number; count: number }[];
  catchphrases: { key: string; count: number; share: number }[];
  swears: number;
  swearsPer100: number;
  apologies: number;
  loveYous: number;
  hearts: number;
  greetings: number;
  goodbyes: number;
  // Laughter
  laughs: number;
  laughRate: number;
  laughsTriggered: number;
  // Dynamics
  initiations: number;
  initiationShare: number;
  endings: number;
  endingShare: number;
  ghostedOthers: number;
  gotGhosted: number;
  /** Share of chances (others ended a conversation this person was in) where this person never replied in time. */
  ghostRate: number;
  responseTime: Percentiles | null;
  /** Counts per response-time bin (see dynamics.responseBins). */
  responseHistogram: number[];
  /** Median response time (ms) per hour of day of the message being answered; null without data. */
  responseByHour: (number | null)[];
  doubleTexts: number;
  longestMonologue: { messages: number; ts: number; durationMs: number } | null;
  questionsAsked: number;
  questionsAnsweredByOthers: number;
  questionsAnswered: number;
  revives: number;
  // Time
  hourly: number[];
  weekday: number[];
  weekdayHour: number[]; // 7 * 24, Monday first
  nightOwlPct: number;
  earlyBirdPct: number;
  weekendPct: number;
  firstMessage: Excerpt | null;
  // Sentiment
  sentiment: number;
  positiveShare: number;
  negativeShare: number;
  // Duo-ish
  morningFirsts: number;
  goodnightLasts: number;
}

/* ------------------------------------------------------------------ */
/* Sections                                                             */
/* ------------------------------------------------------------------ */

export interface ChatMetaStats {
  title: string | null;
  isGroup: boolean;
  platform: Platform;
  people: string[];
  selfIdx: number;
  /** Indices shown individually in stacked charts (most active first). */
  mainPeople: number[];
  /** Indices grouped as "Others". */
  otherPeople: number[];
  firstTs: number;
  lastTs: number;
  fullFirstTs: number;
  fullLastTs: number;
  spanDays: number;
  totalMessages: number;
  totalWords: number;
  totalChars: number;
  totalMedia: number;
  activeDays: number;
  messagesPerDay: number;
  messagesPerActiveDay: number;
  /** Messages excluded by the current filters. */
  excludedMessages: number;
  /** Android "without media" exports hide what kind of media was sent. */
  unknownMediaShare: number;
  systemMessages: number;
}

export interface TimeStats {
  daily: TimeSeries;
  weekly: TimeSeries;
  monthly: TimeSeries;
  /** First day (naive ms at 00:00) of the daily series. */
  firstDay: number;
  hourly: number[];
  weekday: number[];
  weekdayHour: number[];
  busiestDay: {
    day: number;
    count: number;
    byPerson: number[];
    keywords: string[];
    topEmoji: string | null;
    excerpt: Excerpt[];
  } | null;
  busiestHour: number;
  busiestWeekday: number;
  busiestMonth: { start: number; count: number } | null;
  longestStreak: { days: number; start: number; end: number };
  currentStreak: number;
  longestSilence: { ms: number; start: number; end: number; brokenBy: number; startedBy: number } | null;
  nightOwlPct: number;
  earlyBirdPct: number;
  weekendPct: number;
  /** Messages per weekend day / messages per weekday day. */
  weekendRatio: number;
  chatAgeDays: number;
  firstMessage: Excerpt | null;
  activeDaysPct: number;
}

export interface ResponseBin {
  /** Upper edge in ms (Infinity for the last). */
  max: number;
  label: string;
}

export interface DynamicsStats {
  conversations: number;
  avgConversationMessages: number;
  medianConversationMessages: number;
  avgConversationDurationMs: number;
  medianConversationDurationMs: number;
  conversationLengthBins: { label: string; count: number }[];
  longestConversation: { messages: number; durationMs: number; start: number } | null;
  responseBins: ResponseBin[];
  responseTime: Percentiles | null;
  responseByHour: (number | null)[];
  /** replyMatrix[from][to]: how often `to` replied right after `from` (main people + Others). */
  replyMatrix: number[][];
  /** Median ms for `to` replying to `from`, null with < 5 samples. */
  replyMedianMatrix: (number | null)[][];
  matrixPeople: number[];
  turns: number;
  avgMessagesPerTurn: number;
  /** Duo only: 0–100, share of effort by person 0. */
  effort: EffortBalance | null;
  interest: InterestTrend;
}

export interface EffortBalance {
  score: number;
  components: { key: 'messages' | 'initiations' | 'speed' | 'length'; weight: number; share: number }[];
}

export interface InterestTrend {
  months: number[];
  /** [person][month] initiation share (0–1) or null when there were no conversations. */
  initiationShare: (number | null)[][];
  /** [person][month] median response ms or null. */
  medianResponse: (number | null)[][];
  /** [person][month] message count. */
  messages: number[][];
}

export interface WordStats {
  totalWords: number;
  vocabulary: number;
  topWords: CountedByPerson[];
  topBigrams: CountedByPerson[];
  topTrigrams: CountedByPerson[];
  greetings: Counted[];
  goodbyes: Counted[];
  swears: { total: number; byPerson: number[]; top: Counted[] };
  avgWordsPerMessage: number;
  longestMessage: (Excerpt & { words: number }) | null;
}

export interface EmojiStats {
  total: number;
  distinct: number;
  perMessage: number;
  messagesWithEmoji: number;
  top: (CountedByPerson & { display: string })[];
  monthly: { starts: number[]; series: { key: string; display: string; counts: number[] }[] };
  skinTones: number[];
  hearts: { color: HeartColor; display: string; count: number }[];
}

export interface LaughStats {
  total: number;
  laughMessages: number;
  byPerson: number[];
  ratePer100: number[];
  kinds: Counted[];
  comedian: number;
  triggeredByPerson: number[];
  /** Messages that triggered the most laughs (excerpts; hidden in anonymous mode). */
  bestJokes: (Excerpt & { laughs: number })[];
}

export interface MediaStats {
  byType: Record<MediaKind, number>;
  byPerson: Record<MediaKind, number[]>;
  total: number;
  links: { total: number; byPerson: number[]; topDomains: Counted[] };
  deleted: { total: number; byPerson: number[] };
  edited: { total: number; byPerson: number[] };
  calls: { total: number; missed: number; video: number; byPerson: number[]; missedByPerson: number[]; durationSec: number };
  polls: { question: string; author: number; ts: number; options: { label: string; votes: number }[] }[];
  locations: number;
  viewOnce: number;
  monthly: { starts: number[]; byType: Record<MediaKind, number[]> };
}

export interface SentimentStats {
  average: number;
  byPerson: number[];
  monthly: { starts: number[]; overall: (number | null)[]; byPerson: (number | null)[][] };
  mostPositiveDay: { day: number; score: number; count: number; excerpt: Excerpt[] } | null;
  mostNegativeDay: { day: number; score: number; count: number; excerpt: Excerpt[] } | null;
  goodVibes: number;
  positiveShare: number;
  negativeShare: number;
}

export type EraKind = 'golden' | 'quiet' | 'beginning' | 'spark' | 'rise' | 'cooldown' | 'steady' | 'renaissance' | 'comeback' | 'fade' | 'now';

export interface Era {
  index: number;
  kind: EraKind;
  /** Repetition number for kinds that occur more than once (1-based). */
  ordinal: number;
  start: number;
  end: number;
  days: number;
  messages: number;
  perDay: number;
  /** Relative to the whole chat's average messages per day. */
  intensity: number;
  share: number[];
  topPerson: number;
  topEmoji: string | null;
  topWords: string[];
  medianResponseMs: number | null;
  sentiment: number;
}

export interface MembershipEvent {
  ts: number;
  kind: SystemKind;
  person: string;
  actor: string | null;
}

export interface GroupStats {
  memberEvents: MembershipEvent[];
  /** Timeline of known member count (only from join/leave events). */
  memberCount: { ts: number; count: number }[];
  lurkers: number[];
  silentMembers: string[];
  network: { nodes: { id: number; messages: number }[]; edges: { a: number; b: number; weight: number }[] };
  fastestPairs: { from: number; to: number; medianMs: number; samples: number }[];
  cliques: { a: number; b: number; score: number; replies: number }[];
  glue: number;
  revivesByPerson: number[];
  subjectChanges: { ts: number; actor: string | null; subject: string }[];
}

export interface FirstUse {
  word: string;
  byPerson: (Excerpt | null)[];
}

export interface DuoStats {
  a: number;
  b: number;
  morningFirsts: [number, number];
  goodnightLasts: [number, number];
  apologies: [number, number];
  loveYous: [number, number];
  firsts: FirstUse[];
}

export type AwardId =
  | 'starter' | 'ghost' | 'novelist' | 'speedrunner' | 'nightOwl' | 'earlyBird' | 'doubleTexter' | 'emojiAddict'
  | 'comedian' | 'voiceNote' | 'deleter' | 'editor' | 'questionMachine' | 'hypeMan' | 'capsLock' | 'linkDumper'
  | 'stickerLord' | 'reviver' | 'lastWord' | 'sunshine' | 'photographer' | 'monologue' | 'wordsmith' | 'laughTrack'
  | 'slowpoke' | 'leftOnRead' | 'apologizer' | 'romantic' | 'weekendWarrior' | 'pottyMouth' | 'stretcher' | 'lurker'
  | 'caller';

export type AwardUnit = 'pct' | 'count' | 'ms' | 'perMsg' | 'words' | 'score' | 'messages';

export interface Award {
  id: AwardId;
  winner: number;
  value: number;
  unit: AwardUnit;
  runnerUp: number | null;
  runnerUpValue: number | null;
  /** How decisively the winner won (≥ 1). Used to rank award reveals. */
  margin: number;
}

export interface ChatStats {
  meta: ChatMetaStats;
  people: PersonStats[];
  time: TimeStats;
  dynamics: DynamicsStats;
  words: WordStats;
  emojis: EmojiStats;
  laughter: LaughStats;
  media: MediaStats;
  sentiment: SentimentStats;
  eras: Era[];
  group: GroupStats | null;
  duo: DuoStats | null;
  awards: Award[];
  computeMs: number;
  /** Milliseconds per engine stage (diagnostics). */
  timings: Record<string, number>;
}

export interface WordSearchResult {
  query: string;
  total: number;
  messages: number;
  byPerson: number[];
  monthly: { starts: number[]; counts: number[] };
  first: Excerpt | null;
  last: Excerpt | null;
  examples: Excerpt[];
}
