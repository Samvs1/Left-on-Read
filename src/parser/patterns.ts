/**
 * Multilingual placeholder and system-message patterns.
 *
 * Languages: English, Dutch, German, French, Spanish, Portuguese, Italian, Turkish.
 *
 * Hot path design: most lookups are a single Map.get on a normalized string.
 * Regexes only run after cheap substring guards.
 */
import type { MessageMeta, MessageType, PollOption, SystemKind } from './types';
import { fastKey, normalizeForLookup } from './clean';

export interface ContentClass {
  type: MessageType;
  /** Remaining user-written text (caption, poll question …). */
  text: string;
  meta?: MessageMeta;
}

/* ------------------------------------------------------------------ */
/* Deleted messages                                                     */
/* ------------------------------------------------------------------ */

const DELETED = [
  // en
  'this message was deleted',
  'you deleted this message',
  'this message was deleted by an admin',
  // nl
  'dit bericht is verwijderd',
  'je hebt dit bericht verwijderd',
  'u hebt dit bericht verwijderd',
  'jij hebt dit bericht verwijderd',
  'dit bericht is verwijderd door een beheerder',
  // de
  'diese nachricht wurde gelöscht',
  'du hast diese nachricht gelöscht',
  'sie haben diese nachricht gelöscht',
  // fr
  'ce message a été supprimé',
  'vous avez supprimé ce message',
  'tu as supprimé ce message',
  'message supprimé',
  // es
  'se eliminó este mensaje',
  'eliminaste este mensaje',
  'este mensaje fue eliminado',
  'mensaje eliminado',
  // pt
  'mensagem apagada',
  'esta mensagem foi apagada',
  'você apagou esta mensagem',
  'apagaste esta mensagem',
  'esta mensagem foi eliminada',
  'eliminou esta mensagem',
  // it
  'questo messaggio è stato eliminato',
  'hai eliminato questo messaggio',
  'messaggio eliminato',
  // tr
  'bu mesaj silindi',
  'bu mesajı sildiniz',
  'bu mesajı sildin',
];
const DELETED_FIRST_CHARS = new Set([116, 100, 99, 101, 113]); // t d c e q
const DELETED_PREFIXES = [
  'this message was deleted by',
  'dit bericht is verwijderd door',
  'diese nachricht wurde von',
  'ce message a été supprimé par',
  'este mensaje fue eliminado por',
  'esta mensagem foi apagada por',
  'questo messaggio è stato eliminato da',
];

/* ------------------------------------------------------------------ */
/* Media placeholders                                                   */
/* ------------------------------------------------------------------ */

/** Generic Android "<Media omitted>" in many languages. */
const GENERIC_MEDIA = [
  '<media omitted>',
  '<media weggelaten>',
  '<medien ausgeschlossen>',
  '<medien weggelassen>',
  '<médias omis>',
  '<medias omis>',
  '<média omis>',
  '<multimedia omitido>',
  '<multimedia omitidos>',
  '<archivo omitido>',
  '<mídia oculta>',
  '<midia oculta>',
  '<multimédia omitido>',
  '<ficheiro multimédia omitido>',
  '<media omessi>',
  '<media omesso>',
  '<file multimediale omesso>',
  '<medya dahil edilmedi>',
  '<medya atlandı>',
  '<medya yok>',
];
const GENERIC_MEDIA_RE = /^<(?:media|medien|médias|medias|média|multimedia|multimédia|mídia|midia|medya|medios|archivo|ficheiro)\b[^<>]*>$/iu;

/** iOS-style "<noun> <omitted>" nouns, by type. */
const MEDIA_NOUNS: Record<string, MessageType> = {
  image: 'image', photo: 'image', picture: 'image', afbeelding: 'image', foto: 'image', bild: 'image', imagen: 'image',
  imagem: 'image', immagine: 'image', görüntü: 'image', fotoğraf: 'image', resim: 'image',
  video: 'video', vídeo: 'video', vidéo: 'video', 'video note': 'video', videonotitie: 'video', videonachricht: 'video', 'videobericht': 'video',
  audio: 'audio', áudio: 'audio', ses: 'audio', 'voice message': 'audio', spraakbericht: 'audio', sprachnachricht: 'audio',
  'message vocal': 'audio', 'nota de voz': 'audio', 'mensaje de voz': 'audio', 'mensagem de voz': 'audio', 'messaggio vocale': 'audio', 'sesli mesaj': 'audio',
  sticker: 'sticker', autocollant: 'sticker', figurinha: 'sticker', çıkartma: 'sticker', 'sticker animato': 'sticker', stiker: 'sticker',
  gif: 'gif',
  document: 'document', documento: 'document', dokument: 'document', belge: 'document', fichier: 'document', bestand: 'document', datei: 'document',
  'contact card': 'contact', contactkaart: 'contact', contact: 'contact', kontaktkarte: 'contact', kontakt: 'contact', 'fiche contact': 'contact',
  'carte de contact': 'contact', 'tarjeta de contacto': 'contact', contacto: 'contact', 'cartão do contato': 'contact', 'cartão de contato': 'contact',
  'cartão de contacto': 'contact', contato: 'contact', 'scheda contatto': 'contact', contatto: 'contact', 'kişi kartı': 'contact', kişi: 'contact',
};
const OMISSIONS = [
  'omitted', 'weggelaten', 'weggelassen', 'ausgelassen', 'ausgeschlossen', 'entfernt', 'absente', 'absent', 'omis', 'omise', 'manquant', 'manquante',
  'retiré', 'retirée', 'omitido', 'omitida', 'ocultado', 'ocultada', 'oculto', 'oculta', 'omesso', 'omessa', 'omessi', 'escluso', 'esclusa',
  'dahil edilmedi', 'atlandı', 'eksik',
];

