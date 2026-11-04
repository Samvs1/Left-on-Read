import { describe, expect, it } from 'vitest';
import { parseChat, type Message } from '../index';

const LRM = '‎';

/** Wraps lines into an Android export with a known regular author so the chat is valid. */
function android(lines: string[]): Message[] {
  const body = lines.map((l, i) => `14/03/2023, 10:${String(i + 10).padStart(2, '0')} - ${l}`).join('\n');
  return parseChat(`14/03/2023, 10:00 - Sarah: hi\n14/03/2023, 10:01 - Tom: hey\n${body}`).messages.slice(2);
}

/** Wraps message bodies into an iOS export from "Tom". */
function ios(bodies: string[], author = 'Tom'): Message[] {
  const body = bodies.map((b, i) => `[14/03/2023, 10:${String(i + 10).padStart(2, '0')}:00] ${author}: ${b}`).join('\n');
  return parseChat(`[14/03/2023, 10:00:00] Sarah: hi\n[14/03/2023, 10:01:00] Tom: hey\n${body}`).messages.slice(2);
}

describe('system messages', () => {
  it('detects the Android encryption notice in all supported languages', () => {
    const msgs = android([
      'Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.',
      'Berichten en oproepen worden end-to-end versleuteld. Niemand buiten deze chat kan ze lezen of beluisteren.',
      'Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt. Niemand außerhalb dieses Chats kann sie lesen.',
      'Les messages et les appels sont chiffrés de bout en bout. Aucune personne extérieure à cette discussion ne peut les lire.',
      'Los mensajes y las llamadas están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos.',
      'As mensagens e as chamadas são protegidas com a criptografia de ponta a ponta.',
      'I messaggi e le chiamate sono crittografati end-to-end. Nessuno al di fuori di questa chat può leggerli.',
      'Mesajlar ve aramalar uçtan uca şifrelidir. Bu sohbetin dışında bulunan hiç kimse bunları okuyamaz.',
    ]);
    expect(msgs).toHaveLength(8);
    for (const m of msgs) {
      expect(m.type).toBe('system');
      expect(m.author).toBeNull();
      expect(m.meta?.systemKind).toBe('encryption');
    }
  });

  it('detects the iOS encryption notice attributed to the contact', () => {
    const r = parseChat(`[14/03/2023, 09:00:00] Sarah: ${LRM}Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
[14/03/2023, 09:15:02] Sarah: Hi
[14/03/2023, 09:16:00] Tom: Hey`);
    expect(r.messages[0]).toMatchObject({ type: 'system', author: null });
    expect(r.participants).toEqual(['Sarah', 'Tom']);
    expect(r.isGroup).toBe(false);
  });

  it('parses English group events with actors and targets', () => {
    const msgs = android([
      'Sarah created group "Weekend Crew"',
      'Sarah added Tom, Lisa and Mark',
      'Tom left',
      'Sarah removed Mark',
      "Noor joined using this group's invite link",
      'Lisa changed the subject from "Weekend Crew" to "Weekend Crew 🍕"',
      "Lisa changed this group's icon",
      'Tom changed the group description',
    ]);
    expect(msgs.map((m) => m.meta?.systemKind)).toEqual(['created', 'added', 'left', 'removed', 'joined', 'subject', 'icon', 'description']);
    expect(msgs[1]!.meta).toMatchObject({ actor: 'Sarah', targets: ['Tom', 'Lisa', 'Mark'] });
    expect(msgs[2]!.meta?.actor).toBe('Tom');
    expect(msgs[5]!.meta?.subject).toBe('Weekend Crew 🍕');
  });

  it('handles an Android subject change whose name contains a colon', () => {
    const r = parseChat(`14/03/2023, 10:00 - Sarah: hi
14/03/2023, 10:01 - Tom: hey
14/03/2023, 10:02 - Sarah changed the subject from "Trip: Paris" to "Trip: Rome"
14/03/2023, 10:03 - Tom: nice`);
    expect(r.messages[2]).toMatchObject({ type: 'system', author: null });
    expect(r.messages[2]!.meta?.subject).toBe('Trip: Rome');
    expect(r.chatTitle).toBe('Trip: Rome');
    expect(r.isGroup).toBe(true);
  });

  it('parses Dutch group events', () => {
    const msgs = android([
      'Sarah heeft groep "Vrijdagborrel" aangemaakt',
      'Sarah heeft Tom en Lisa toegevoegd',
      'Tom is vertrokken',
      'Sarah heeft Lisa verwijderd',
      'Noor neemt deel via de uitnodigingslink van deze groep',
      'Lisa heeft de groepsnaam gewijzigd naar "Borrel 🍻"',
      'Lisa heeft de groepsafbeelding gewijzigd',
    ]);
    expect(msgs.map((m) => m.meta?.systemKind)).toEqual(['created', 'added', 'left', 'removed', 'joined', 'subject', 'icon']);
    expect(msgs[1]!.meta?.targets).toEqual(['Tom', 'Lisa']);
    expect(msgs[0]!.meta?.subject).toBe('Vrijdagborrel');
  });

  it('parses German, French and Spanish group events', () => {
    const msgs = android([
      'Lena hat Jonas hinzugefügt',
      'Jonas hat die Gruppe verlassen',
      'Lena hat das Gruppenbild geändert',
      'Camille a ajouté Hugo',
      'Hugo est parti',
      'Camille a retiré Hugo',
      'Ana añadió a Luis',
      'Luis salió del grupo',
      'Ana cambió el asunto de "A" a "B"',
    ]);
    expect(msgs.map((m) => m.meta?.systemKind)).toEqual(['added', 'left', 'icon', 'added', 'left', 'removed', 'added', 'left', 'subject']);
    expect(msgs[0]!.meta).toMatchObject({ actor: 'Lena', targets: ['Jonas'] });
    expect(msgs[6]!.meta).toMatchObject({ actor: 'Ana', targets: ['Luis'] });
  });

  it('parses Portuguese, Italian and Turkish group events', () => {
    const msgs = android([
      'João adicionou Maria',
      'Maria saiu',
      'Giulia ha aggiunto Marco',
      'Marco è uscito',
      'Giulia ha rimosso Marco',
      'Ayşe, Mehmet kişisini ekledi',
      'Mehmet ayrıldı',
    ]);
    expect(msgs.map((m) => m.meta?.systemKind)).toEqual(['added', 'left', 'added', 'left', 'removed', 'added', 'left']);
    expect(msgs[5]!.meta).toMatchObject({ actor: 'Ayşe', targets: ['Mehmet'] });
  });

  it('attributes iOS group system messages to the group and uses it as title', () => {
    const r = parseChat(`[14/03/2023, 09:00:00] Weekend Crew: ${LRM}Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
[14/03/2023, 09:00:00] Weekend Crew: ${LRM}Sarah created this group
[14/03/2023, 09:00:00] Weekend Crew: ${LRM}Sarah added you
[14/03/2023, 09:15:02] Sarah: Welcome all
[14/03/2023, 09:16:00] Tom: 🎉
[14/03/2023, 09:17:00] Lisa: yay`);
    expect(r.chatTitle).toBe('Weekend Crew');
    expect(r.participants).not.toContain('Weekend Crew');
    expect(r.isGroup).toBe(true);
    expect(r.messages[2]!.meta).toMatchObject({ systemKind: 'added', actor: 'Sarah', targets: ['You'] });
  });
});

