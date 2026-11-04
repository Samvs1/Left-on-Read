import { useT } from '../../i18n';
import { href } from '../router';
import { LogoMark } from './Logo';

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <LogoMark size={36} />
          <div>
            <p className="font-display text-lg font-bold leading-none">{t('app.name')}</p>
            <p className="mt-1 text-sm text-muted">{t('app.tagline')}</p>
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <a className="hover:text-brand" href={href.home()}>
            {t('nav.home')}
          </a>
          <a className="hover:text-brand" href={href.how()}>
            {t('nav.how')}
          </a>
          <a className="hover:text-brand" href={href.privacy()}>
            {t('nav.privacy')}
          </a>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted sm:px-6">{t('app.worksWith')}</p>
    </footer>
  );
}
