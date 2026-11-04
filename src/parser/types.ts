/**
 * Core data model produced by the parser and consumed by the engine.
 *
 * Timestamps are "naive wall-clock" times: the date and time exactly as they
 * appear in the export, encoded as if they were UTC. This keeps hour/day
 * calculations independent of the viewer's time zone and DST rules. Always
 * format them with `timeZone: 'UTC'`.
 */

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'sticker'
  | 'gif'
  | 'document'
  | 'contact'
  | 'location'
  | 'poll'
  | 'deleted'
  | 'system'
  | 'call'
  /**
   * Media of an unknown kind. Android exports made "without media" collapse
   * every photo, video, voice note and sticker into a single
   * "<Media omitted>" placeholder, so the real type is unknowable.
   */
  | 'media';

export const MEDIA_TYPES: readonly MessageType[] = [
  'image',
  'video',
  'audio',
  'sticker',
  'gif',
  'document',
  'contact',
  'location',
  'poll',
  'media',
] as const;

export type SystemKind =
  | 'encryption'
  | 'created'
  | 'added'
  | 'removed'
  | 'joined'
  | 'left'
  | 'subject'
  | 'icon'
  | 'description'
  | 'security'
  | 'number'
  | 'disappearing'
  | 'admin'
  | 'pending'
  | 'other';

export interface PollOption {
  label: string;
  votes: number;
}

export interface MessageMeta {
  /** Calls */
  missed?: boolean;
  video?: boolean;
  durationSec?: number;
  /** System messages */
  systemKind?: SystemKind;
  /** Who performed a system action ("Sarah" in "Sarah added Tom"). */
  actor?: string;
  /** Who the action was about ("Tom" in "Sarah added Tom"). */
  targets?: string[];
  /** New group name for `created` / `subject`. */
  subject?: string;
  /** Media */
  fileName?: string;
  viewOnce?: boolean;
  liveLocation?: boolean;
  /** Polls */
  pollQuestion?: string;
  pollOptions?: PollOption[];
}

export interface Message {
  /** Sequential index in the chat (0-based). */
  id: number;
  /** Naive wall-clock time encoded as UTC epoch milliseconds. */
  timestamp: number;
  /** Display name / phone number of the sender. `null` for system messages without a sender. */
  author: string | null;
  /** User-written content. Empty for pure media placeholders; caption for captioned media. */
  text: string;
  type: MessageType;
  edited: boolean;
  links: string[];
  emojis: string[];
  mentions: string[];
  meta?: MessageMeta;
}

export type DateOrder = 'DMY' | 'MDY' | 'YMD';
export type Platform = 'ios' | 'android';

export interface ParseWarning {
  code: 'AMBIGUOUS_DATE_ORDER' | 'UNPARSEABLE_DATES' | 'UNSORTED' | 'MERGED_COLON_AUTHOR';
  detail?: string;
}

export interface ParseResult {
  messages: Message[];
  /** Real people (authors of at least one non-system message), most active first. */
  participants: string[];
  platform: Platform;
  dateOrder: DateOrder;
  timeFormat: '12h' | '24h';
  isGroup: boolean;
  chatTitle: string | null;
  /** If the export labels the exporting user as "You" (or a translation), that label. */
  selfAuthor: string | null;
  warnings: ParseWarning[];
  lineCount: number;
}

export interface ParseOptions {
  /** Force a date order instead of auto-detecting it. */
  dateOrder?: DateOrder | 'auto';
  /** Called with values between 0 and 1. */
  onProgress?: (fraction: number) => void;
}

export type ParseErrorCode =
  | 'EMPTY'
  | 'UNRECOGNIZED_FORMAT'
  | 'NO_MESSAGES'
  | 'ZIP_NO_CHAT'
  | 'ZIP_INVALID'
  | 'BINARY'
  | 'TOO_LARGE';

export class ChatParseError extends Error {
  readonly code: ParseErrorCode;
  constructor(code: ParseErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ChatParseError';
    this.code = code;
  }
}
