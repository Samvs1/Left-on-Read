/**
 * ECharts option builders. Mark specs follow the dataviz rules: bars ≤ 24px
 * with 4px rounded data-ends, 2px lines, 2px surface gaps between touching
 * fills, hairline solid grids, recessive axes, themed tooltips, a legend for
 * two or more series, and text in ink tokens (never in series colours).
 */
import type { ChartTheme } from '../colors';
import type { EChartsOption } from '../lib/echarts';
import { fmtCompact, fmtDuration, fmtHourShort, fmtMonthShort, fmtNum, fmtPct, weekdayName, fmtDateShort, fmtMonth } from '../format';

export interface SeriesSpec {
  name: string;
  color: string;
  data: (number | null)[];
}

const FONT = "'Inter Variable', ui-sans-serif, system-ui, sans-serif";

export function base(th: ChartTheme): EChartsOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: FONT, color: th.ink2 },
    animationDuration: 700,
    animationEasing: 'cubicOut',
    aria: { enabled: false },
  };
}

export function tooltip(th: ChartTheme, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    backgroundColor: th.surface,
    borderColor: th.axis,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: th.ink, fontFamily: FONT, fontSize: 12 },
    extraCssText: `border-radius:12px;box-shadow:0 10px 30px -10px rgba(0,0,0,${th.dark ? 0.6 : 0.18});`,
    confine: true,
    ...extra,
  };
}

function axis(th: ChartTheme, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    axisLine: { show: true, lineStyle: { color: th.axis, width: 1 } },
    axisTick: { show: false },
    axisLabel: { color: th.muted, fontSize: 11, fontFamily: FONT, hideOverlap: true },
    splitLine: { show: false },
    ...extra,
  };
}

function valueAxis(th: ChartTheme, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: th.muted, fontSize: 11, fontFamily: FONT, formatter: (v: number) => fmtCompact(v) },
    splitLine: { show: true, lineStyle: { color: th.grid, width: 1, type: 'solid' } },
    ...extra,
  };
}

function legend(th: ChartTheme, show: boolean, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    show,
    type: 'scroll',
    top: 0,
    left: 0,
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 14,
    textStyle: { color: th.ink2, fontSize: 12, fontFamily: FONT },
    pageIconColor: th.ink2,
    pageTextStyle: { color: th.muted },
    ...extra,
  };
}

const dot = (color: string) =>
  `<span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:${color};margin-right:6px;vertical-align:middle"></span>`;

/* ------------------------------------------------------------------ */
/* Time series                                                          */
/* ------------------------------------------------------------------ */