/* ------------------------------------------------------------------ */
/* Calls                                                                */
/* ------------------------------------------------------------------ */

const CALL_HINT_RE = /call|oproep|anruf|appel|llamada|chamada|chiamata|arama/iu;
interface CallRule { re: RegExp; missed: boolean; video: boolean }
const CALL_RULES: CallRule[] = [
  // en
  { re: /^(?:missed|silenced) (?:group )?voice call/u, missed: true, video: false },
  { re: /^(?:missed|silenced) (?:group )?video call/u, missed: true, video: true },
  { re: /^(?:group )?voice call/u, missed: false, video: false },
  { re: /^(?:group )?video call/u, missed: false, video: true },
  // nl
  { re: /^gemiste (?:groeps)?spraakoproep/u, missed: true, video: false },
  { re: /^gemiste (?:groeps)?video-?oproep/u, missed: true, video: true },
  { re: /^(?:groeps)?spraakoproep/u, missed: false, video: false },
  { re: /^(?:groeps)?video-?oproep/u, missed: false, video: true },
  // de
  { re: /^verpasste[rn]? (?:gruppen)?sprachanruf/u, missed: true, video: false },
  { re: /^verpasste[rn]? (?:gruppen)?videoanruf/u, missed: true, video: true },
  { re: /^(?:gruppen)?sprachanruf/u, missed: false, video: false },
  { re: /^(?:gruppen)?videoanruf/u, missed: false, video: true },
  // fr
  { re: /^appel vocal(?: de groupe)? manqué/u, missed: true, video: false },
  { re: /^appel vidéo(?: de groupe)? manqué/u, missed: true, video: true },
  { re: /^appel vocal/u, missed: false, video: false },
  { re: /^appel vidéo/u, missed: false, video: true },
  // es
  { re: /^videollamada perdida/u, missed: true, video: true },
  { re: /^llamada (?:de voz )?perdida/u, missed: true, video: false },
  { re: /^llamada de voz/u, missed: false, video: false },
  { re: /^videollamada/u, missed: false, video: true },
  // pt
  { re: /^chamada de voz perdida/u, missed: true, video: false },
  { re: /^chamada de vídeo perdida/u, missed: true, video: true },
  { re: /^chamada de voz/u, missed: false, video: false },
  { re: /^chamada de vídeo/u, missed: false, video: true },
  // it
  { re: /^chiamata vocale persa/u, missed: true, video: false },
  { re: /^videochiamata persa/u, missed: true, video: true },
  { re: /^chiamata vocale/u, missed: false, video: false },
  { re: /^videochiamata/u, missed: false, video: true },
  // tr
  { re: /^cevapsız sesli arama/u, missed: true, video: false },
  { re: /^cevapsız görüntülü arama/u, missed: true, video: true },
  { re: /^sesli arama/u, missed: false, video: false },
  { re: /^görüntülü arama/u, missed: false, video: true },
];
const CALL_DURATION_RE = /(\d+)\s*(h|hr|hrs|hour|hours|uur|std|heure|heures|hora|horas|ora|ore|saat|min|mins|minute|minutes|minuten|minuto|minutos|minuti|dk|dakika|s|sec|secs|second|seconds|seconden|sekunden|segundos|secondi|sn|saniye)\b/giu;

/** Words that may follow a call placeholder ("Missed voice call, Tap to call back"). */
const CALL_TAIL_WORDS = new Set(
  (
    'tap to call back click answered on other device no answer declined ' +
    'tik om terug te bellen beantwoord op ander apparaat geen antwoord ' +
    'tippen zum zurückrufen auf anderem gerät angenommen ' +
    'appuyez pour rappeler touchez ' +
    'toca para devolver la llamada toque retornar ligar de volta ' +
    'tocca per richiamare ' +
    'geri aramak için dokunun'
  ).split(' '),
);
function isCallRemainder(rest: string): boolean {
  const words = rest
    .replace(CALL_DURATION_RE, ' ')
    .replace(/[\s,.•·()\-:]+/gu, ' ')
    .trim();
  CALL_DURATION_RE.lastIndex = 0;
  if (!words) return true;
  return words.split(' ').every((w) => CALL_TAIL_WORDS.has(w) || /^\d+$/.test(w));
}

function parseDuration(s: string): number | undefined {
  let total = 0;
  let found = false;
  CALL_DURATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CALL_DURATION_RE.exec(s)) !== null) {
    const v = Number(m[1]);
    const u = m[2]!.toLowerCase();
    found = true;
    if (/^(h|hr|hrs|hour|hours|uur|std|heure|heures|hora|horas|ora|ore|saat)$/.test(u)) total += v * 3600;
    else if (/^(s|sec|secs|second|seconds|seconden|sekunden|segundos|secondi|sn|saniye)$/.test(u)) total += v;
    else total += v * 60;
  }
  return found ? total : undefined;
}

