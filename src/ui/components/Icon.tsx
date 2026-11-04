/** Inline stroke icons (24×24 grid, 2px stroke). */
const PATHS: Record<string, string> = {
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15zM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6L5 15z',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3zm-3 9 2 2 4-4',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z',
  plane: 'M10.5 13.5 3 11l1.5-1.5 7 .5 4-4.5a2.1 2.1 0 0 1 3 3L14 13l.5 7L13 21.5l-2.5-7.5-3 3V19l-1.5 1.5-1-3.5-3.5-1L3 14.5h2l3-3',
  wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 11 5M12 20h.01',
  play: 'M7 4.5v15l12-7.5-12-7.5z',
  pause: 'M8 5v14M16 5v14',
  x: 'M6 6l12 12M18 6 6 18',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
  monitor: 'M4 5h16v11H4zM8 20h8M12 16v4',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3.5 9h17M3.5 15h17',
  mask: 'M3 8c3-1.5 6-1.5 9 0 3-1.5 6-1.5 9 0v3c0 4-3 6-5 6-1.5 0-2.5-1-4-3-1.5 2-2.5 3-4 3-2 0-5-2-5-6V8zm4 2.5h2m6 0h2',
  share: 'M12 15V3m0 0L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  download: 'M12 4v12m0 0-5-5m5 5 5-5M4 20h16',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  arrowLeft: 'M19 12H5m6-6-6 6 6 6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 8v5m0-8.5h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clipboard: 'M9 4h6v3H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2',
  refresh: 'M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4m-4 5a8 8 0 0 0 14.9 3.5M20 20v-4h-4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zm0 0v5h5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  trophy: 'M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4',
  heart: 'M12 20s-7-4.4-9-9.2C1.8 7.5 4 4.5 7 4.5c2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3 0 5.2 3 4 6.3C19 15.6 12 20 12 20z',
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  message: 'M4 5h16v11H9l-5 4V5z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  zap: 'M13 3 4 14h7l-1 7 9-11h-7l1-7z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11',
  layers: 'M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  compare: 'M8 4v16M16 4v16M4 8h8M12 16h8',
  menu: 'M4 7h16M4 12h16M4 17h16',
  home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4v-9z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3 3.8M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  const filled = name === 'play';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