export function timelineOption(
  th: ChartTheme,
  starts: number[],
  series: SeriesSpec[],
  gran: 'day' | 'week' | 'month',
  bands: { start: number; end: number; label: string }[] = [],
): EChartsOption {
  const isBar = gran !== 'day';
  const multi = series.length > 1;
  const labels = starts.map((s) => s);
  const fmtX = (v: number) => (gran === 'month' ? fmtMonthShort(v) : fmtDateShort(v));
  return {
    ...base(th),
    grid: { left: 4, right: 8, top: multi ? 34 : 12, bottom: 4, containLabel: true },
    legend: legend(th, multi),
    tooltip: tooltip(th, {
      trigger: 'axis',
      axisPointer: { type: isBar ? 'shadow' : 'line', lineStyle: { color: th.axis }, shadowStyle: { color: th.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
      formatter: (ps: { axisValue: number; seriesName: string; value: number; color: string }[]) => {
        const head = gran === 'month' ? fmtMonth(Number(ps[0]?.axisValue)) : fmtDateShort(Number(ps[0]?.axisValue));
        const total = ps.reduce((a, p) => a + (Number(p.value) || 0), 0);
        const rows = ps.filter((p) => Number(p.value) > 0).map((p) => `${dot(p.color)}${p.seriesName}: <b>${fmtNum(Number(p.value))}</b>`);
        return `<div style="font-weight:600;margin-bottom:4px">${head}</div>${rows.join('<br/>')}${multi ? `<div style="margin-top:4px;color:${th.muted}">Σ ${fmtNum(total)}</div>` : ''}`;
      },
    }),
    xAxis: { type: 'category', data: labels, boundaryGap: isBar, ...axis(th, { axisLabel: { color: th.muted, fontSize: 11, formatter: (v: string) => fmtX(Number(v)), hideOverlap: true } }) },
    yAxis: valueAxis(th),
    dataZoom: [{ type: 'inside', zoomOnMouseWheel: false, moveOnMouseWheel: false, moveOnMouseMove: true }],
    series: series.map((s, i) => ({
      name: s.name,
      type: isBar ? 'bar' : 'line',
      stack: 'total',
      data: s.data,
      barMaxWidth: 24,
      barCategoryGap: '30%',
      large: false,
      smooth: !isBar,
      showSymbol: false,
      symbolSize: 8,
      sampling: isBar ? undefined : 'lttb',
      lineStyle: { width: 2, color: s.color, cap: 'round', join: 'round' },
      areaStyle: isBar ? undefined : { color: s.color, opacity: multi ? 0.5 : 0.15 },
      itemStyle: {
        color: s.color,
        borderColor: th.surface,
        borderWidth: isBar && multi ? 1 : 0,
        borderRadius: isBar ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : 0,
      },
      emphasis: { focus: 'series' },
      markArea:
        i === 0 && bands.length
          ? {
              silent: true,
              data: bands.map((b, k) => [
                {
                  xAxis: nearestIndex(starts, b.start),
                  name: b.label,
                  itemStyle: { color: k % 2 === 0 ? (th.dark ? 'rgba(255,255,255,0.025)' : 'rgba(22,20,29,0.025)') : 'transparent' },
                  label: { show: true, position: 'insideTop', color: th.muted, fontSize: 10, fontFamily: FONT, distance: 4 },
                },
                { xAxis: nearestIndex(starts, b.end - 1) },
              ]),
            }
          : undefined,
    })),
  };
}

function nearestIndex(starts: number[], t: number): number {
  let best = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i]! <= t) best = i;
  return best;
}

/* ------------------------------------------------------------------ */
/* Calendar heatmap                                                     */
/* ------------------------------------------------------------------ */

export function calendarOption(th: ChartTheme, firstDay: number, totals: number[], narrow: boolean): { option: EChartsOption; height: number } {
  const DAY = 86_400_000;
  const data: [string, number][] = totals.map((v, i) => [new Date(firstDay + i * DAY).toISOString().slice(0, 10), v]);
  const years = Array.from(new Set(data.map((d) => d[0].slice(0, 4))));
  const sorted = [...totals].filter((v) => v > 0).sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)]! : 1;
  const cell = narrow ? 13 : 15;
  const yearBlock = narrow ? cell * 53 + 40 : cell * 7 + 46;
  const calendars = years.map((y, i) =>
    narrow
      ? {
          orient: 'vertical',
          range: y,
          left: 34 + i * (cell * 7 + 34),
          top: 30,
          cellSize: [cell, cell],
          ...calStyle(th),
          yearLabel: { show: true, position: 'top', color: th.ink2, fontFamily: FONT, fontSize: 12, fontWeight: 600, margin: 18 },
        }
      : {
          range: y,
          left: 40,
          right: 8,
          top: 26 + i * yearBlock,
          cellSize: ['auto', cell],
          ...calStyle(th),
          yearLabel: { show: true, position: 'left', color: th.ink2, fontFamily: FONT, fontSize: 12, fontWeight: 600, margin: 26 },
        },
  );
  const height = narrow ? cell * 53 + 70 : years.length * yearBlock + 20;
  return {
    height,
    option: {
      ...base(th),
      tooltip: tooltip(th, {
        formatter: (p: { value: [string, number] }) => `<b>${fmtDateShort(Date.parse(p.value[0]))}</b><br/>${fmtNum(p.value[1])}`,
      }),
      visualMap: {
        show: false,
        min: 0,
        max: Math.max(1, p95),
        inRange: { color: th.seq },
        outOfRange: { color: th.seq[th.seq.length - 1] },
      },
      calendar: calendars,
      series: years.map((y, i) => ({
        type: 'heatmap',
        coordinateSystem: 'calendar',
        calendarIndex: i,
        data: data.filter((d) => d[0].startsWith(y) && d[1] > 0),
      })),
    },
  };
}

