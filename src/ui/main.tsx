import './styles.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { detectLang, setLang } from '../i18n';
import { initTheme } from './theme';
import { initStore } from './store';
import { parseRoute } from './router';
import { registerServiceWorker, consumeSharedFile } from './pwa';

initTheme();
initStore();
const lang = detectLang();
setLang(lang, false);
document.documentElement.lang = lang;

const root = document.getElementById('root')!;
const route = parseRoute(location.pathname, location.hash);
// The prerendered HTML is English and shows the landing/static pages; hydrate
// when that is what we'd render anyway, otherwise render fresh.
const prerendered = root.firstElementChild !== null;
if (prerendered && lang === 'en' && route.view === 'home') {
  hydrateRoot(root, <App />);
} else {
  root.textContent = '';
  createRoot(root).render(<App />);
}
document.documentElement.classList.remove('lang-pending');

registerServiceWorker();
void consumeSharedFile();
