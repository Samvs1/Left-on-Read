/**
 * Turns an uploaded file (.txt or .zip) into chat text.
 *
 * Small zips go through JSZip. Very large "export with media" zips (hundreds of
 * MB on phones) are read lazily: only the central directory and the chat .txt
 * entry are sliced out of the Blob and inflated with the native
 * DecompressionStream, so the media never has to be loaded into memory.
 */
import JSZip from 'jszip';
import { ChatParseError } from './types';

export interface ChatFile {
  text: string;
  /** Name of the .txt inside the zip, or the uploaded file name. */
  sourceName: string;
  /** Title guessed from the file name ("WhatsApp Chat with Sarah.txt" → "Sarah"). */
  titleHint: string | null;
}

const LARGE_ZIP_BYTES = 48 * 1024 * 1024;
const MAX_TEXT_BYTES = 512 * 1024 * 1024;

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05) && (bytes[3] === 0x04 || bytes[3] === 0x06);
}

/** Decodes bytes as UTF-8 / UTF-16 (BOM-aware). Throws BINARY for non-text data. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let zeros = 0;
  for (let i = 0; i < sample.length; i++) if (sample[i] === 0) zeros++;
  if (sample.length > 0 && zeros / sample.length > 0.2) {
    // UTF-16 without BOM? Every other byte is zero for Latin text.
    let evenZeros = 0;
    let oddZeros = 0;
    for (let i = 0; i < sample.length; i++) if (sample[i] === 0) (i % 2 === 0 ? evenZeros++ : oddZeros++);
    if (oddZeros > sample.length * 0.3 && evenZeros < sample.length * 0.05) return new TextDecoder('utf-16le').decode(bytes);
    if (evenZeros > sample.length * 0.3 && oddZeros < sample.length * 0.05) return new TextDecoder('utf-16be').decode(bytes);
    throw new ChatParseError('BINARY', 'This looks like a binary file, not a chat export');
  }
  if (zeros > 0) throw new ChatParseError('BINARY', 'This looks like a binary file, not a chat export');
  const text = new TextDecoder('utf-8').decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

const TITLE_PATTERNS: RegExp[] = [
  /^whatsapp[\s-]*chat\s*(?:with|met|mit|avec|con|com|ile)\s+(.+)$/iu,
  /^whatsapp[\s-]*chat\s*[-–—:]\s*(.+)$/iu,
  /^(?:discussion|conversation)\s+whatsapp\s+(?:avec|with)\s+(.+)$/iu,
  /^(?:chat|conversa|conversación)\s+(?:de|do|di)\s+whatsapp\s+(?:con|com|with)\s+(.+)$/iu,
  /^chat\s+whatsapp\s+(?:con|com)\s+(.+)$/iu,
  /^(.+?)\s+ile\s+whatsapp\s+sohbeti$/iu,
  /^whatsapp\s+sohbeti\s*[-–—:]\s*(.+)$/iu,
];

export function titleFromFileName(name: string): string | null {
  const base = name.replace(/^.*[\\/]/, '').replace(/\.(txt|zip)$/i, '').replace(/\s*\(\d+\)$/, '').trim();
  if (!base || /^_?chat$/i.test(base)) return null;
  for (const re of TITLE_PATTERNS) {
    const m = re.exec(base);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function pickChatEntry(names: string[]): string | null {
  const txt = names.filter((n) => /\.txt$/i.test(n) && !n.startsWith('__MACOSX') && !/\/\._/.test(n) && !/^\._/.test(n.replace(/^.*\//, '')));
  if (txt.length === 0) return null;
  const exact = txt.find((n) => /(?:^|\/)_chat\.txt$/i.test(n));
  if (exact) return exact;
  const wa = txt.find((n) => /whatsapp/i.test(n));
  return wa ?? txt[0]!;
}

async function readWithJSZip(data: ArrayBuffer | Uint8Array | Blob): Promise<{ text: string; name: string }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new ChatParseError('ZIP_INVALID', 'The zip file could not be opened');
  }
  const names = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir);
  const chosen = pickChatEntry(names);
  if (!chosen) throw new ChatParseError('ZIP_NO_CHAT', 'No chat .txt file inside the zip');
  // If several .txt files exist, prefer the largest non-_chat one only when no _chat.txt exists.
  let name = chosen;
  if (!/(?:^|\/)_chat\.txt$/i.test(chosen)) {
    let best = -1;
    for (const n of names) {
      if (!/\.txt$/i.test(n) || n.startsWith('__MACOSX')) continue;
      const size = (zip.files[n] as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
      if (size > best && (/whatsapp/i.test(n) || !/whatsapp/i.test(chosen))) {
        best = size;
        name = n;
      }
    }
  }
  const bytes = await zip.files[name]!.async('uint8array');
  return { text: decodeText(bytes), name };
}

/* ---------------- Lazy zip reader (central directory) ---------------- */

interface CdEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);
const u64 = (v: DataView, o: number) => Number(v.getBigUint64(o, true));