describe('media placeholders', () => {
  it('detects the generic Android "<Media omitted>" in many languages', () => {
    const msgs = android([
      'Sarah: <Media omitted>',
      'Sarah: <Media weggelaten>',
      'Sarah: <Medien ausgeschlossen>',
      'Sarah: <Médias omis>',
      'Sarah: <Multimedia omitido>',
      'Sarah: <Mídia oculta>',
      'Sarah: <Media omessi>',
      'Sarah: <Medya dahil edilmedi>',
    ]);
    expect(msgs.every((m) => m.type === 'media' && m.text === '' && m.author === 'Sarah')).toBe(true);
  });

  it('detects typed iOS placeholders in English', () => {
    const msgs = ios([
      `${LRM}image omitted`,
      `${LRM}video omitted`,
      `${LRM}audio omitted`,
      `${LRM}sticker omitted`,
      `${LRM}GIF omitted`,
      `${LRM}document omitted`,
      `${LRM}Contact card omitted`,
      `${LRM}Report.pdf • ${LRM}3 pages ${LRM}document omitted`,
    ]);
    expect(msgs.map((m) => m.type)).toEqual(['image', 'video', 'audio', 'sticker', 'gif', 'document', 'contact', 'document']);
    expect(msgs[7]!.meta?.fileName).toBe('Report.pdf');
  });

  it('detects typed iOS placeholders in other languages', () => {
    const msgs = ios([
      `${LRM}afbeelding weggelaten`,
      `${LRM}Bild weggelassen`,
      `${LRM}image absente`,
      `${LRM}imagen omitida`,
      `${LRM}imagem ocultada`,
      `${LRM}immagine omessa`,
      `${LRM}görüntü dahil edilmedi`,
      `${LRM}audio weggelaten`,
      `${LRM}sticker weggelaten`,
      `${LRM}vídeo omitido`,
    ]);
    expect(msgs.map((m) => m.type)).toEqual(['image', 'image', 'image', 'image', 'image', 'image', 'image', 'audio', 'sticker', 'video']);
  });

  it('classifies iOS attachments from exports with media', () => {
    const msgs = ios([
      `${LRM}<attached: 00000012-PHOTO-2023-03-14-10-10-00.jpg>`,
      `${LRM}<attached: 00000013-AUDIO-2023-03-14-10-11-00.opus>`,
      `${LRM}<attached: 00000014-VIDEO-2023-03-14-10-12-00.mp4>`,
      `${LRM}<attached: 00000015-STICKER-2023-03-14-10-13-00.webp>`,
      `${LRM}<attached: 00000016-GIF-2023-03-14-10-14-00.mp4>`,
      `${LRM}<attached: 00000017-Tom.vcf>`,
      `${LRM}<attached: 00000018-Invoice.pdf>`,
    ]);
    expect(msgs.map((m) => m.type)).toEqual(['image', 'audio', 'video', 'sticker', 'gif', 'contact', 'document']);
    expect(msgs[0]!.meta?.fileName).toBe('00000012-PHOTO-2023-03-14-10-10-00.jpg');
  });

  it('classifies Android attachments and keeps captions', () => {
    const msgs = android([
      'Sarah: IMG-20230314-WA0001.jpg (file attached)\nSunset at the beach 🌅',
      'Sarah: PTT-20230314-WA0002.opus (file attached)',
      'Sarah: VID-20230314-WA0003.mp4 (bestand bijgevoegd)',
      'Sarah: STK-20230314-WA0004.webp (Datei angehängt)',
      'Sarah: Sarah.vcf (file attached)',
      'Sarah: Plan.docx (fichier joint)',
    ]);
    expect(msgs.map((m) => m.type)).toEqual(['image', 'audio', 'video', 'sticker', 'contact', 'document']);
    expect(msgs[0]!.text).toBe('Sunset at the beach 🌅');
    expect(msgs[0]!.emojis).toEqual(['🌅']);
  });

  it('treats Android "null" as view-once media', () => {
    const msgs = android(['Sarah: null']);
    expect(msgs[0]).toMatchObject({ type: 'media', author: 'Sarah' });
    expect(msgs[0]!.meta?.viewOnce).toBe(true);
  });
});