function calStyle(th: ChartTheme) {
  return {
    splitLine: { show: false },
    itemStyle: { color: th.dark ? '#1d1a27' : '#f4f1ec', borderColor: th.surface, borderWidth: 2 },
    dayLabel: { firstDay: 1, color: th.muted, fontSize: 10, fontFamily: FONT, nameMap: [0, 1, 2, 3, 4, 5, 6].map((d) => weekdayName((d + 6) % 7, 'narrow')) },
    monthLabel: { color: th.muted, fontSize: 10, fontFamily: FONT, nameMap: Array.from({ length: 12 }, (_, m) => fmtMonthShort(Date.UTC(2024, m, 1)).replace(/\s?'?\d+$/, '').replace(/\.$/, '')) },
  };
}

/* ------------------------------------------------------------------ */
/* Weekday × hour heatmap                                               */
/* ------------------------------------------------------------------ */

export function weekHourOption(th: ChartTheme, cells: number[], narrow: boolean): EChartsOption {
  const data: [number, number, number][] = [];
  let max = 1;
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    const v = cells[d * 24 + h] ?? 0;
    data.push([h, 6 - d, v]);
    if (v > max) max = v;
  }
  return {
    ...base(th),
    grid: { left: 4, right: 4, top: 4, bottom: 4, containLabel: true },
    tooltip: tooltip(th, {
      formatter: (p: { value: [number, number, number] }) => `<b>${weekdayName(6 - p.value[1])} ${fmtHourShort(p.value[0])}</b><br/>${fmtNum(p.value[2])}`,
    }),
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, h) => h),
      ...axis(th, { axisLine: { show: false }, axisLabel: { color: th.muted, fontSize: 10, interval: narrow ? 5 : 2, formatter: (v: string) => fmtHourShort(Number(v)) } }),
    },
    yAxis: {
      type: 'category',
      data: [6, 5, 4, 3, 2, 1, 0].map((d) => weekdayName(d, 'short')),
      ...axis(th, { axisLine: { show: false } }),
    },
    visualMap: { show: false, min: 0, max, inRange: { color: th.seq } },
    series: [{ type: 'heatmap', data, itemStyle: { borderColor: th.surface, borderWidth: 2, borderRadius: 4 }, emphasis: { itemStyle: { borderColor: th.ink, borderWidth: 1 } } }],
  };
}

/* ------------------------------------------------------------------ */
/* Bars                                                                 */
/* ------------------------------------------------------------------ */

