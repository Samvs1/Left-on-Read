import { useEffect, useRef, useState } from 'react';
import type { EChartsOption } from '../lib/echarts';
import { useDark } from '../theme';

type Inst = { setOption: (o: EChartsOption, notMerge?: boolean) => void; resize: () => void; dispose: () => void; getDom: () => HTMLElement };

interface Props {
  option: EChartsOption | null;
  height: number | string;
  /** Text alternative read by screen readers (the chart itself is aria-hidden). */
  label: string;
  className?: string;
  onClick?: (params: { name?: string; seriesName?: string; dataIndex?: number; data?: unknown }) => void;
}

/**
 * Lazily initialised ECharts instance. The option is rebuilt by the caller
 * whenever data, theme or language change. Resizes with its container.
 */
export function EChart({ option, height, label, className, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<Inst | null>(null);
  const [ready, setReady] = useState(false);
  const dark = useDark();
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    void import('../lib/echarts').then(({ echarts }) => {
      if (disposed || !ref.current) return;
      const chart = echarts.init(ref.current, null, { renderer: 'svg' }) as unknown as Inst & {
        on: (ev: string, fn: (p: never) => void) => void;
      };
      inst.current = chart;
      chart.on('click', (p: never) => clickRef.current?.(p));
      ro = new ResizeObserver(() => chart.resize());
      ro.observe(ref.current);
      setReady(true);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      inst.current?.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready && inst.current && option) inst.current.setOption(option, true);
  }, [ready, option, dark]);

  return (
    <div className={className} style={{ height, position: 'relative' }}>
      <div ref={ref} aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />
      {!ready && <div className="skeleton absolute inset-0 rounded-2xl" aria-hidden="true" />}
      <span className="sr-only">{label}</span>
    </div>
  );
}