/* ------------------------------------------------------------------ */
/* Polls, locations, attachments                                        */
/* ------------------------------------------------------------------ */

const POLL_HEADERS = new Set(['poll:', 'peiling:', 'umfrage:', 'sondage :', 'sondage:', 'encuesta:', 'enquete:', 'sondaggio:', 'anket:']);
const POLL_OPTION_RE = /^(?:option|optie|opción|opcion|opção|opcao|opzione|seçenek)\s?:\s*(.+?)\s*\((\d+)\s+[^)]+\)\s*$/iu;

const LOCATION_RE = /^(?:location|locatie|standort|position|ubicación|ubicacion|localização|localizacao|posizione|konum)\s?:\s*(https?:\/\/\S+)/iu;
const MAPS_ONLY_RE = /^https?:\/\/(?:maps\.google\.[a-z.]+\/|www\.google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl\/|maps\.apple\.com\/)\S*$/iu;

/** iOS: "<attached: 00000012-PHOTO-2023-03-12-14-06-01.jpg>" (label translated in other locales). */
const IOS_ATTACHED_RE = /^<([\p{L} ]{3,24}?)\s?:\s*([^<>]+?)>$/u;
/** Android: "IMG-20230312-WA0001.jpg (file attached)" */
const ANDROID_ATTACHED_RE =
  /^(.+?\.[A-Za-z0-9]{2,5})\s+\((?:file attached|bestand bijgevoegd|datei angehängt|fichier joint|archivo adjunto|arquivo anexado|ficheiro anexado|file allegato|dosya ekli|allegato|adjunto|anexado|bijgevoegd|angehängt|joint|ekli)\)$/iu;

export function typeFromFileName(name: string): MessageType {
  const n = name.toUpperCase();
  const dot = n.lastIndexOf('.');
  const ext = dot >= 0 ? n.slice(dot + 1) : '';
  if (/(?:^|-)(?:STK|STICKER)-/.test(n)) return 'sticker';
  if (/(?:^|-)GIF-/.test(n) || ext === 'GIF') return 'gif';
  if (/(?:^|-)(?:IMG|PHOTO)-/.test(n)) return 'image';
  if (/(?:^|-)(?:VID|VIDEO)-/.test(n)) return 'video';
  if (/(?:^|-)(?:PTT|AUD|AUDIO)-/.test(n)) return 'audio';
  if (ext === 'VCF') return 'contact';
  if (ext === 'WEBP') return 'sticker';
  if (['JPG', 'JPEG', 'PNG', 'HEIC', 'HEIF', 'BMP'].includes(ext)) return 'image';
  if (['MP4', 'MOV', '3GP', 'MKV', 'AVI', 'WEBM', 'M4V'].includes(ext)) return 'video';
  if (['OPUS', 'OGG', 'M4A', 'MP3', 'AAC', 'AMR', 'WAV'].includes(ext)) return 'audio';
  return 'document';
}

/* ------------------------------------------------------------------ */
/* Edited marker                                                        */
/* ------------------------------------------------------------------ */

const EDITED = new Set([
  'this message was edited',
  'dit bericht is bewerkt',
  'diese nachricht wurde bearbeitet',
  'ce message a été modifié',
  'se editó este mensaje',
  'mensaje editado',
  'mensagem editada',
  'esta mensagem foi editada',
  'questo messaggio è stato modificato',
  'bu mesaj düzenlendi',
  'edited',
  'bewerkt',
  'bearbeitet',
  'modifié',
  'editado',
  'modificato',
  'düzenlendi',
]);
const EDITED_TAIL_RE = /\s*<([^<>\n]{4,64})>\s*$/u;

export function stripEdited(text: string): { text: string; edited: boolean } {
  const last = text.charCodeAt(text.length - 1);
  // Fast path: the marker always ends with '>' (possibly followed by whitespace)
  if (last !== 62 && last !== 32 && last !== 10 && last !== 9) return { text, edited: false };
  const t = text.trimEnd();
  if (t.length < 6 || !t.endsWith('>')) return { text, edited: false };
  const m = EDITED_TAIL_RE.exec(t);
  if (m && EDITED.has(normalizeForLookup(m[1]!))) {
    return { text: t.slice(0, m.index).replace(/[\u200E\u200F]+$/u, '').trimEnd(), edited: true };
  }
  return { text, edited: false };
}

/* ------------------------------------------------------------------ */
/* Lookup table construction                                            */
/* ------------------------------------------------------------------ */

