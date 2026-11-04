import { useMemo } from 'react';
import type { EChartsOption } from '../lib/echarts';
import { chartTheme, type ChartTheme } from '../colors';
import { ChartCard, type TableData } from '../components/data';
import { EChart } from '../charts/EChart';
import { ShareButton } from '../components/ShareButton';
import { useWidth } from '../components/controls';
import type { Kit } from './hooks';
import { ChartShareCard } from '../share/cards';

interface Props {
  k: Kit;
  id: string;
  title: string;
  takeaway?: string | null;
  height: number | ((narrow: boolean) => number);
  build: (th: ChartTheme, narrow: boolean) => EChartsOption | null;
  table?: TableData | null;
  wide?: boolean;
  onClick?: (p: { name?: string; seriesName?: string; dataIndex?: number; data?: unknown }) => void;
  extra?: React.ReactNode;
  shareable?: boolean;
  /** Extra values the option depends on (besides the kit and the width class). */
  deps?: unknown[];
}

/** Chart card with responsive option, text alternative, table view and share. */
export function ChartBlock({ k, id, title, takeaway, height, build, table, wide, onClick, extra, shareable = true, deps = [] }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const narrow = width > 0 && width < 520;
  const ready = width > 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const option = useMemo(() => (ready ? build(k.th, narrow) : null), [k, narrow, ready, ...deps]);
  const h = typeof height === 'function' ? height(narrow) : height;
  const label = [title, takeaway].filter(Boolean).join('. ');
  return (
    <ChartCard
      id={id}
      title={title}
      takeaway={takeaway}
      table={table}
      wide={wide}
      actions={
        shareable && option ? (
          <ShareButton
            filename={`left-on-read-${id}`}
            make={async (f) => {
              const { chartToSvg } = await import('../lib/share');
              const opt = build(chartTheme(true), f === 'story');
              const svg = opt ? chartToSvg(opt, f === 'story' ? 345 : 470, f === 'story' ? 420 : 300) : '';
              return <ChartShareCard title={title} takeaway={takeaway} svg={svg} format={f} />;
            }}
          />
        ) : null
      }
    >
      {extra}
      <div ref={ref}>{option ? <EChart option={option} height={h} label={label} onClick={onClick} /> : <div className="skeleton rounded-2xl" style={{ height: h }} />}</div>
    </ChartCard>
  );
}
