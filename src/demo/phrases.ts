/**
 * Phrase banks for the demo chat generator (English + Dutch).
 * Everything here is invented; no real conversations.
 */
export type Lang = 'en' | 'nl';
export type Bank = Record<Lang, string[]>;

export const MORNING: Bank = {
  en: ['good morning!', 'morning ☀️', 'morning sunshine', 'rise and shine', 'goood morning', 'morning! slept well?', 'coffee. now. ☕'],
  nl: ['goedemorgen!', 'goeiemorgen ☀️', 'morgen!', 'goedemorgen, goed geslapen?', 'eerst koffie ☕', 'hoi! wakker?'],
};

export const GREETING: Bank = {
  en: ['hey', 'heyy', 'hi!', 'yo', 'hey hey', 'hello you', 'hiii'],
  nl: ['hoi', 'hey!', 'hallo', 'hoii', 'hee', 'hoi hoi'],
};

export const QUESTIONS: Bank = {
  en: [
    'how was your day?', 'what are you up to?', 'did you see that?', 'pizza tonight?', 'are you coming saturday?', "how's work?",
    'wanna call later?', 'which movie should we watch?', 'did you sleep well?', 'where are you?', 'have you eaten yet?',
    'what time is it there?', 'can you send me that recipe?', 'should we book the tickets?', 'are you still awake?',
    'did you hear about the new place on the corner?', 'what do you want for your birthday?', 'is it raining there too?',
  ],
  nl: [
    'hoe was je dag?', 'wat ben je aan het doen?', 'heb je dat gezien?', 'zin in pizza vanavond?', 'kom je zaterdag?',
    'hoe gaat het op werk?', 'zullen we zo even bellen?', 'welke film gaan we kijken?', 'goed geslapen?', 'waar ben je?',
    'heb je al gegeten?', 'kun je dat recept sturen?', 'zullen we de kaartjes boeken?', 'ben je nog wakker?',
    'regent het bij jou ook zo?', 'wat wil je voor je verjaardag?', 'heb je zin om te wandelen?',
  ],
};

export const ANSWERS: Bank = {
  en: [
    'pretty good actually', 'busy busy', 'nothing much, you?', 'yes!!', 'maybe, depends on work', 'sure', 'not really 😅',
    'absolutely', 'just got home', 'still at work ugh', "yes let's do it", 'sounds perfect', "I'm in", 'can we do 8 instead?',
    'on my way', 'five more minutes', 'already booked them', 'no idea honestly',
  ],
  nl: [
    'best goed eigenlijk', 'druk druk druk', 'niks bijzonders, jij?', 'ja graag!', 'misschien, hangt van werk af', 'tuurlijk',
    'niet echt 😅', 'zeker weten', 'net thuis', 'nog op werk', 'ja leuk!', 'klinkt perfect', 'ik ben erbij', 'kan het om 8 uur?',
    'ben onderweg', 'nog vijf minuutjes', 'al geboekt', 'geen idee eerlijk gezegd',
  ],
};

export const STATEMENTS: Bank = {
  en: [
    'just finished work, so tired', 'the cat knocked over my plant again', "I'm making pasta tonight", 'this song is stuck in my head',
    "can't believe it's already friday", 'the train is late again', 'gym was brutal today', 'I need a holiday',
    'watching the new season tonight', 'Moos is sleeping on my laptop again', "it's raining sooo hard", 'the meeting could have been an email',
    'I bought too many plants', 'we should go to the beach this weekend', 'I miss summer', 'made pancakes this morning',
    'my neighbour is drilling again', 'finally finished that book', 'the new coffee place is amazing', 'I think I am getting a cold',
    'the sunset was so beautiful today', 'my mum says hi', 'I just ate an entire bag of crisps', 'the bike tyre is flat again',
    'work was actually fun today', 'that concert was incredible', 'I can not wait for the weekend', 'I found the best pizza place',
  ],
  nl: [
    'net klaar met werk, zo moe', "Moos heeft weer m'n plant omgegooid", 'ik maak pasta vanavond', "dat liedje zit vast in m'n hoofd",
    'kan niet geloven dat het al vrijdag is', 'de trein heeft weer vertraging', 'sportschool was zwaar vandaag', 'ik ben echt toe aan vakantie',
    'vanavond nieuwe seizoen kijken', 'het regent zo hard', 'die meeting had een mail kunnen zijn', 'we moeten dit weekend naar het strand',
    'ik mis de zomer', 'vanochtend pannenkoeken gemaakt', 'de buurman is weer aan het boren', 'eindelijk dat boek uit',
    'die nieuwe koffietent is echt heerlijk', 'ik denk dat ik verkouden word', 'de zonsondergang was zo mooi vandaag',
    'mijn moeder zegt hoi', "m'n fietsband is weer lek", 'werk was eigenlijk leuk vandaag', 'dat concert was geweldig',
    'ik heb de beste pizzeria gevonden', 'zo gezellig gisteren',
  ],
};

