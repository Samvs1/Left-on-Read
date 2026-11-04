import { useState, type ReactElement } from 'react';
import { useT } from '../../i18n';
import { Icon } from './Icon';
import { Sheet } from './controls';
import type { ShareFormat } from '../lib/share';

/**
 * Opens a small sheet to export a share card in story or square format.
 * `make` returns the card element for a format (rendered off-screen).
 */
export function ShareButton({ make, filename, label, formats = ['story', 'square'], variant = 'icon', className = '' }: { make: (f: ShareFormat) => ReactElement | Promise<ReactElement>; filename: string; label?: string; formats?: ShareFormat[]; variant?: 'icon' | 'button' | 'light'; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ShareFormat | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (f: ShareFormat) => {
    setBusy(f);
    setMsg(null);
    try {
      const { renderToPng, deliver } = await import('../lib/share');
      const el = await make(f);
      const blob = await renderToPng(el, f);
      const res = await deliver(blob, `${filename}-${f}.png`, t('app.name'));
      if (res !== 'cancelled') setMsg(t('share.saved'));
      if (res === 'shared') setOpen(false);
    } catch (e) {
      console.error(e);
      setMsg(t('share.failed'));
    } finally {
      setBusy(null);
    }
  };
  const trigger =
    variant === 'icon' ? (
      <button type="button" className={`icon-btn ${className}`} onClick={() => setOpen(true)} aria-label={label ?? t('common.share')} title={label ?? t('common.share')}>
        <Icon name="share" size={18} />
      </button>
    ) : (
      <button type="button" className={variant === 'light' ? 'btn btn-sm bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25' : 'btn btn-ghost btn-sm'} onClick={() => setOpen(true)}>
        <Icon name="share" size={16} />
        {label ?? t('common.share')}
      </button>
    );
  return (
    <>
      {trigger}
      <Sheet open={open} onClose={() => setOpen(false)} title={t('share.title')} side="center">
        <p className="mb-4 text-sm text-muted">{t('share.noText')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {formats.map((f) => (
            <button key={f} type="button" className="card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 disabled:opacity-60" disabled={busy !== null} onClick={() => void run(f)}>
              <span className={`grid shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#6a4bff] to-[#ff6b57] ${f === 'story' ? 'h-12 w-7' : 'h-9 w-9'}`} aria-hidden="true" />
              <span className="font-semibold">{busy === f ? t('share.generating') : t(f === 'story' ? 'share.story' : 'share.square')}</span>
            </button>
          ))}
        </div>
        {msg && (
          <p className="mt-4 text-sm font-semibold text-muted" role="status">
            {msg}
          </p>
        )}
      </Sheet>
    </>
  );
}
