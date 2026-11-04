import { useT } from '../../i18n';
import { useStore } from '../store';
import { defaultPeriod } from './data';

/** "Your 2025 Wrapped": the label for buttons that open the Wrapped page. */
export function useWrappedLabel(): string {
  const t = useT();
  const chat = useStore((s) => s.chat);
  const settings = useStore((s) => s.settings);
  if (!chat) return t('wrapped.ctaRange');
  const unfiltered = settings.dateStart === null && settings.dateEnd === null;
  const p = defaultPeriod(chat.summary.firstTs, chat.summary.lastTs, unfiltered ? (chat.stats?.time.monthly ?? null) : null);
  return p.kind === 'year' && p.year ? t('wrapped.cta', { year: p.year }) : t('wrapped.ctaRange');
}

/** Gradient pill style shared by the Wrapped call-to-action buttons (white text ≥ 6:1). */
export const WRAPPED_BUTTON = 'btn btn-sm border-0 bg-[linear-gradient(120deg,#4527d6,#a1259b)] text-white shadow-[0_8px_24px_-10px_rgba(69,39,214,0.8)] hover:brightness-110';
