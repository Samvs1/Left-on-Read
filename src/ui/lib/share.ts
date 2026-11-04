/**
 * Share images. Cards are rendered into an off-screen React root and turned
 * into PNGs with html-to-image. The CSP forbids fetch, so fonts are embedded
 * from bundled data URLs (`fontEmbedCSS`) and nothing is ever requested.
 */
import { createElement, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { toBlob } from 'html-to-image';
import bricolage from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?inline';
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?inline';
import { echarts, type EChartsOption } from './echarts';

const FONT_CSS = `@font-face{font-family:'Bricolage Grotesque Variable';font-style:normal;font-weight:200 800;src:url(${bricolage}) format('woff2');}
@font-face{font-family:'Inter Variable';font-style:normal;font-weight:100 900;src:url(${inter}) format('woff2');}`;

export type ShareFormat = 'story' | 'square';
export const FORMATS: Record<ShareFormat, { w: number; h: number; css: number }> = {
  story: { w: 1080, h: 1920, css: 405 },
  square: { w: 1080, h: 1080, css: 540 },
};

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function renderToPng(element: ReactElement, format: ShareFormat): Promise<Blob> {
  const f = FORMATS[format];
  const cssH = Math.round((f.css * f.h) / f.w);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${f.css}px;height:${cssH}px;overflow:hidden;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement('div', { style: { width: f.css, height: cssH } }, element)));
    await document.fonts?.ready;
    await nextFrame();
    await nextFrame();
    const node = host.firstElementChild as HTMLElement;
    const opts = { pixelRatio: f.w / f.css, fontEmbedCSS: FONT_CSS, cacheBust: false, width: f.css, height: cssH };
    // Safari sometimes drops fonts/images on the first pass; render twice there.
    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) await toBlob(node, opts);
    const blob = await toBlob(node, opts);
    if (!blob) throw new Error('empty image');
    return blob;
  } finally {
    root.unmount();
    host.remove();
  }
}

export type DeliverResult = 'shared' | 'downloaded' | 'cancelled';

/** Native share sheet on phones, download everywhere else. */
export async function deliver(blob: Blob, filename: string, title: string): Promise<DeliverResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** Static SVG for a chart (ECharts server-side rendering mode, no animation). */
export function chartToSvg(option: EChartsOption, width: number, height: number): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height });
  chart.setOption({ ...option, animation: false } as EChartsOption);
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}
