import { lazy, Suspense, useEffect } from 'react';
import { useT } from '../i18n';
import { TopBar } from './components/TopBar';
import { PasteDialog } from './components/PasteDialog';
import { Landing } from './pages/Landing';
import { LoadingScreen } from './pages/LoadingScreen';
import { HowItWorksPage, PrivacyPage } from './pages/InfoPages';
import { go, useRoute } from './router';
import { useStore } from './store';

const StoryPage = lazy(() => import('./pages/StoryPage').then((m) => ({ default: m.StoryPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const PersonPage = lazy(() => import('./pages/PersonPage').then((m) => ({ default: m.PersonPage })));
const ComparePage = lazy(() => import('./pages/ComparePage').then((m) => ({ default: m.ComparePage })));
const SettingsDrawer = lazy(() => import('./components/SettingsDrawer').then((m) => ({ default: m.SettingsDrawer })));

function SkipLink() {
  const t = useT();
  return (
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
      {t('nav.skipToContent')}
    </a>
  );
}

function PageFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="skeleton h-12 w-2/3 rounded-2xl" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="skeleton h-32 rounded-3xl" />
        <div className="skeleton h-32 rounded-3xl" />
        <div className="skeleton h-32 rounded-3xl" />
      </div>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const chat = useStore((s) => s.chat);
  const loading = useStore((s) => s.loading);
  const settingsOpen = useStore((s) => s.settingsOpen);

  // App views need a loaded chat; otherwise fall back to the landing page.
  useEffect(() => {
    if (route.page === 'home' && route.view !== 'home' && !chat && !loading) go('home', undefined, true);
  }, [route.page, route.view, chat, loading]);

  let content: React.ReactNode;
  if (route.page === 'privacy') content = <><TopBar /><PrivacyPage /></>;
  else if (route.page === 'how') content = <><TopBar /><HowItWorksPage /></>;
  else if (loading) content = <><TopBar /><LoadingScreen /></>;
  else if (chat && route.view === 'story') content = <StoryPage />;
  else if (chat && route.view === 'dashboard') content = <><TopBar /><DashboardPage section={route.section} /></>;
  else if (chat && route.view === 'person' && route.personId !== null) content = <><TopBar /><PersonPage personId={route.personId} /></>;
  else if (chat && route.view === 'compare') content = <><TopBar /><ComparePage /></>;
  else content = <><TopBar transparent /><Landing /></>;

  return (
    <>
      <SkipLink />
      <Suspense fallback={<PageFallback />}>{content}</Suspense>
      <PasteDialog />
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsDrawer />
        </Suspense>
      )}
    </>
  );
}
