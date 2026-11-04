import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { loadFile, setState, warmup } from '../store';
import { Icon } from './Icon';

const ACCEPT = '.txt,.zip,text/plain,application/zip,application/x-zip-compressed';

/** Hidden file input + helpers shared by buttons and the drop area. */
export function useFilePicker(onFile: (f: File) => void = (f) => void loadFile(f, f.name)) {
  const input = useRef<HTMLInputElement>(null);
  const el = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = '';
      }}
    />
  );
  return {
    input: el,
    open: () => {
      void warmup();
      input.current?.click();
    },
  };
}

export function DropZone({ onFile }: { onFile?: (f: File) => void }) {
  const t = useT();
  const [over, setOver] = useState(false);
  const handle = onFile ?? ((f: File) => void loadFile(f, f.name));
  const picker = useFilePicker(handle);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handle(f);
      }}
      className={`group relative rounded-[1.75rem] border-2 border-dashed p-5 text-center transition-all sm:p-7 ${
        over ? 'scale-[1.01] border-brand bg-brand-soft' : 'border-line-strong bg-surface/70 hover:border-brand/60'
      }`}
    >
      {picker.input}
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30 transition-transform group-hover:-translate-y-0.5">
        <Icon name="upload" size={26} />
      </div>
      <p className="font-display text-xl font-bold">{over ? t('landing.dropActive') : t('landing.dropTitle')}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t('landing.dropHint')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={picker.open}>
          <Icon name="upload" size={18} />
          {t('landing.ctaPick')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setState({ pasteOpen: true })}>
          <Icon name="clipboard" size={16} />
          {t('landing.orPaste')}
        </button>
      </div>
    </div>
  );
}

/** Full-page drop target while dragging a file anywhere over the window. */
export function GlobalDrop() {
  const t = useT();
  const [active, setActive] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setActive(true);
      void warmup();
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void loadFile(f, f.name);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-brand/15 backdrop-blur-sm">
      <div className="rounded-[2rem] border-2 border-dashed border-brand bg-surface px-10 py-8 text-center shadow-2xl">
        <Icon name="upload" size={36} className="mx-auto mb-2 text-brand" />
        <p className="font-display text-2xl font-bold">{t('landing.dropActive')}</p>
      </div>
    </div>
  );
}
