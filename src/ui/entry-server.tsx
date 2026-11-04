/**
 * Server entry used only at build time to prerender the static pages
 * (landing, privacy, how-it-works) into HTML for fast first paint and SEO.
 */
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { parseRoute, setSsrRoute } from './router';

export function render(pathname: string): string {
  setSsrRoute(parseRoute(pathname, ''));
  return renderToString(<App />);
}
