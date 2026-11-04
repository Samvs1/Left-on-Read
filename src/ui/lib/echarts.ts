/**
 * Tree-shaken ECharts build, loaded lazily (only the dashboard/story need it).
 * SVG renderer: crisp at any DPI, lighter on phone memory, and serialisable
 * for share cards.
 */
import * as echarts from 'echarts/core';
import {
  BarChart,
  BoxplotChart,
  ChordChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from 'echarts/charts';
import {
  AriaComponent,
  CalendarComponent,
  DataZoomInsideComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  PolarComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  BoxplotChart,
  ChordChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  AriaComponent,
  CalendarComponent,
  DataZoomInsideComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  PolarComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
  SVGRenderer,
]);

export type ECharts = typeof echarts;
export type EChartsOption = echarts.EChartsCoreOption;

export async function loadECharts(): Promise<ECharts> {
  return echarts;
}
export { echarts };
