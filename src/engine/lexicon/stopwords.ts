/**
 * Stopwords for word statistics. English and Dutch are thorough; the other
 * supported export languages get the most common function words. Chat filler
 * ("ok", "yeah", "ja") is included because it drowns out everything else.
 */
const EN = `a about above after again against all almost also am an and any are aren't as at be because been before being below
between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each else even ever every
few for from further get gets got had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him
himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself just let's like me more most much must mustn't my
myself no nor not now of off on once only or other ought our ours ourselves out over own really same shan't she she'd she'll
she's should shouldn't so some still such than that that's the their theirs them themselves then there there's these they
they'd they'll they're they've this those through to too under until up upon us very was wasn't we we'd we'll we're we've were
weren't what what's when when's where where's which while who who's whom why why's will with won't would wouldn't you you'd
you'll you're you've your yours yourself yourselves im ive id ill youre dont didnt doesnt isnt wasnt cant wont thats whats
its gonna wanna gotta u ur r ya yeah yea yep yup yes no nope nah ok okay okey k kk oh ah eh uh um hmm hm mm mhm also though
one two get going go went come came know think thing things want see well back way said say says make made take lot lots
bit gonna got getting would could should might maybe probably sure actually anyway already right good just like`;

const NL = `de het een en van ik je jij u hij zij ze we wij jullie mij me mijn mn m'n jouw jou je jouw zijn haar hun ons onze uw
is ben bent was waren wordt worden werd geweest hebben heb hebt heeft had hadden zal zou zullen kunnen kan kun kon moet moeten
mag mogen wil wilt willen gaat ga gaan ging doen doe doet deed dat die dit deze daar hier er wat wie waar waarom hoe wanneer
welke niet geen wel ook nog al maar want dus of als dan toch nou even eens zo te tot met voor op in uit aan bij naar om over
door onder tegen tussen na sinds zonder binnen buiten boven achter heel erg echt gewoon misschien eigenlijk best beetje
allemaal alles iets niets niks iemand niemand altijd nooit vaak soms nu straks later vandaag morgen gisteren ja nee jaa
neee oke oké ok okay oki goed hoor he hè hé hey joh nouja ofzo enzo ofso zeg weet denk denken vind vindt ga gaat komt kom
komen zien zie ziet kijk keer even lekker toch nog wel weer meer veel minder ander andere zelf zelfs hem ze z'n zn d'r dr
t 't 's ik'm da wa ff effe efkes mn jij jou wel gwn idd iig iets echt man`;

const DE = `der die das und ich du er sie es wir ihr ein eine einen einem nicht ist bin bist sind war hat habe hast haben mit
auf in im zu zum zur von den dem des auch noch aber wie was wer wo so dann wenn ja nein doch mal schon nur sehr gut ok also
mich dich mir dir sich uns euch mein dein kann kannst können muss musst will willst wird werden oder als bei nach für aus`;

const FR = `le la les un une des de du et je tu il elle on nous vous ils elles ne pas est suis es sont était a ai as avons
avez ont que qui quoi dans pour sur avec ce cette ces mon ma mes ton ta tes son sa ses au aux mais ou donc oui non bien
très tout tous fait faire va vais comme plus moi toi lui leur y en se si c'est j'ai ça ok`;

const ES = `el la los las un una unos unas de del y o que en a es son está estoy estás era fue ser yo tu tú él ella nosotros
ellos me te se mi mis su sus lo le les con por para como pero más muy ya no sí si al este esta eso esto hay tiene tengo
bien ok vale pues todo nada`;

const PT = `o a os as um uma de do da dos das e é em no na nos nas que eu tu você ele ela nós eles elas me te se meu minha
seu sua com por para como mas mais muito já não sim isso isto está estou foi ser ter tem tenho vai vou ok tá né`;

const IT = `il lo la i gli le un uno una di del della dei e è in che per con su non sì si mi ti ci vi io tu lui lei noi voi
loro ma come più anche già sono sei siamo era ho hai ha abbiamo questo questa quello va bene ok poi tutto niente`;

const TR = `ve bir bu da de ne ben sen o biz siz onlar mi mı mu mü için ile ama çok daha gibi var yok evet hayır şey ki
olarak olan oldu değil mı ya tamam şu her en kadar sonra önce`;

function toSet(...lists: string[]): Set<string> {
  const s = new Set<string>();
  for (const l of lists) for (const w of l.split(/\s+/)) if (w) s.add(w.replace(/’/g, "'"));
  return s;
}

export const STOPWORDS: ReadonlySet<string> = toSet(EN, NL, DE, FR, ES, PT, IT, TR);
