import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { ChatParseError, decodeText, isZip, parseChat, readChatFile, readZipLazy } from '../index';

const CHAT = '[14/03/2023, 09:15:02] Sarah: Hi 👋\n[14/03/2023, 09:16:00] Tom: Hey!';

async function makeZip(files: Record<string, string>, compression: 'DEFLATE' | 'STORE' = 'DEFLATE'): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'uint8array', compression });
}

describe('file decoding', () => {
  it('reads a UTF-8 .txt file', async () => {
    const f = await readChatFile(new Blob([CHAT]), 'WhatsApp Chat with Sarah.txt');
    expect(f.text).toBe(CHAT);
    expect(f.titleHint).toBe('Sarah');
  });

  it('decodes UTF-16 with BOM', () => {
    const s = 'Hi ✓';
    const buf = new Uint8Array(2 + s.length * 2);
    buf[0] = 0xff;
    buf[1] = 0xfe;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      buf[2 + i * 2] = c & 0xff;
      buf[3 + i * 2] = c >> 8;
    }
    expect(decodeText(buf)).toBe(s);
  });

  it('rejects binary files', async () => {
    const bin = new Uint8Array(2000).map((_, i) => (i % 3 === 0 ? 0 : (i * 7) % 255));
    await expect(readChatFile(new Blob([bin]), 'photo.jpg')).rejects.toMatchObject({ code: 'BINARY' });
  });

  it('extracts _chat.txt from an iOS zip with JSZip', async () => {
    const zip = await makeZip({ '_chat.txt': CHAT, '00000012-PHOTO-2023-03-14.jpg': 'binary' });
    expect(isZip(zip)).toBe(true);
    const f = await readChatFile(new Blob([zip as BlobPart]), 'WhatsApp Chat - Sarah.zip');
    expect(f.text).toBe(CHAT);
    expect(f.sourceName).toBe('_chat.txt');
    expect(f.titleHint).toBe('Sarah');
    expect(parseChat(f.text).messages).toHaveLength(2);
  });

  it('prefers the WhatsApp .txt in Android zips', async () => {
    const zip = await makeZip({ 'notes.txt': 'x', 'WhatsApp Chat with Tom.txt': CHAT });
    const f = await readChatFile(new Blob([zip as BlobPart]), 'export.zip');
    expect(f.text).toBe(CHAT);
  });

  it('fails clearly when a zip has no chat', async () => {
    const zip = await makeZip({ 'IMG-1.jpg': 'binary' });
    await expect(readChatFile(new Blob([zip as BlobPart]), 'x.zip')).rejects.toBeInstanceOf(ChatParseError);
    await expect(readChatFile(new Blob([zip as BlobPart]), 'x.zip')).rejects.toMatchObject({ code: 'ZIP_NO_CHAT' });
  });

  it('reads deflated and stored entries lazily from the central directory', async () => {
    const big = `${CHAT}\n`.repeat(50);
    for (const mode of ['DEFLATE', 'STORE'] as const) {
      const zip = await makeZip({ 'media/IMG-1.jpg': 'x'.repeat(1000), '_chat.txt': big }, mode);
      const res = await readZipLazy(new Blob([zip as BlobPart]));
      expect(res.name).toBe('_chat.txt');
      expect(res.text).toBe(big);
    }
  });

  it('rejects empty files', async () => {
    await expect(readChatFile(new Blob([]), 'empty.txt')).rejects.toMatchObject({ code: 'EMPTY' });
  });
});