describe('deleted, edited, calls, polls, locations', () => {
  it('detects deleted messages in all languages', () => {
    const msgs = android([
      'Sarah: This message was deleted',
      'Sarah: You deleted this message',
      'Sarah: Dit bericht is verwijderd',
      'Sarah: Je hebt dit bericht verwijderd.',
      'Sarah: Diese Nachricht wurde gelöscht.',
      'Sarah: Ce message a été supprimé',
      'Sarah: Se eliminó este mensaje.',
      'Sarah: Mensagem apagada',
      'Sarah: Questo messaggio è stato eliminato',
      'Sarah: Bu mesaj silindi',
    ]);
    expect(msgs.every((m) => m.type === 'deleted' && m.text === '' && m.author === 'Sarah')).toBe(true);
  });

  it('detects and strips edited markers', () => {
    const msgs = android([
      'Sarah: See you at 8 <This message was edited>',
      'Sarah: Tot straks <Dit bericht is bewerkt>',
      'Sarah: Bis gleich <Diese Nachricht wurde bearbeitet>',
      'Sarah: À plus <Ce message a été modifié>',
      'Sarah: plain <html> tag stays',
    ]);
    expect(msgs.map((m) => m.edited)).toEqual([true, true, true, true, false]);
    expect(msgs[0]!.text).toBe('See you at 8');
    expect(msgs[4]!.text).toBe('plain <html> tag stays');
    const iosMsgs = ios([`Running late ${LRM}<This message was edited>`]);
    expect(iosMsgs[0]).toMatchObject({ text: 'Running late', edited: true });
  });

  it('detects missed and regular calls', () => {
    const msgs = ios([
      `${LRM}Missed voice call`,
      `${LRM}Missed video call, ${LRM}Tap to call back`,
      `${LRM}Voice call, ${LRM}12 min`,
      `${LRM}Gemiste spraakoproep`,
      `${LRM}Video-oproep`,
      `${LRM}Verpasster Sprachanruf`,
    ]);
    expect(msgs.map((m) => m.type)).toEqual(['call', 'call', 'call', 'call', 'call', 'call']);
    expect(msgs.map((m) => m.meta?.missed)).toEqual([true, true, false, true, false, true]);
    expect(msgs[1]!.meta?.video).toBe(true);
    expect(msgs[2]!.meta?.durationSec).toBe(720);
    // Normal sentences mentioning calls stay text
    const text = ios(['video call tonight after dinner?']);
    expect(text[0]!.type).toBe('text');
  });

  it('parses polls from iOS and Android', () => {
    const msgs = ios([`${LRM}POLL:\n${LRM}Where shall we eat?\n${LRM}OPTION: Pizza (2 votes)\n${LRM}OPTION: Sushi (1 vote)`]);
    expect(msgs[0]).toMatchObject({ type: 'poll', text: 'Where shall we eat?' });
    expect(msgs[0]!.meta?.pollOptions).toEqual([
      { label: 'Pizza', votes: 2 },
      { label: 'Sushi', votes: 1 },
    ]);
    const nl = android(['Sarah: PEILING:\nWaar gaan we eten?\nOPTIE: Pizza (3 stemmen)\nOPTIE: Sushi (0 stemmen)']);
    expect(nl[0]!.type).toBe('poll');
    expect(nl[0]!.meta?.pollOptions?.[0]).toEqual({ label: 'Pizza', votes: 3 });
  });

  it('detects shared and live locations', () => {
    const msgs = android([
      'Sarah: location: https://maps.google.com/?q=52.370216,4.895168',
      'Sarah: Locatie: https://maps.google.com/?q=52.3,4.9',
      'Sarah: https://maps.app.goo.gl/abc123',
      'Sarah: live location shared',
    ]);
    expect(msgs.map((m) => m.type)).toEqual(['location', 'location', 'location', 'location']);
    expect(msgs[3]!.meta?.liveLocation).toBe(true);
    expect(msgs[0]!.links).toEqual([]);
  });

  it('treats "Waiting for this message" as a system notice', () => {
    const msgs = ios([`${LRM}Waiting for this message. This may take a while.`]);
    expect(msgs[0]!.type).toBe('system');
    expect(msgs[0]!.meta?.systemKind).toBe('pending');
  });
});
