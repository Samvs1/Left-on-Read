import { useId } from 'react';

/** Brand mark: a gradient tile with a speech bubble that is still typing. */
export function LogoMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`lg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6a4bff" />
          <stop offset="0.55" stopColor="#c24bd8" />
          <stop offset="1" stopColor="#ff6b57" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#lg${id})`} />
      <path d="M17 19h30a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H31l-9 7v-7h-5a6 6 0 0 1-6-6V25a6 6 0 0 1 6-6z" fill="#fff" />
      <circle cx="23.5" cy="31" r="3.2" fill="#6a4bff" />
      <circle cx="32" cy="31" r="3.2" fill="#c24bd8" opacity="0.8" />
      <circle cx="40.5" cy="31" r="3.2" fill="#ff6b57" opacity="0.6" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={compact ? 28 : 32} />
      <span className="whitespace-nowrap font-display text-[1.02rem] font-[750] leading-none tracking-[-0.03em] sm:text-[1.15rem]">Left on Read</span>
    </span>
  );
}
