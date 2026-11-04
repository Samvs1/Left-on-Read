import { setLang, useLang, useT } from '../../i18n';
import { setTheme, useThemePref } from '../theme';
import { go, href, useRoute } from '../router';
import { setAnonymize, setState, useStore } from '../store';
import { Icon } from './Icon';
import { Logo } from './Logo';

export function TopBar({ transparent = false }: { transparent?: boolean }) {
  const t = useT();
  const lang = useLang();
  const pref = useThemePref();
  const route = useRoute();
  const chat = useStore((s) => s.chat);
  const anon = useStore((s) => s.anonymize);
  const computing = useStore((s) => s.chat?.computing ?? false);
  const nextTheme = pref === 'system' ? 'dark' : pref === 'dark' ? 'light' : 'system';
  const themeIcon = pref === 'system' ? 'monitor' : pref === 'dark' ? 'moon' : 'sun';
  const inApp = route.page === 'home' && route.view !== 'home';
  return (
    <header className={`sticky top-0 z-40 ${transparent ? '' : 'glass border-x-0 border-t-0'}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-1 px-3 sm:gap-2 sm:px-6">
        <a href={href.home()} onClick={(e) => { if (route.page === 'home') { e.preventDefault(); go('home'); } }} className="rounded-xl" aria-label={`${t('app.name')} – ${t('nav.home')}`}>
          <Logo compact />
        </a>
        <nav className="flex items-center sm:gap-1" aria-label={t('nav.menu')}>
          {chat && route.page === 'home' && (
            <div className="mr-1 hidden items-center gap-1 sm:flex">
              <button type="button" className={`btn btn-sm ${route.view === 'dashboard' ? 'bg-surface-2' : ''}`} onClick={() => go('dashboard')}>
                {t('nav.dashboard')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => go('story')}>
                {t('nav.story')}
              </button>
            </div>
          )}
          {computing && inApp && (
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted" role="status">
              <span className="h-3.5 w-3.5 animate-[spin_0.9s_linear_infinite] rounded-full border-2 border-brand border-t-transparent" aria-hidden="true" />
              <span className="hidden sm:inline">{t('common.computing')}</span>
            </span>
          )}
          {chat && (
            <button type="button" className="icon-btn" onClick={() => setState({ settingsOpen: true })} aria-label={t('nav.settings')} title={t('nav.settings')}>
              <Icon name="sliders" />
            </button>
          )}
          <button
            type="button"
            className={`icon-btn ${anon ? 'bg-brand-soft text-brand' : ''}`}
            onClick={() => setAnonymize(!anon)}
            aria-pressed={anon}
            aria-label={t('common.anonymous')}
            title={`${t('common.anonymous')}: ${anon ? t('common.on') : t('common.off')}`}
          >
            <Icon name="mask" />
          </button>
          <button type="button" className="icon-btn" onClick={() => setTheme(nextTheme)} aria-label={`${t('common.theme')}: ${t(`common.${pref === 'system' ? 'system' : pref}`)}`} title={t('common.theme')}>
            <Icon name={themeIcon} />
          </button>
          <button
            type="button"
            className="icon-btn text-[0.8rem] font-bold tracking-wide"
            onClick={() => setLang(lang === 'en' ? 'nl' : 'en')}
            aria-label={`${t('common.language')}: ${lang === 'en' ? 'English' : 'Nederlands'}`}
            title={lang === 'en' ? 'Nederlands' : 'English'}
            lang={lang === 'en' ? 'nl' : 'en'}
          >
            {lang === 'en' ? 'NL' : 'EN'}
          </button>
        </nav>
      </div>
    </header>
  );
}