async function sliceBytes(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

export async function readZipEntriesLazy(blob: Blob): Promise<CdEntry[]> {
  const size = blob.size;
  const tailLen = Math.min(size, 65557 + 20);
  const tail = await sliceBytes(blob, size - tailLen, size);
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tv, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ChatParseError('ZIP_INVALID', 'Zip end record not found');
  let entries = u16(tv, eocd + 10);
  let cdSize = u32(tv, eocd + 12);
  let cdOffset = u32(tv, eocd + 16);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || entries === 0xffff) {
    // Zip64: locator sits 20 bytes before the EOCD record.
    const loc = eocd - 20;
    if (loc < 0 || u32(tv, loc) !== 0x07064b50) throw new ChatParseError('ZIP_INVALID', 'Zip64 locator missing');
    const z64Offset = u64(tv, loc + 8);
    const z64 = await sliceBytes(blob, z64Offset, z64Offset + 56);
    const zv = new DataView(z64.buffer, z64.byteOffset, z64.byteLength);
    if (u32(zv, 0) !== 0x06064b50) throw new ChatParseError('ZIP_INVALID', 'Zip64 record missing');
    entries = u64(zv, 32);
    cdSize = u64(zv, 40);
    cdOffset = u64(zv, 48);
  }
  const cd = await sliceBytes(blob, cdOffset, cdOffset + cdSize);
  const cv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const out: CdEntry[] = [];
  const utf8 = new TextDecoder('utf-8');
  let p = 0;
  for (let e = 0; e < entries && p + 46 <= cd.length; e++) {
    if (u32(cv, p) !== 0x02014b50) break;
    const method = u16(cv, p + 10);
    let compressedSize = u32(cv, p + 20);
    let uncompressedSize = u32(cv, p + 24);
    const nameLen = u16(cv, p + 28);
    const extraLen = u16(cv, p + 30);
    const commentLen = u16(cv, p + 32);
    let localOffset = u32(cv, p + 42);
    const name = utf8.decode(cd.subarray(p + 46, p + 46 + nameLen));
    // Zip64 extended information extra field
    let x = p + 46 + nameLen;
    const xEnd = x + extraLen;
    while (x + 4 <= xEnd) {
      const id = u16(cv, x);
      const len = u16(cv, x + 2);
      if (id === 0x0001) {
        let q = x + 4;
        if (uncompressedSize === 0xffffffff) { uncompressedSize = u64(cv, q); q += 8; }
        if (compressedSize === 0xffffffff) { compressedSize = u64(cv, q); q += 8; }
        if (localOffset === 0xffffffff) { localOffset = u64(cv, q); q += 8; }
      }
      x += 4 + len;
    }
    out.push({ name, method, compressedSize, uncompressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipLazy(blob: Blob): Promise<{ text: string; name: string }> {
  const entries = await readZipEntriesLazy(blob);
  const chosenName = pickChatEntry(entries.map((e) => e.name));
  if (!chosenName) throw new ChatParseError('ZIP_NO_CHAT', 'No chat .txt file inside the zip');
  const entry = entries.find((e) => e.name === chosenName)!;
  if (entry.uncompressedSize > MAX_TEXT_BYTES) throw new ChatParseError('TOO_LARGE', 'The chat text is too large');
  const lh = await sliceBytes(blob, entry.localOffset, entry.localOffset + 30);
  const lv = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
  if (u32(lv, 0) !== 0x04034b50) throw new ChatParseError('ZIP_INVALID', 'Bad local header');
  const start = entry.localOffset + 30 + u16(lv, 26) + u16(lv, 28);
  const raw = await sliceBytes(blob, start, start + entry.compressedSize);
  let bytes: Uint8Array;
  if (entry.method === 0) bytes = raw;
  else if (entry.method === 8) bytes = await inflateRaw(raw);
  else throw new ChatParseError('ZIP_INVALID', `Unsupported compression method ${entry.method}`);
  return { text: decodeText(bytes), name: chosenName };
}

/** Reads a dropped/picked/shared file into chat text. */
export async function readChatFile(file: Blob, fileName: string): Promise<ChatFile> {
  if (file.size === 0) throw new ChatParseError('EMPTY', 'The file is empty');
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (isZip(head)) {
    let res: { text: string; name: string } | null = null;
    const canLazy = typeof DecompressionStream !== 'undefined';
    if (file.size > LARGE_ZIP_BYTES && canLazy) {
      try {
        res = await readZipLazy(file);
      } catch (e) {
        if (e instanceof ChatParseError && e.code === 'ZIP_NO_CHAT') throw e;
        res = null;
      }
    }
    res ??= await readWithJSZip(file);
    return { text: res.text, sourceName: res.name, titleHint: titleFromFileName(fileName) ?? titleFromFileName(res.name) };
  }
  if (file.size > MAX_TEXT_BYTES) throw new ChatParseError('TOO_LARGE', 'The file is too large');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { text: decodeText(bytes), sourceName: fileName, titleHint: titleFromFileName(fileName) };
}
