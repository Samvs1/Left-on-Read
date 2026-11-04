import { useMemo } from 'react';
import type { ChatStats } from '../../engine/types';
import { chartTheme, personColor, type ChartTheme } from '../colors';
import { useDark } from '../theme';
import { useNamer, type Namer } from '../names';
import { useT, useLang, type TKey, type TParams } from '../../i18n';
import type { SeriesSpec } from '../charts/options';

export interface Kit {
  s: ChatStats;
  th: ChartTheme;
  dark: boolean;
  t: (k: TKey, p?: TParams) => string;
  namer: Namer;
  name: (i: number) => string;
  color: (i: number) => string;
  /** Series rows for stacked time series: main people + "Others". */
  rows: { name: string; color: string; person: number }[];
  lang: string;
}

export function useKit(s: ChatStats): Kit {
  const dark = useDark();
  const t = useT();
  const lang = useLang();
  const namer = useNamer();
  return useMemo(() => {
    const th = chartTheme(dark);
    const color = (i: number) => personColor(i, dark);
    const rows = s.meta.mainPeople.map((p) => ({ name: namer.name(p), color: color(p), person: p }));
    if (s.meta.otherPeople.length > 0) rows.push({ name: t('common.others'), color: personColor(-1, dark), person: -1 });
    return { s, th, dark, t, namer, name: namer.name, color, rows, lang };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, dark, lang, namer.anonymous, namer.title]);
}

/** Per-person series for the given people (by index), coloured by identity. */
export function personSeries(k: Kit, people: number[], value: (p: number) => (number | null)[]): SeriesSpec[] {
  return people.map((p) => ({ name: k.name(p), color: k.color(p), data: value(p) }));
}

/** Main people that actually have messages. */
export function mainActive(k: Kit): number[] {
  return k.s.meta.mainPeople.filter((p) => (k.s.people[p]?.messages ?? 0) > 0);
}