const PLACEHOLDERS = new Map<string, ContentClass>();
for (const d of DELETED) PLACEHOLDERS.set(d, { type: 'deleted', text: '' });
for (const g of GENERIC_MEDIA) PLACEHOLDERS.set(g, { type: 'media', text: '' });
for (const [noun, type] of Object.entries(MEDIA_NOUNS)) {
  for (const om of OMISSIONS) PLACEHOLDERS.set(`${noun} ${om}`, { type, text: '' });
}
for (const v of ['null', '<null>']) PLACEHOLDERS.set(v, { type: 'media', text: '', meta: { viewOnce: true } });
for (const v of [
  'view once photo omitted', 'view once video omitted', 'view once voice message omitted', 'view once message',
  'eenmalige weergave', 'foto voor eenmalige weergave weggelaten', 'video voor eenmalige weergave weggelaten',
]) {
  PLACEHOLDERS.set(v, { type: 'media', text: '', meta: { viewOnce: true } });
}
for (const v of [
  'live location shared', 'live location ended', 'live locatie gedeeld', 'live-locatie gedeeld', 'live locatie beëindigd',
  'live-standort geteilt', 'live-standort wird geteilt', 'live-standort beendet', 'position en direct partagée',
  'ubicación en tiempo real compartida', 'localização em tempo real compartilhada', 'posizione attuale condivisa',
  'posizione in tempo reale condivisa', 'canlı konum paylaşıldı',
]) {
  PLACEHOLDERS.set(v, { type: 'location', text: '', meta: { liveLocation: true } });
}
const PENDING = [
  'waiting for this message. this may take a while',
  'waiting for this message',
  'wachten op dit bericht. dit kan even duren',
  'wachten op dit bericht',
  'warten auf diese nachricht. dies kann etwas dauern',
  'warten auf diese nachricht',
  'en attente de ce message. cela peut prendre du temps',
  'en attente de ce message',
  'esperando este mensaje. esto puede tomar tiempo',
  'esperando el mensaje. esto puede tardar un poco',
  'esperando este mensaje',
  'aguardando mensagem. isso pode levar alguns instantes',
  'aguardando mensagem',
  'in attesa di questo messaggio. potrebbe volerci un po\' di tempo',
  'in attesa di questo messaggio',
  'bu mesaj bekleniyor. bu biraz zaman alabilir',
  'bu mesaj bekleniyor',
];
for (const p of PENDING) PLACEHOLDERS.set(p, { type: 'system', text: '', meta: { systemKind: 'pending' } });

const OMISSION_LAST = new Set(OMISSIONS.map((o) => o.slice(o.lastIndexOf(' ') + 1)));
const OMISSION_HINT_RE = /omit|weggel|ausgel|ausgeschl|entfernt|absent|omis|manqu|retir|oculta|oculto|omess|esclus|dahil|atland|eksik/u;
const DOC_OMITTED_SUFFIXES = OMISSIONS.flatMap((om) =>
  ['document', 'documento', 'dokument', 'belge', 'fichier', 'bestand', 'datei'].map((n) => ` ${n} ${om}`),
);

/* ------------------------------------------------------------------ */
/* Content classification                                               */
/* ------------------------------------------------------------------ */

/**
 * Classifies a message body (already stripped of the edited marker).
 * Returns null for ordinary text.
 */
export function classifyContent(text: string): ContentClass | null {
  const nl = text.indexOf('\n');
  const first = nl === -1 ? text : text.slice(0, nl);
  if (first.length > 160) return null;
  // Input has already been through cleanText(), so no invisible characters remain.
  const key = fastKey(first);
  if (key.length === 0) return null;
  const rest = nl === -1 ? '' : text.slice(nl + 1).trim();

  const hit = PLACEHOLDERS.get(key);
  if (hit) {
    if (hit.type === 'deleted' || hit.type === 'system') return hit;
    return { type: hit.type, text: rest, meta: hit.meta };
  }

  const c0 = key.charCodeAt(0);

  // Attachments (exports "with media")
  if (c0 === 60 /* < */ && key.endsWith('>')) {
    if (GENERIC_MEDIA_RE.test(key)) return { type: 'media', text: rest };
    const m = IOS_ATTACHED_RE.exec(cleanFirst(first));
    if (m) {
      const fileName = m[2]!.trim();
      if (/\.[A-Za-z0-9]{2,5}$/.test(fileName)) return { type: typeFromFileName(fileName), text: rest, meta: { fileName } };
    }
  }
  if (key.endsWith(')')) {
    const m = ANDROID_ATTACHED_RE.exec(cleanFirst(first));
    if (m) {
      const fileName = m[1]!.trim();
      return { type: typeFromFileName(fileName), text: rest, meta: { fileName } };
    }
  }

  // "Report.pdf • 3 pages document omitted"
  const lastSpace = key.lastIndexOf(' ');
  if (lastSpace > 0 && key.length < 140 && OMISSION_LAST.has(key.slice(lastSpace + 1)) && OMISSION_HINT_RE.test(key)) {
    for (const suf of DOC_OMITTED_SUFFIXES) {
      if (key.endsWith(suf)) {
        const name = cleanFirst(first).slice(0, -suf.length).split('•')[0]!.trim();
        return { type: 'document', text: rest, meta: name ? { fileName: name } : undefined };
      }
    }
  }

  // Deleted by admin etc.
  if (key.length < 100 && key.length > 12 && DELETED_FIRST_CHARS.has(c0)) {
    for (const p of DELETED_PREFIXES) {
      if (key.startsWith(p)) return { type: 'deleted', text: '' };
    }
  }

  // Polls
  if (POLL_HEADERS.has(key)) return parsePoll(rest);

  // Calls
  if (key.length < 70 && CALL_HINT_RE.test(key)) {
    for (const r of CALL_RULES) {
      const cm = r.re.exec(key);
      if (cm && isCallRemainder(key.slice(cm[0].length))) {
        const meta: MessageMeta = { missed: r.missed, video: r.video };
        const d = parseDuration(key);
        if (d !== undefined) meta.durationSec = d;
        return { type: 'call', text: '', meta };
      }
    }
  }

  // Locations (always contain a URL)
  if (key.indexOf('http') !== -1) {
    const cf = first.trim();
    if (LOCATION_RE.test(cf)) return { type: 'location', text: rest };
    if (nl === -1 && MAPS_ONLY_RE.test(cf)) return { type: 'location', text: '' };
  }

  return null;
}

