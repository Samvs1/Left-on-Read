/**
 * A deliberately small, hand-written sentiment lexicon for English and Dutch
 * chat language, plus emoji. Scores range from -3 to +3. This is a playful,
 * rough estimate, not a research-grade classifier.
 */
const WORDS: Record<string, string> = {
  // ---------------- English ----------------
  '3': `love loved loving lovely amazing awesome fantastic wonderful excellent perfect brilliant incredible outstanding superb
        best beautiful gorgeous adore adorable ecstatic thrilled delighted magnificent marvelous marvellous stunning phenomenal
        blessed overjoyed iloveyou`,
  '2': `great good happy glad nice cute fun funny enjoy enjoyed enjoying excited exciting cool sweet proud yay congrats
        congratulations thanks thank thankful grateful appreciate appreciated hope hopeful lucky win won winning success
        successful pretty smart kind generous fabulous yummy delicious tasty dope fab cheers bravo hooray epic legendary
        favourite favorite fave beautifully happily glorious joy joyful wholesome hilarious laughing celebrate celebrating
        relieved impressive impressed fantastico`,
  '1': `fine alright better interesting calm relaxed chill helpful easy positive agree smile smiling hug hugs kiss kisses
        xoxo peace warm sunny comfy cozy cosy safe okayish decent lovelyy recommend worth wow ready fair`,
  '-1': `tired bored boring meh annoying weird busy late cold confused worry worried nervous stress stressed problem problems
        issue difficult hard ugh oops mistake wrong unfortunately sadly tough sick ill exhausted sleepy hungover awkward lame
        complicated doubt unsure`,
  '-2': `sad bad upset angry mad hurt hurts pain painful cry crying cried scared afraid fear disappointed disappointing
        depressed depressing lonely broke broken lost lose losing fail failed failure ugly stupid dumb idiot sucks suck worse
        ruined jealous anxious anxiety unhappy frustrated frustrating annoyed hopeless useless cringe gross pathetic rude
        fml sadness`,
  '-3': `hate hated hating terrible horrible awful worst disgusting disaster nightmare miserable devastated heartbroken
        furious tragic hateful`,
  // ---------------- Dutch ----------------
  'nl3': `geweldig geweldige fantastisch fantastische prachtig prachtige perfect perfecte heerlijk heerlijke schitterend
        fenomenaal briljant liefde verliefd liefste fantastich supergaaf superleuk dolblij`,
  'nl2': `goed goede leuk leuke blij blije fijn fijne mooi mooie lief lieve super top gaaf gave vet vette tof toffe knap
        lekker lekkere gelukkig trots dankbaar bedankt dankjewel dankje dankuwel gefeliciteerd proficiat jippie hoera
        joepie gezellig gezellige grappig grappige hilarisch genieten genoten geniet succes gewonnen winnen knus mooiste
        leukste schattig schattige blijdschap heerlijks`,
  'nl1': `oké oke prima redelijk rustig beter interessant handig makkelijk akkoord kus kusje kusjes knuffel knuffels warm
        zonnig veilig lachen glimlach relaxt chill benieuwd aanrader`,
  'nl-1': `moe saai jammer helaas raar druk ziek koud verward zorgen nerveus probleem problemen lastig moeilijk balen
        pff oeps fout gestrest onhandig vermoeiend twijfel`,
  'nl-2': `verdrietig slecht slechte boos kwaad pijn huilen huil gehuild bang angst teleurgesteld depressief eenzaam kapot
        verloren verliezen mislukt lelijk dom stom stomme idioot vervelend vervelende irritant irritante gefrustreerd
        chagrijnig ellendig rot zielig klote kut kutweer`,
  'nl-3': `haat haten verschrikkelijk vreselijk vreselijke afschuwelijk walgelijk ramp rampzalig hartzeer woedend
        tragisch`,
};

const EMOJIS: Record<string, string> = {
  '3': '😍 🥰 😘 ❤ 💕 💖 💗 💓 💞 💘 💝 🤩 🥳 😻 ❤‍🔥',
  '2': '😊 😁 😄 😃 ☺ 😀 😂 🤣 😆 😹 😚 😙 😗 💛 💚 💙 💜 🧡 🤍 🤎 🩷 🩵 ❣ 👍 👏 🙌 🎉 🎊 ✨ 🌟 ⭐ 💪 😎 🤗 🥂 🍾 🌈 😇 💐 🌹 💯 😋 🫶',
  '1': '🙂 😉 😌 😅 🙏 👌 ✌ 🔥 🤝 ☀ 🤭 😜 😝 😛 🤪',
  '-1': '😕 😑 🙄 😒 😬 😓 😥 😟 😪 🥺 😱 😭 🫠 😮‍💨',
  '-2': '😢 😞 😔 ☹ 🙁 😣 😖 😫 😩 😨 😰 💔 👎 😤 😠 🤢 🤮 🤒 🤕',
  '-3': '😡 🤬',
};

export const SENTIMENT_WORDS: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const [k, list] of Object.entries(WORDS)) {
    const score = Number(k.replace('nl', ''));
    for (const w of list.split(/\s+/)) if (w) m.set(w, score);
  }
  return m;
})();

/** Keyed by emoji key (no skin tones / variation selectors). */
export const SENTIMENT_EMOJIS: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (const [k, list] of Object.entries(EMOJIS)) {
    for (const e of list.split(/\s+/)) if (e) m.set(e.replace(/[︎️]/g, ''), Number(k));
  }
  return m;
})();

export const NEGATORS: ReadonlySet<string> = new Set(
  `not no never dont don't doesnt doesn't didnt didn't isnt isn't wasnt wasn't arent aren't cant can't wont won't nothing
   nobody without hardly niet geen nooit niks niets nimmer`.split(/\s+/),
);

export const INTENSIFIERS: ReadonlySet<string> = new Set(
  `very really so super extremely totally absolutely incredibly soo sooo heel erg echt zo mega enorm hartstikke ontzettend
   zó vet kei bere giga intens`.split(/\s+/),
);

/** VADER-style squash of a raw score into (-1, 1). */
export function squash(raw: number): number {
  return raw / Math.sqrt(raw * raw + 15);
}
