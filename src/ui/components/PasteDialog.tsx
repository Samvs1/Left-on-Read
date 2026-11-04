import { useState } from 'react';
import { useT } from '../../i18n';
import { loadText, setState, useStore } from '../store';
import { Sheet } from './controls';

export function PasteDialog() {
  const t = useT();
  const open = useStore((s) => s.pasteOpen);
  const [text, setText] = useState('');
  return (
    <Sheet open={open} onClose={() => setState({ pasteOpen: false })} title={t('paste.title')} side="center" wide>
      <p className="mb-3 text-sm text-muted">{t('paste.hint')}</p>
      <label className="sr-only" htmlFor="paste-area">
        {t('paste.title')}
      </label>
      <textarea
        id="paste-area"
        data-autofocus
        className="field h-64 resize-y font-mono text-[0.8rem] leading-relaxed"
        placeholder={t('paste.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => void loadText(text)}>
          {t('paste.analyse')}
        </button>
      </div>
    </Sheet>
  );
}