function cleanFirst(s: string): string {
  return s.replace(/[‎‏‪-‮⁦-⁩﻿]/g, '').replace(/[  ]/g, ' ').trim();
}

function parsePoll(body: string): ContentClass {
  const lines = body.split('\n').map((l) => cleanFirst(l)).filter(Boolean);
  let question = '';
  const options: PollOption[] = [];
  for (const line of lines) {
    const m = POLL_OPTION_RE.exec(line);
    if (m) options.push({ label: m[1]!, votes: Number(m[2]) });
    else if (!question) question = line;
  }
  return { type: 'poll', text: question, meta: { pollQuestion: question, pollOptions: options } };
}

/* ------------------------------------------------------------------ */
/* System messages                                                      */
/* ------------------------------------------------------------------ */

export interface SystemMatch {
  kind: SystemKind;
  actor?: string;
  targets?: string[];
  subject?: string;
}

const ENCRYPTION_HINTS = [
  'end-to-end',
  'end-to-endversleuteling',
  'ende-zu-ende',
  'de bout en bout',
  'de extremo a extremo',
  'ponta a ponta',
  'uçtan uca',
];

interface SysRule {
  kind: SystemKind;
  re: RegExp;
  /** The action targets the exporting user ("Sarah added you"). */
  selfTarget?: boolean;
}

const r = (kind: SystemKind, re: RegExp, selfTarget = false): SysRule => ({ kind, re, selfTarget });

