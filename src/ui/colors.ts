/**
 * Data colours. The categorical person palette is validated with the dataviz
 * checker (fixed order; adjacent CVD ΔE ≥ 8.4 and normal-vision ΔE ≥ 19.3 in
 * both modes; the first three slots also pass all-pairs). Colour follows the
 * person (their global index), never their rank in a filtered view.
 */
export const PERSON_LIGHT = ['#6250d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#2a78d6', '#e34948'];
export const PERSON_DARK = ['#9085e9', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#3987e5', '#e66767'];
export const OTHERS_LIGHT = '#9b97a6';
export const OTHERS_DARK = '#6e697a';

export function personColor(i: number, dark: boolean): string {
  if (i < 0 || i >= PERSON_LIGHT.length) return dark ? OTHERS_DARK : OTHERS_LIGHT;
  return (dark ? PERSON_DARK : PERSON_LIGHT)[i]!;
}

/** Text on a person-coloured fill: white, except near-black on yellow. */
export function onPersonColor(i: number): string {
  return i === 3 ? '#0b0b0b' : '#ffffff';
}

/** Sequential (one hue, violet) for heatmaps. Dark mode flips the anchor: low values sink into the surface. */
export const SEQ_LIGHT = ['#f3f0fe', '#e0d9fc', '#c8bcf9', '#ab9cf3', '#8f7cea', '#7560dc', '#5d48c5', '#4a37a3', '#382a7f'];
export const SEQ_DARK = ['#211d31', '#2b2547', '#372f60', '#453a7c', '#56489a', '#6a5ab8', '#8172d0', '#9d91e3', '#c2b9f5'];

/** Diverging for mood: red (negative) ↔ grey ↔ blue (positive). */
export const DIV_NEG = { light: '#e34948', dark: '#e66767' };
export const DIV_POS = { light: '#2a78d6', dark: '#3987e5' };
export const DIV_MID = { light: '#d9d6cf', dark: '#3a3742' };

export interface ChartTheme {
  dark: boolean;
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  brand: string;
  seq: string[];
}

export function chartTheme(dark: boolean): ChartTheme {
  return dark
    ? { dark, surface: '#17151f', ink: '#f2efe9', ink2: '#c6c1cf', muted: '#8f8a9a', grid: '#2a2734', axis: '#3b3846', brand: '#9085e9', seq: SEQ_DARK }
    : { dark, surface: '#ffffff', ink: '#16141d', ink2: '#57536a', muted: '#878296', grid: '#ebe8e2', axis: '#cfcbc3', brand: '#6250d6', seq: SEQ_LIGHT };
}