export function columnsOption(
  th: ChartTheme,
  categories: string[],
  series: SeriesSpec[],
  opts: { stack?: boolean; valueFmt?: (v: number) => string; horizontal?: boolean } = {},
): EChartsOption {
  const multi = series.length > 1;
  const fmt = opts.valueFmt ?? ((v: number) => fmtNum(v));
  const horizontal = !!opts.horizontal;
  const catAxis = { type: 'category', data: categories, ...axis(th, horizontal ? { axisLine: { show: false }, axisLabel: { color: th.ink2, fontSize: 12, width: 110, overflow: 'truncate' } } : {}) };
  const valAxis = valueAxis(th, { axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => fmt(v) } });
  return {
    ...base(th),
    grid: { left: 4, right: 12, top: multi ? 34 : 12, bottom: 4, containLabel: true },
    legend: legend(th, multi),
    tooltip: tooltip(th, {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: th.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
      valueFormatter: (v: number) => fmt(Number(v)),
    }),
    xAxis: horizontal ? valAxis : catAxis,
    yAxis: horizontal ? { ...catAxis, inverse: true } : valAxis,
    series: series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: opts.stack ? 'a' : undefined,
      data: s.data,
      barMaxWidth: 24,
      barGap: '12%',
      itemStyle: {
        color: s.color,
        borderColor: th.surface,
        borderWidth: opts.stack && multi ? 1 : 0,
        borderRadius: opts.stack && i !== series.length - 1 ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
      emphasis: { focus: 'series' },
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Lines                                                                */
/* ------------------------------------------------------------------ */

export function linesOption(
  th: ChartTheme,
  x: (string | number)[],
  series: (SeriesSpec & { dashed?: boolean })[],
  opts: { valueFmt?: (v: number) => string; xFmt?: (v: string | number) => string; log?: boolean; min?: number; max?: number; zeroLine?: boolean } = {},
): EChartsOption {
  const multi = series.length > 1;
  const fmt = opts.valueFmt ?? ((v: number) => fmtNum(v));
  return {
    ...base(th),
    grid: { left: 4, right: 12, top: multi ? 34 : 12, bottom: 4, containLabel: true },
    legend: legend(th, multi),
    tooltip: tooltip(th, {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: th.axis } },
      valueFormatter: (v: number | null) => (v === null || v === undefined || Number.isNaN(v) ? '–' : fmt(Number(v))),
    }),
    xAxis: { type: 'category', data: x, boundaryGap: false, ...axis(th, { axisLabel: { color: th.muted, fontSize: 11, hideOverlap: true, formatter: opts.xFmt ? (v: string) => opts.xFmt!(v) : undefined } }) },
    yAxis: valueAxis(th, {
      type: opts.log ? 'log' : 'value',
      min: opts.min,
      max: opts.max,
      axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => fmt(v) },
    }),
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: 0.25,
      connectNulls: false,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 2, color: s.color, type: s.dashed ? 'dashed' : 'solid', cap: 'round', join: 'round' },
      itemStyle: { color: s.color, borderColor: th.surface, borderWidth: 2 },
      emphasis: { focus: 'series' },
      markLine: opts.zeroLine
        ? { silent: true, symbol: 'none', lineStyle: { color: th.axis, width: 1, type: 'solid' }, label: { show: false }, data: [{ yAxis: 0 }] }
        : undefined,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Clock (polar)                                                        */
/* ------------------------------------------------------------------ */

export function clockOption(th: ChartTheme, hourly: number[], color: string): EChartsOption {
  return {
    ...base(th),
    tooltip: tooltip(th, { formatter: (p: { dataIndex: number; value: number }) => `<b>${fmtHourShort(p.dataIndex)}</b><br/>${fmtNum(p.value)}` }),
    polar: { radius: ['18%', '86%'] },
    angleAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, h) => h),
      startAngle: 90,
      clockwise: true,
      axisLine: { lineStyle: { color: th.axis } },
      axisTick: { show: false },
      axisLabel: { color: th.muted, fontSize: 10, interval: 2, formatter: (v: string) => fmtHourShort(Number(v)) },
      splitLine: { show: false },
    },
    radiusAxis: { show: false, type: 'value' },
    series: [{ type: 'bar', coordinateSystem: 'polar', data: hourly, itemStyle: { color, borderRadius: 4 }, barCategoryGap: '18%' }],
  };
}

/* ------------------------------------------------------------------ */
/* Response times                                                       */
/* ------------------------------------------------------------------ */