const SYSTEM_RULES: SysRule[] = [
  // ---------- en ----------
  r('created', /^(?<actor>.+?) created (?:the )?group ["“](?<subject>.+)["”]$/iu),
  r('created', /^(?<actor>.+?) created (?:this )?group$/iu),
  r('added', /^(?<actor>.+?) added you$/iu, true),
  r('added', /^(?<actor>.+?) added (?<targets>.+)$/iu),
  r('added', /^(?<targets>.+?) (?:was|were) added$/iu),
  r('removed', /^(?<actor>.+?) removed you$/iu, true),
  r('removed', /^(?<actor>.+?) removed (?<targets>.+)$/iu),
  r('removed', /^(?<targets>.+?) (?:was|were) removed$/iu),
  r('left', /^(?<actor>.+?) left(?: the group)?$/iu),
  r('joined', /^(?<actor>.+?) joined (?:using|via|from) .*(?:link|community)$/iu),
  r('joined', /^(?<actor>.+?) joined(?: the group)?$/iu),
  r('subject', /^(?<actor>.+?) changed the (?:subject|group name)(?: from .+?)? to ["“](?<subject>.+)["”]$/iu),
  r('subject', /^(?<actor>.+?) changed the (?:subject|group name)\b/iu),
  r('icon', /^(?<actor>.+?) (?:changed|deleted|removed) (?:this group's|the group's|the group) (?:icon|photo|picture|image)$/iu),
  r('description', /^(?<actor>.+?) (?:changed|deleted|removed) the group description$/iu),
  r('security', /security code (?:with .+? )?(?:has )?changed/iu),
  r('number', /^(?<actor>.+?) changed (?:their|his|her) phone number/iu),
  r('number', /^(?<actor>.+?) changed to \+?[\d\s()-]+$/iu),
  r('disappearing', /disappearing messages/iu),
  r('admin', /(?:now an admin|no longer an admin)/iu),
  r('other', /^(?:this chat is with a business account|this business (?:works|uses)|messages to this group are now secured|you (?:un)?blocked this contact|this group was added to the community|.+ pinned a message|.+ changed (?:this group's|the group) settings|.+ turned (?:on|off) admin approval|.+ added this group to the community|tap to learn more|this chat is now)/iu),
  // ---------- nl ----------
  r('created', /^(?<actor>.+?) (?:heeft|hebt) (?:de )?groep ["“„](?<subject>.+)["”] (?:aangemaakt|gemaakt)$/iu),
  r('created', /^(?<actor>.+?) (?:heeft|hebt) (?:deze )?groep (?:aangemaakt|gemaakt)$/iu),
  r('added', /^(?<actor>.+?) (?:heeft|hebt) jou toegevoegd$/iu, true),
  r('added', /^(?<actor>.+?) (?:heeft|hebt) (?<targets>.+?) toegevoegd$/iu),
  r('added', /^(?<targets>.+?) (?:is|zijn|bent|werd|werden) toegevoegd$/iu),
  r('removed', /^(?<actor>.+?) (?:heeft|hebt) (?<targets>.+?) verwijderd$/iu),
  r('removed', /^(?<targets>.+?) (?:is|zijn|bent) verwijderd$/iu),
  r('left', /^(?<actor>.+?) (?:is vertrokken|bent vertrokken|heeft de groep verlaten|hebt de groep verlaten)$/iu),
  r('joined', /^(?<actor>.+?) (?:neemt|nam|heeft|hebt) deel via (?:de )?(?:uitnodigingslink|link)/iu),
  r('joined', /^(?<actor>.+?) (?:is lid geworden|bent lid geworden|neemt nu deel|is toegetreden|doet nu mee)/iu),
  r('subject', /^(?<actor>.+?) (?:heeft|hebt) (?:het onderwerp|de groepsnaam|de naam van de groep) (?:gewijzigd|veranderd)(?: van .+?)? (?:in|naar) ["“„](?<subject>.+)["”]$/iu),
  r('subject', /^(?<actor>.+?) (?:heeft|hebt) (?:het onderwerp|de groepsnaam|de naam van de groep) .*(?:gewijzigd|veranderd)/iu),
  r('icon', /^(?<actor>.+?) (?:heeft|hebt) (?:het pictogram|de afbeelding|de foto|de groepsafbeelding|de groepsfoto|het groepspictogram)(?: van (?:deze|de) groep)? (?:gewijzigd|verwijderd|veranderd)$/iu),
  r('description', /groepsbeschrijving (?:gewijzigd|verwijderd|veranderd)/iu),
  r('security', /beveiligingscode/iu),
  r('number', /(?:telefoonnummer|nummer) (?:gewijzigd|veranderd)|is gewijzigd (?:in|naar) \+?\d/iu),
  r('disappearing', /(?:verdwijnende|tijdelijke) berichten/iu),
  r('admin', /(?:nu (?:een )?beheerder|geen beheerder meer)/iu),
  r('other', /^(?:deze chat is met een zakelijk account|.+ heeft een bericht vastgezet|tik voor meer info)/iu),
  // ---------- de ----------
  r('created', /^(?<actor>.+?) (?:hat|hast) (?:die )?Gruppe [„"“](?<subject>.+)[“"”] erstellt$/iu),
  r('created', /^(?<actor>.+?) (?:hat|hast) (?:diese )?Gruppe erstellt$/iu),
  r('added', /^(?<actor>.+?) (?:hat|hast) dich hinzugefügt$/iu, true),
  r('added', /^(?<actor>.+?) (?:hat|hast) (?<targets>.+?) hinzugefügt$/iu),
  r('added', /^(?<targets>.+?) (?:wurdest|wurde|wurden) hinzugefügt$/iu),
  r('removed', /^(?<actor>.+?) (?:hat|hast) (?<targets>.+?) entfernt$/iu),
  r('left', /^(?<actor>.+?) (?:hat|hast) die Gruppe verlassen$/iu),
  r('left', /^(?<actor>.+?) (?:ist|bist) ausgetreten$/iu),
  r('joined', /^(?<actor>.+?) (?:ist|bist) (?:der Gruppe )?(?:über|mit) (?:den|dem) Einladungslink.* beigetreten$/iu),
  r('joined', /^(?<actor>.+?) (?:ist|bist) (?:der Gruppe )?beigetreten$/iu),
  r('subject', /^(?<actor>.+?) (?:hat|hast) den (?:Betreff|Gruppennamen)(?: von .+?)? (?:zu|in) [„"“](?<subject>.+)[“"”] geändert$/iu),
  r('subject', /^(?<actor>.+?) (?:hat|hast) den (?:Betreff|Gruppennamen) .*geändert/iu),
  r('icon', /^(?<actor>.+?) (?:hat|hast) (?:das Gruppenbild|das Bild dieser Gruppe|das Gruppenfoto|das Gruppensymbol) (?:geändert|gelöscht|entfernt)$/iu),
  r('description', /Gruppenbeschreibung (?:geändert|gelöscht)/iu),
  r('security', /Sicherheitsnummer|Sicherheitscode/iu),
  r('number', /(?:Telefonnummer|Nummer) geändert|(?:hat|hast) zu \+?\d.* gewechselt/iu),
  r('disappearing', /selbstlöschende Nachrichten|verschwindende Nachrichten/iu),
  r('admin', /(?:jetzt|nun) (?:ein )?Admin|kein Admin mehr/iu),
  // ---------- fr ----------
  r('created', /^(?<actor>.+?) (?:a|avez) créé (?:le )?groupe [«"“]\s?(?<subject>.+?)\s?[»"”]$/iu),
  r('created', /^(?<actor>.+?) (?:a|avez) créé (?:ce )?groupe$/iu),
  r('added', /^(?<actor>.+?) vous a ajouté(?:e)?$/iu, true),
  r('added', /^(?<actor>.+?) (?:a|avez) ajouté (?<targets>.+)$/iu),
  r('added', /^(?<targets>.+?) (?:a|avez) été ajouté(?:e|s|es)?$/iu),
  r('removed', /^(?<actor>.+?) vous a retiré(?:e)?$/iu, true),
  r('removed', /^(?<actor>.+?) (?:a|avez) retiré (?<targets>.+)$/iu),
  r('left', /^(?<actor>.+?) (?:est|êtes) parti(?:e|s|es)?$/iu),
  r('left', /^(?<actor>.+?) (?:a|avez) quitté(?: le groupe| ce groupe)?$/iu),
  r('joined', /^(?<actor>.+?) (?:a|avez) rejoint (?:ce groupe|le groupe).*(?:lien|invitation)/iu),
  r('joined', /^(?<actor>.+?) (?:a|avez) rejoint (?:ce groupe|le groupe)$/iu),
  r('subject', /^(?<actor>.+?) (?:a|avez) (?:modifié|changé) (?:le sujet|le nom du groupe)/iu),
  r('icon', /^(?<actor>.+?) (?:a|avez) (?:modifié|changé|supprimé) (?:l['’]icône|la photo|l['’]image)(?: de ce groupe| du groupe)?$/iu),
  r('description', /(?:modifié|supprimé|changé) la description du groupe/iu),
  r('security', /code de sécurité/iu),
  r('number', /(?:a changé de|changé son) numéro/iu),
  r('disappearing', /messages éphémères/iu),
  r('admin', /(?:maintenant|désormais) admin|n['’](?:êtes|es) plus admin/iu),
  // ---------- es ----------
  r('created', /^(?<actor>.+?) (?:creó|creo|creaste) (?:el )?grupo [«"“](?<subject>.+)[»"”]$/iu),
  r('created', /^(?<actor>.+?) (?:creó|creo|creaste) (?:este )?grupo$/iu),
  r('added', /^(?<actor>.+?) te (?:añadió|agregó)$/iu, true),
  r('added', /^(?<actor>.+?) (?:añadió|agregó|añadiste|agregaste) a (?<targets>.+)$/iu),
  r('removed', /^(?<actor>.+?) te (?:eliminó|sacó)$/iu, true),
  r('removed', /^(?<actor>.+?) (?:eliminó|sacó|eliminaste|sacaste) a (?<targets>.+)$/iu),
  r('left', /^(?<actor>.+?) (?:salió|saliste)(?: del grupo)?$/iu),
  r('joined', /^(?<actor>.+?) (?:se unió|te uniste) (?:usando|mediante|con|a través de)(?: el)? (?:enlace|link)/iu),
  r('joined', /^(?<actor>.+?) (?:se unió|te uniste)(?: al grupo)?$/iu),
  r('subject', /^(?<actor>.+?) (?:cambió|cambiaste) (?:el asunto|el nombre del grupo|el tema)/iu),
  r('icon', /^(?<actor>.+?) (?:cambió|eliminó|cambiaste|eliminaste) (?:el ícono|el icono|la imagen|la foto)(?: de este grupo| del grupo)?$/iu),
  r('description', /(?:cambió|eliminó|cambiaste|eliminaste) la descripción del grupo/iu),
  r('security', /código de seguridad/iu),
  r('number', /cambió (?:su|de) número/iu),
  r('disappearing', /mensajes temporales/iu),
  r('admin', /(?:ahora eres|ya no eres) admin/iu),
  // ---------- pt ----------
  r('created', /^(?<actor>.+?) criou (?:o )?grupo [«"“](?<subject>.+)[»"”]$/iu),
  r('created', /^(?<actor>.+?) criou (?:este )?grupo$/iu),
  r('added', /^(?<actor>.+?) adicionou você$/iu, true),
  r('added', /^(?<actor>.+?) adicionou (?<targets>.+)$/iu),
  r('added', /^(?<targets>.+?) foi adicionad[oa]$/iu),
  r('removed', /^(?<actor>.+?) removeu você$/iu, true),
  r('removed', /^(?<actor>.+?) removeu (?<targets>.+)$/iu),
  r('left', /^(?<actor>.+?) saiu(?: do grupo)?$/iu),
  r('joined', /^(?<actor>.+?) entrou (?:usando|através d[oa]|pelo) (?:o )?link/iu),
  r('joined', /^(?<actor>.+?) entrou(?: no grupo)?$/iu),
  r('subject', /^(?<actor>.+?) (?:mudou|alterou) o (?:assunto|nome do grupo)/iu),
  r('icon', /^(?<actor>.+?) (?:mudou|alterou|apagou|removeu) (?:a imagem|o ícone|a foto)(?: deste grupo| do grupo)?$/iu),
  r('description', /(?:mudou|alterou|apagou) a descrição do grupo/iu),
  r('security', /código de segurança/iu),
  r('number', /mudou (?:seu|de) número/iu),
  r('disappearing', /mensagens temporárias/iu),
  r('admin', /(?:agora é|não é mais) admin/iu),
  // ---------- it ----------
  r('created', /^(?<actor>.+?) ha creato (?:il )?gruppo [«"“](?<subject>.+)[»"”]$/iu),
  r('created', /^(?<actor>.+?) ha creato (?:questo )?gruppo$/iu),
  r('added', /^(?<actor>.+?) ti ha aggiunto$/iu, true),
  r('added', /^(?<actor>.+?) ha aggiunto (?<targets>.+)$/iu),
  r('added', /^(?<targets>.+?) (?:è stat[oa]|sei stat[oa]) aggiunt[oa]$/iu),
  r('removed', /^(?<actor>.+?) ti ha rimosso$/iu, true),
  r('removed', /^(?<actor>.+?) ha rimosso (?<targets>.+)$/iu),
  r('left', /^(?<actor>.+?) (?:è uscit[oa]|sei uscit[oa]|ha abbandonato(?: il gruppo)?)$/iu),
  r('joined', /^(?<actor>.+?) (?:si è unit[oa]|è entrat[oa]|ti sei unit[oa]) (?:tramite|usando|con) (?:il )?link/iu),
  r('joined', /^(?<actor>.+?) (?:si è unit[oa]|ti sei unit[oa])(?: al gruppo)?$/iu),
  r('subject', /^(?<actor>.+?) ha (?:cambiato|modificato) (?:l['’]oggetto|il nome del gruppo)/iu),
  r('icon', /^(?<actor>.+?) ha (?:cambiato|modificato|eliminato) (?:l['’]immagine|l['’]icona)(?: di questo gruppo| del gruppo)?$/iu),
  r('description', /(?:modificato|eliminato|cambiato) la descrizione del gruppo/iu),
  r('security', /codice di sicurezza/iu),
  r('number', /ha cambiato (?:il suo )?numero/iu),
  r('disappearing', /messaggi effimeri|messaggi temporanei/iu),
  r('admin', /(?:ora sei|non sei più) (?:un )?amministratore/iu),
  // ---------- tr ----------
  r('created', /^(?<actor>.+?),? ["“](?<subject>.+)["”] grubunu oluşturdu$/iu),
  r('created', /^(?<actor>.+?) (?:bu )?grubu oluşturdu$/iu),
  r('added', /^(?<actor>.+?) sizi ekledi$/iu, true),
  r('added', /^(?<actor>.+?),? (?<targets>.+?) (?:kişisini|adlı kişiyi|kişilerini) ekledi$/iu),
  r('removed', /^(?<actor>.+?) sizi çıkardı$/iu, true),
  r('removed', /^(?<actor>.+?),? (?<targets>.+?) (?:kişisini|adlı kişiyi) çıkardı$/iu),
  r('left', /^(?<actor>.+?) (?:gruptan )?ayrıldı$/iu),
  r('joined', /^(?<actor>.+?) (?:bu grubun )?davet bağlantısıyla (?:gruba )?katıldı$/iu),
  r('joined', /^(?<actor>.+?) (?:gruba )?katıldı$/iu),
  r('subject', /^(?<actor>.+?) (?:konuyu|grup adını|grubun adını) .*değiştirdi/iu),
  r('icon', /^(?<actor>.+?) bu grubun (?:simgesini|resmini|fotoğrafını) (?:değiştirdi|sildi)$/iu),
  r('description', /grup açıklamasını (?:değiştirdi|sildi)/iu),
  r('security', /güvenlik kodu/iu),
  r('number', /telefon numarasını değiştirdi/iu),
  r('disappearing', /süreli mesaj|kaybolan mesaj/iu),
  r('admin', /artık (?:bir )?yönetici/iu),
];

const LIST_SPLIT_RE = /\s*,\s*|\s+(?:and|en|und|et|y|e|ve|&)\s+/iu;

function splitNames(s: string): string[] {
  return s
    .split(LIST_SPLIT_RE)
    .map((x) => x.replace(/^["“„«]|["”»]$/g, '').trim())
    .filter((x) => x.length > 0 && x.length <= 60);
}

/** Matches a (cleaned) line of text against known system messages. */
export function matchSystem(text: string): SystemMatch | null {
  const t = text.trim();
  if (t.length === 0 || t.length > 400) return null;
  const lower = t.toLowerCase();
  for (const h of ENCRYPTION_HINTS) {
    if (lower.includes(h) && /(?:encrypt|versleutel|verschlüssel|chiffr|cifrad|criptograf|crittograf|şifrel)/iu.test(lower)) {
      return { kind: 'encryption' };
    }
  }
  for (const rule of SYSTEM_RULES) {
    const m = rule.re.exec(t);
    if (!m) continue;
    const g = m.groups ?? {};
    const out: SystemMatch = { kind: rule.kind };
    if (g['actor']) out.actor = g['actor'].trim();
    if (g['targets']) out.targets = splitNames(g['targets']);
    if (rule.selfTarget) out.targets = ['You'];
    if (g['subject']) out.subject = g['subject'].trim();
    // Guard against prose: actor names are short and don't contain sentence punctuation.
    if (out.actor && (out.actor.length > 60 || /[.!?]\s/.test(out.actor))) continue;
    if (out.targets && out.targets.some((x) => x.length > 60)) continue;
    return out;
  }
  return null;
}

/** Labels some exports use for the exporting user. */
export const SELF_LABELS = new Set(['You', 'you', 'Jij', 'jij', 'Du', 'Vous', 'Tú', 'Você', 'Tu', 'Sen']);
