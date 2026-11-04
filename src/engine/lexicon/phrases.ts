/**
 * Phrase lists (EN + NL, a little DE/FR/ES) for greetings, goodbyes, apologies,
 * declarations of love, swearing and laughter.
 */

export const GREETINGS = `hi hey heyy heyyy hello helloo hallo hoi hoii hee heey heej hej yo hiya howdy sup wassup morning
goodmorning gm moin moinsen servus hola bonjour salut ciao olá ola oi "good morning" "goede morgen" goedemorgen "goedemiddag"
goedenavond "good evening" "good afternoon" "hey hey" "hoi hoi" "guten morgen" "buenos dias" "buenos días"`;

export const GOODBYES = `bye byee byeee doei doeii doeg dag later laters cya ttyl ciao adios adiós tschüss tschüs ciaoo
"see you" "see ya" "see u" "bye bye" "tot ziens" "tot later" "tot straks" "tot morgen" "tot zo" "talk later" "take care"
"take care" "speak soon" "à plus" "hasta luego" "bis später" "bis dann"`;

export const GOODNIGHTS = `night nite nighty gn goodnight nn welterusten trusten truste slaaplekker "good night" "night night"
"sleep well" "sweet dreams" "slaap lekker" "slaap ze" "lekker slapen" "welterusten schat" "gute nacht" "bonne nuit"
"buenas noches" "boa noite" "buonanotte" "iyi geceler"`;

export const APOLOGIES = `sorry sorryy sorryyy sry soz srry apologies apologize apologise sorrie excuus excuses pardon
"my bad" "my fault" "mijn fout" "mijn schuld" "het spijt me" "spijt me" "vergeef me" "forgive me" "es tut mir leid"
"entschuldigung" "désolé" "desolé" "perdón" "lo siento" "desculpa" "scusa" "özür dilerim"`;

export const LOVE_YOUS = `ily ilysm ilu hvj ilyy "i love you" "love you" "love u" "luv u" "luv you" "love ya" "luv ya"
"i love u" "hou van je" "hou van jou" "ik hou van je" "ik hou van jou" "love je" "ich liebe dich" "hab dich lieb"
"je t'aime" "te quiero" "te amo" "ti amo" "seni seviyorum"`;

export const SWEARS_EN = `fuck fucking fucked fucker fuckers motherfucker motherfucking fck fuk fking fkn shit shitty bullshit
shits damn dammit goddamn goddammit bitch bitches bitchy ass asshole assholes arse arsehole bastard crap crappy dick dicks
dickhead piss pissed cunt cunts wtf stfu omfg ffs bloody bollocks wanker twat prick douche douchebag jackass screw`;

export const SWEARS_NL = `kut kutje godverdomme godver verdomme verdorie gvd tering teringlijer tyfus klote kak kakken lul
eikel klootzak hoer sukkel mongool kolere pleuris pokke takke kanker kankerlijer potverdorie jezus fucking shit tyfuslijer
kloten`;

/** Dutch swear words are glued onto other words ("kutweer", "kankerhond"). */
export const SWEAR_PREFIXES_NL = ['kut', 'kanker', 'tering', 'tyfus', 'klote', 'pleuris', 'kolere', 'godver'];

/** Splits a phrase list: bare words and "quoted multi word phrases". */
export function phraseList(src: string): string[][] {
  const out: string[][] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const p = (m[1] ?? m[2] ?? '').toLowerCase().trim();
    if (p) out.push(p.split(/\s+/));
  }
  return out;
}

/* ------------------------------ Laughter ------------------------------ */

const LAUGH_RES: [RegExp, string][] = [
  [/^a?(?:h+a+){2,}h*$/u, 'haha'],
  [/^(?:a+h+){2,}a*$/u, 'haha'],
  [/^(?:h+i+){2,}h*$/u, 'hihi'],
  [/^(?:h+e+){2,}h*$/u, 'hehe'],
  [/^(?:h+[aeiou]+){2,}h*$/u, 'haha'],
  [/^l+o+l+(?:z|s)?$/u, 'lol'],
  [/^l+m+f*a+o+$/u, 'lmao'],
  [/^ro+fl+$/u, 'rofl'],
  [/^x+d+$/u, 'xd'],
  [/^(?:j+a+){2,}j*$/u, 'jaja'],
  [/^k{4,}$/u, 'kkk'],
  [/^(?:mdr+|ptdr+)$/u, 'mdr'],
  [/^(?:hhh+|wkwk+)$/u, 'other'],
];

/** Returns the laugh kind of a lowercase token, or null. */
export function laughKind(token: string): string | null {
  const c = token.charCodeAt(0);
  // h, a, l, r, x, j, k, m, p, w
  if (c !== 104 && c !== 97 && c !== 108 && c !== 114 && c !== 120 && c !== 106 && c !== 107 && c !== 109 && c !== 112 && c !== 119) return null;
  if (token.length < 2) return null;
  for (const [re, kind] of LAUGH_RES) if (re.test(token)) return kind;
  return null;
}

/** Emoji keys (no variation selectors) that count as laughter. */
export const LAUGH_EMOJIS: ReadonlySet<string> = new Set(['😂', '🤣', '💀', '😹', '😆', '😅', '☠']);

/** Heart emoji keys → colour bucket. */
export const HEARTS: ReadonlyMap<string, string> = new Map([
  ['❤', 'red'], ['♥', 'red'], ['🧡', 'orange'], ['💛', 'yellow'], ['💚', 'green'], ['💙', 'blue'], ['💜', 'purple'],
  ['🖤', 'black'], ['🤍', 'white'], ['🤎', 'brown'], ['🩷', 'pink'], ['🩵', 'lightblue'], ['🩶', 'grey'],
  ['❤‍🔥', 'fire'], ['❤‍🩹', 'mending'], ['💔', 'broken'], ['💕', 'sparkle'], ['💞', 'sparkle'], ['💓', 'sparkle'],
  ['💗', 'sparkle'], ['💖', 'sparkle'], ['💘', 'sparkle'], ['💝', 'sparkle'], ['❣', 'sparkle'],
]);
