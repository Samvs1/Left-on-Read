import { useT, type TKey, type TParams } from '../../i18n';
import { Icon, type IconName } from '../components/Icon';
import { Footer } from '../components/Footer';
import { href } from '../router';
import { DEFAULT_SETTINGS } from '../../engine/settings';
import { fmtDuration } from '../format';

function Page({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <a href={href.home()} className="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <Icon name="arrowLeft" size={16} />
          Left on Read
        </a>
        <h1 className="text-[3rem] font-[800] leading-[0.95] sm:text-[4rem]">{title}</h1>
        <p className="mt-5 text-xl leading-relaxed text-ink-2">{lead}</p>
        <div className="mt-10 space-y-4">{children}</div>
      </main>
      <Footer />
    </>
  );
}

function Item({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <section className="card flex gap-4 p-5 sm:p-6">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1.5 leading-relaxed text-ink-2">{children}</p>
      </div>
    </section>
  );
}

export function PrivacyPage() {
  const t = useT();
  const items: [IconName, TKey, TKey][] = [
    ['monitor', 'privacy.p1t', 'privacy.p1'],
    ['shield', 'privacy.p2t', 'privacy.p2'],
    ['eyeOff', 'privacy.p3t', 'privacy.p3'],
    ['lock', 'privacy.p4t', 'privacy.p4'],
    ['plane', 'privacy.p5t', 'privacy.p5'],
    ['info', 'privacy.p6t', 'privacy.p6'],
  ];
  return (
    <Page title={t('privacy.title')} lead={t('privacy.lead')}>
      {items.map(([icon, title, body]) => (
        <Item key={title} icon={icon} title={t(title)}>
          {t(body)}
        </Item>
      ))}
    </Page>
  );
}

export function HowItWorksPage() {
  const t = useT();
  const p: TParams = {
    gap: fmtDuration(DEFAULT_SETTINGS.conversationGapMinutes * 60_000),
    ghost: fmtDuration(DEFAULT_SETTINGS.ghostingThresholdMinutes * 60_000),
    double: fmtDuration(DEFAULT_SETTINGS.doubleTextMinutes * 60_000),
    revive: fmtDuration(DEFAULT_SETTINGS.reviveThresholdHours * 3_600_000),
  };
  const defs: [IconName, TKey, TKey][] = [
    ['message', 'how.conversation', 'how.conversationBody'],
    ['users', 'how.turn', 'how.turnBody'],
    ['clock', 'how.response', 'how.responseBody'],
    ['eyeOff', 'how.ghost', 'how.ghostBody'],
    ['zap', 'how.double', 'how.doubleBody'],
    ['refresh', 'how.revive', 'how.reviveBody'],
    ['compare', 'how.effort', 'how.effortBody'],
    ['sparkles', 'how.signature', 'how.signatureBody'],
    ['book', 'how.catch', 'how.catchBody'],
    ['smile', 'how.comedian', 'how.comedianBody'],
    ['layers', 'how.eras', 'how.erasBody'],
    ['heart', 'how.sentiment', 'how.sentimentBody'],
    ['book', 'how.richness', 'how.richnessBody'],
    ['globe', 'how.time', 'how.timeBody'],
    ['trophy', 'how.awards', 'how.awardsBody'],
    ['info', 'how.limits', 'how.limitsBody'],
  ];
  return (
    <Page title={t('how.title')} lead={t('how.lead')}>
      <Item icon="file" title={t('how.parsing')}>
        {t('how.parsingBody')}
      </Item>
      <h2 className="pt-6 text-2xl font-bold">{t('how.defs')}</h2>
      {defs.map(([icon, title, body]) => (
        <Item key={title} icon={icon} title={t(title)}>
          {t(body, p)}
        </Item>
      ))}
    </Page>
  );
}
