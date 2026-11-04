import { useEffect, useState } from 'react';
import { useT, type TKey } from '../../i18n';
import { Segmented } from './controls';

type Variant = 'header' | 'scrollExport' | 'withoutMedia' | 'saveFiles' | 'dots' | 'moreExport' | 'shareTo';

/** Simple, brand-neutral phone illustrations for the export steps. */
function PhoneSketch({ variant, label }: { variant: Variant; label?: string }) {
  const hi = 'var(--brand)';
  const line = 'var(--line-strong)';
  const soft = 'var(--surface-2)';
  return (
    <svg viewBox="0 0 120 210" className="h-auto w-full max-w-[9.5rem]" role="img" aria-label={label}>
      <rect x="3" y="3" width="114" height="204" rx="20" fill="var(--surface)" stroke={line} strokeWidth="2" />
      <rect x="44" y="9" width="32" height="6" rx="3" fill={line} />
      {/* header */}
      <rect x="12" y="22" width="96" height="22" rx="8" fill={soft} />
      <circle cx="24" cy="33" r="6" fill={variant === 'header' ? hi : line} />
      <rect x="34" y="29" width="34" height="5" rx="2.5" fill={variant === 'header' ? hi : line} />
      <rect x="34" y="36" width="20" height="3" rx="1.5" fill={line} />
      {variant === 'dots' && (
        <g>
          <circle cx="101" cy="33" r="9" fill="none" stroke={hi} strokeWidth="2" />
          <circle cx="101" cy="28.5" r="1.6" fill={hi} />
          <circle cx="101" cy="33" r="1.6" fill={hi} />
          <circle cx="101" cy="37.5" r="1.6" fill={hi} />
        </g>
      )}
      {variant === 'header' && <circle cx="40" cy="33" r="17" fill="none" stroke={hi} strokeWidth="2" opacity="0.5" />}
      {/* content */}
      {(variant === 'header' || variant === 'dots') && (
        <g>
          <rect x="14" y="56" width="52" height="14" rx="7" fill={soft} />
          <rect x="54" y="76" width="52" height="14" rx="7" fill="var(--brand-soft)" />
          <rect x="14" y="96" width="40" height="14" rx="7" fill={soft} />
          <rect x="44" y="116" width="62" height="14" rx="7" fill="var(--brand-soft)" />
          <rect x="14" y="136" width="58" height="14" rx="7" fill={soft} />
        </g>
      )}
      {(variant === 'scrollExport' || variant === 'moreExport') && (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const active = (variant === 'scrollExport' && i === 4) || (variant === 'moreExport' && i === 2);
            return (
              <g key={i}>
                <rect x="12" y={54 + i * 22} width="96" height="18" rx="6" fill={active ? 'var(--brand-soft)' : soft} stroke={active ? hi : 'none'} strokeWidth="1.5" />
                <rect x="20" y={60 + i * 22} width={active ? 44 : 30 + ((i * 13) % 30)} height="5" rx="2.5" fill={active ? hi : line} />
              </g>
            );
          })}
          {variant === 'moreExport' && <rect x="66" y="56" width="40" height="62" rx="8" fill="var(--surface)" stroke={line} />}
          {variant === 'moreExport' && <rect x="72" y="100" width="28" height="5" rx="2.5" fill={hi} />}
        </g>
      )}
      {variant === 'withoutMedia' && (
        <g>
          <rect x="14" y="56" width="92" height="96" rx="12" fill="var(--surface)" stroke={line} strokeWidth="1.5" />
          <rect x="24" y="68" width="60" height="5" rx="2.5" fill={line} />
          <rect x="24" y="78" width="44" height="4" rx="2" fill={line} opacity="0.6" />
          <rect x="22" y="96" width="76" height="20" rx="10" fill="var(--brand-soft)" stroke={hi} strokeWidth="1.5" />
          <rect x="36" y="104" width="48" height="5" rx="2.5" fill={hi} />
          <rect x="22" y="122" width="76" height="20" rx="10" fill={soft} />
          <rect x="40" y="130" width="40" height="5" rx="2.5" fill={line} />
        </g>
      )}
      {(variant === 'saveFiles' || variant === 'shareTo') && (
        <g>
          <rect x="8" y="112" width="104" height="88" rx="16" fill={soft} />
          {[0, 1, 2, 3].map((i) => {
            const active = i === 1;
            return (
              <g key={i}>
                <rect x={16 + i * 24} y="126" width="18" height="18" rx="6" fill={active ? hi : 'var(--surface)'} stroke={active ? 'none' : line} />
                <rect x={16 + i * 24} y="149" width="18" height="3" rx="1.5" fill={active ? hi : line} />
              </g>
            );
          })}
          <rect x="16" y="166" width="88" height="14" rx="7" fill="var(--surface)" />
          {variant === 'saveFiles' && <path d="M41 131h4l2 2h7v8H41z" fill="#fff" />}
          {variant === 'shareTo' && <path d="M44 132h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3l-3 2v-2h-2a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" fill="#fff" />}
        </g>
      )}
    </svg>
  );
}

const IOS: [TKey, Variant][] = [
  ['guide.ios1', 'header'],
  ['guide.ios2', 'scrollExport'],
  ['guide.ios3', 'withoutMedia'],
  ['guide.ios4', 'saveFiles'],
];
const ANDROID: [TKey, Variant][] = [
  ['guide.and1', 'dots'],
  ['guide.and2', 'moreExport'],
  ['guide.and3', 'withoutMedia'],
  ['guide.and4', 'shareTo'],
];

export function ExportGuide({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [os, setOs] = useState<'ios' | 'android'>('ios');
  useEffect(() => {
    // After hydration, default to the visitor's platform.
    if (/android/i.test(navigator.userAgent)) setOs('android');
  }, []);
  const steps = os === 'ios' ? IOS : ANDROID;
  return (
    <div>
      <div className="mb-5 flex justify-center">
        <Segmented
          label={t('landing.exportTitle')}
          value={os}
          onChange={setOs}
          options={[
            { value: 'ios', label: t('guide.iphone') },
            { value: 'android', label: t('guide.android') },
          ]}
        />
      </div>
      <ol className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {steps.map(([key, variant], i) => (
          <li key={key} className="card flex flex-col items-center gap-3 p-4 text-center">
            <PhoneSketch variant={variant} label={t(key)} />
            <div>
              <span className="mx-auto mb-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
              <p className="text-[0.9rem] font-medium leading-snug">{t(key)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-center text-sm text-muted">{t('guide.tip')}</p>
    </div>
  );
}