export const REACTIONS: Bank = {
  en: ['omg', 'no way', 'wow', 'nice!', 'same', 'true', 'for real', 'oh no', 'wait what', 'love that', 'yesss', 'ugh', 'amazing', 'so cute', 'fair enough'],
  nl: ['echt?!', 'lekker!', 'klopt', 'jeetje', 'oh nee', 'wacht wat', 'fijn!', 'mooi zo', 'top', 'gezellig!', 'nee joh', 'zo leuk', 'echt waar?', 'jaaa'],
};

export const LOVE: Bank = {
  en: ['love you ❤️', 'miss you', "you're the best", 'love you too', 'miss you already 🥺', 'xx'],
  nl: ['hou van je', 'mis je', 'je bent de beste', 'hou van jou ❤️', 'dikke kus 😘', 'xx'],
};

export const APOLOGIES: Bank = {
  en: ['sorry!', 'sorry, fell asleep', 'sorry was busy', 'my bad', 'sorry sorry', 'oops sorry, totally forgot to reply 🙈'],
  nl: ['sorry!', 'sorry, was even druk', 'sorry, in slaap gevallen', 'mijn fout', 'sorry sorry', 'oeps sorry, vergeten te reageren 🙈'],
};

export const GOODNIGHT: Bank = {
  en: ['goodnight 😴', 'night!', 'sleep well x', 'nn', 'night night', 'sweet dreams'],
  nl: ['welterusten', 'slaap lekker', 'trusten 💤', 'welterusten 😴', 'slaap lekker x'],
};

export const PLANS: Bank = {
  en: ['shall we get dinner thursday?', 'movie night?', "let's go to the market on saturday", 'drinks after work?', 'beach day sunday?', 'cinema tonight?'],
  nl: ['zullen we donderdag uit eten?', 'filmavond?', 'zaterdag naar de markt?', 'borrel na werk?', 'zondag naar het strand?', 'vanavond bioscoop?'],
};

export const JOKES: Bank = {
  en: [
    "I'm not saying I'm Batman, but nobody has seen me and Batman in the same room",
    "my plant died again, I'm officially a serial plant killer",
    'Moos just looked at me like I owe him money',
    'I put my phone in the fridge and the milk in my bag. great start',
    'my sourdough starter has more social life than me',
    'I tried to be productive today but my bed said no',
    'autocorrect changed "on my way" to "on my whale" 🐋',
  ],
  nl: [
    "ik ben zo moe dat ik koffie in m'n thee deed",
    'Moos kijkt me aan alsof ik hem geld schuldig ben',
    'mijn zuurdesem heeft een beter sociaal leven dan ik',
    'ik wilde productief zijn maar mijn bed zei nee',
    'mijn plantje is weer dood, ik ben een seriemoordenaar',
  ],
};

export const SAD: Bank = {
  en: ['ugh what a terrible day', 'I feel so tired and stressed', 'missed the train, worst morning ever', 'feeling a bit sad today', 'this week is awful'],
  nl: ['wat een rotdag', 'ik ben zo moe en gestrest', 'trein gemist, slechtste ochtend ooit', 'beetje verdrietig vandaag', 'deze week is vreselijk'],
};

export const EVENT_LINES: Bank = {
  en: [
    'TICKETS ARE LIVE', 'the queue says 45 minutes', 'I am number 18432 in the queue', 'refreshing like crazy', 'the site crashed again',
    'GOT THEM!!!', 'wait which day are we going', 'both days?', 'I am shaking', 'this festival is going to be amazing', 'what are we wearing',
    'need to book the train too', 'camping or hotel?', 'hotel obviously', 'I am so excited', 'can not sleep now',
  ],
  nl: [
    'DE KAARTJES ZIJN LIVE', 'de wachtrij zegt 45 minuten', 'ik sta 18432e in de rij', 'aan het refreshen als een gek', 'de site ligt er weer uit',
    'BINNEN!!!', 'welke dag gaan we nou', 'allebei de dagen?', 'ik tril helemaal', 'dit festival wordt geweldig', 'wat trekken we aan',
    'moeten ook de trein boeken', 'kamperen of hotel?', 'hotel natuurlijk', 'ik heb er zo veel zin in', 'kan nu echt niet slapen',
  ],
};

export const LINKS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
  'https://www.instagram.com/p/Cq1x2y3z4/',
  'https://nos.nl/artikel/2470000-het-wordt-warm',
  'https://www.youtube.com/watch?v=9bZkp7q19f0',
  'https://www.bol.com/nl/nl/p/cat-tree/930000',
  'https://maps.app.goo.gl/x8JfKcA1',
  'https://www.tiktok.com/@cats/video/7200000000',
  'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',
];