export function boxplotOption(th: ChartTheme, rows: { name: string; color: string; p: [number, number, number, number, number] }[]): EChartsOption {
  const MIN = 60_000;
  return {
    ...base(th),
    grid: { left: 4, right: 16, top: 8, bottom: 4, containLabel: true },
    tooltip: tooltip(th, {
      formatter: (p: { name: string; data: number[] }) => {
        const d = p.data.slice(-5);
        return `<b>${p.name}</b><br/>P5 ${fmtDuration(d[0]! * MIN)} · P25 ${fmtDuration(d[1]! * MIN)}<br/><b>Median ${fmtDuration(d[2]! * MIN)}</b><br/>P75 ${fmtDuration(d[3]! * MIN)} · P95 ${fmtDuration(d[4]! * MIN)}`;
      },
    }),
    xAxis: valueAxis(th, { type: 'log', min: 0.05, logBase: 10, axisLabel: { color: th.muted, fontSize: 11, formatter: (v: number) => fmtDuration(v * MIN) } }),
    yAxis: { type: 'category', data: rows.map((r) => r.name), inverse: true, ...axis(th, { axisLine: { show: false }, axisLabel: { color: th.ink2, fontSize: 12, width: 100, overflow: 'truncate' } }) },
    series: [
      {
        type: 'boxplot',
        boxWidth: [10, 22],
        data: rows.map((r) => ({
          value: r.p.map((v) => Math.max(0.05, v / MIN)),
          itemStyle: { color: `${r.color}26`, borderColor: r.color, borderWidth: 2 },
        })),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Matrix, network, chord                                               */
/* ------------------------------------------------------------------ */

export function matrixOption(th: ChartTheme, names: string[], matrix: number[][]): EChartsOption {
  const data: [number, number, number][] = [];
  let max = 1;
  for (let i = 0; i < names.length; i++) for (let j = 0; j < names.length; j++) {
    const v = matrix[i]?.[j] ?? 0;
    data.push([j, i, v]);
    if (i !== j && v > max) max = v;
  }
  return {
    ...base(th),
    grid: { left: 4, right: 4, top: 4, bottom: 4, containLabel: true },
    tooltip: tooltip(th, {
      formatter: (p: { value: [number, number, number] }) => `<b>${names[p.value[0]]}</b> → ${names[p.value[1]]}<br/>${fmtNum(p.value[2])}`,
    }),
    xAxis: { type: 'category', data: names, position: 'top', ...axis(th, { axisLine: { show: false }, axisLabel: { color: th.ink2, fontSize: 11, rotate: names.length > 4 ? 40 : 0, width: 80, overflow: 'truncate' } }) },
    yAxis: { type: 'category', data: names, inverse: true, ...axis(th, { axisLine: { show: false }, axisLabel: { color: th.ink2, fontSize: 11, width: 90, overflow: 'truncate' } }) },
    visualMap: { show: false, min: 0, max, inRange: { color: th.seq } },
    series: [{ type: 'heatmap', data, label: { show: names.length <= 6, color: th.ink, fontSize: 11, formatter: (p: { value: [number, number, number] }) => (p.value[2] > 0 ? fmtCompact(p.value[2]) : '') }, itemStyle: { borderColor: th.surface, borderWidth: 2, borderRadius: 6 } }],
  };
}

export function networkOption(
  th: ChartTheme,
  nodes: { id: number; name: string; value: number; color: string }[],
  edges: { a: number; b: number; weight: number }[],
): EChartsOption {
  const maxV = Math.max(1, ...nodes.map((n) => n.value));
  const maxW = Math.max(1, ...edges.map((e) => e.weight));
  return {
    ...base(th),
    tooltip: tooltip(th, {
      formatter: (p: { dataType: string; data: { name?: string; value?: number; source?: string; target?: string } }) =>
        p.dataType === 'edge'
          ? `${nodes.find((n) => String(n.id) === p.data.source)?.name} ↔ ${nodes.find((n) => String(n.id) === p.data.target)?.name}<br/><b>${fmtNum(p.data.value ?? 0)}</b>`
          : `<b>${p.data.name}</b><br/>${fmtNum(p.data.value ?? 0)}`,
    }),
    series: [
      {
        type: 'graph',
        layout: nodes.length <= 9 ? 'circular' : 'force',
        circular: { rotateLabel: false },
        force: { repulsion: 260, edgeLength: [60, 160], gravity: 0.08 },
        roam: false,
        draggable: true,
        label: { show: true, position: 'right', color: th.ink, fontFamily: FONT, fontSize: 12 },
        lineStyle: { color: th.dark ? 'rgba(255,255,255,0.22)' : 'rgba(22,20,29,0.18)', curveness: 0.15 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 6 } },
        data: nodes.map((n) => ({
          id: String(n.id),
          name: n.name,
          value: n.value,
          symbolSize: 14 + 34 * Math.sqrt(n.value / maxV),
          itemStyle: { color: n.color, borderColor: th.surface, borderWidth: 2 },
        })),
        links: edges.map((e) => ({ source: String(e.a), target: String(e.b), value: e.weight, lineStyle: { width: 1 + 7 * (e.weight / maxW) } })),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Radar                                                                */
/* ------------------------------------------------------------------ */

export function radarOption(th: ChartTheme, indicators: string[], person: { name: string; color: string; values: number[] }, avg: { name: string; values: number[] }): EChartsOption {
  return {
    ...base(th),
    legend: legend(th, true, { left: 'center' }),
    tooltip: tooltip(th, { trigger: 'item' }),
    radar: {
      indicator: indicators.map((name) => ({ name, max: 1 })),
      radius: '64%',
      center: ['50%', '56%'],
      splitNumber: 4,
      axisName: { color: th.ink2, fontSize: 11, fontFamily: FONT },
      splitLine: { lineStyle: { color: th.grid } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: th.grid } },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 8,
        data: [
          { name: avg.name, value: avg.values, lineStyle: { color: th.muted, width: 2, type: 'dashed' }, itemStyle: { color: th.muted, borderColor: th.surface, borderWidth: 2 }, areaStyle: { color: th.muted, opacity: 0.06 } },
          { name: person.name, value: person.values, lineStyle: { color: person.color, width: 2 }, itemStyle: { color: person.color, borderColor: th.surface, borderWidth: 2 }, areaStyle: { color: person.color, opacity: 0.12 } },
        ],
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Eras                                                                 */
/* ------------------------------------------------------------------ */

export function erasOption(
  th: ChartTheme,
  starts: number[],
  totals: number[],
  eras: { start: number; end: number; label: string; color: string }[],
): EChartsOption {
  const mono = th.brand;
  return {
    ...base(th),
    grid: { left: 4, right: 8, top: 36, bottom: 4, containLabel: true },
    tooltip: tooltip(th, {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: th.axis } },
      formatter: (ps: { axisValue: number; value: number }[]) => `<b>${fmtMonth(Number(ps[0]?.axisValue))}</b><br/>${fmtNum(Number(ps[0]?.value))}`,
    }),
    xAxis: { type: 'category', data: starts, boundaryGap: false, ...axis(th, { axisLabel: { color: th.muted, fontSize: 11, hideOverlap: true, formatter: (v: string) => fmtMonthShort(Number(v)) } }) },
    yAxis: valueAxis(th),
    series: [
      {
        type: 'line',
        data: totals,
        smooth: 0.3,
        showSymbol: false,
        symbolSize: 8,
        lineStyle: { width: 2, color: mono },
        itemStyle: { color: mono, borderColor: th.surface, borderWidth: 2 },
        areaStyle: { color: mono, opacity: 0.12 },
        markArea: {
          silent: true,
          data: eras.map((e, k) => [
            {
              xAxis: nearestIndex(starts, e.start),
              name: e.label,
              itemStyle: { color: k % 2 === 0 ? (th.dark ? 'rgba(144,133,233,0.10)' : 'rgba(98,80,214,0.07)') : 'transparent' },
              label: { show: true, position: 'insideTop', color: th.ink2, fontSize: 11, fontWeight: 600, fontFamily: FONT, distance: -26, width: 120, overflow: 'truncate' },
            },
            { xAxis: nearestIndex(starts, e.end - 1) },
          ]),
        },
      },
    ],
  };
}

export const pctFmt = (v: number) => fmtPct(v);
export const durFmt = (v: number) => fmtDuration(v);
