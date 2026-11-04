/**
 * Fonts for the Wrapped canvas. The display face is the width-axis build of
 * Bricolage Grotesque, so headlines can run condensed like a poster. The
 * files are bundled (same origin, precached by the service worker).
 */
import latin from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wdth-normal.woff2?url';
import latinExt from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-ext-wdth-normal.woff2?url';
import { resetTextCache } from './draw';

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

let ready: Promise<void> | null = null;

export function loadWrappedFonts(): Promise<void> {
  ready ??= (async () => {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    try {
      const faces = [
        new FontFace('LOR Wrapped', `url(${latin}) format('woff2')`, { weight: '200 800', stretch: '75% 100%', unicodeRange: LATIN }),
        new FontFace('LOR Wrapped', `url(${latinExt}) format('woff2')`, { weight: '200 800', stretch: '75% 100%', unicodeRange: LATIN_EXT }),
      ];
      await Promise.all(
        faces.map(async (f) => {
          await f.load();
          document.fonts.add(f);
        }),
      );
    } catch {
      /* The regular display font is the fallback. */
    }
    await Promise.all([
      document.fonts.load('800 100px "LOR Wrapped"'),
      document.fonts.load('800 100px "Bricolage Grotesque Variable"'),
      document.fonts.load('600 40px "Inter Variable"'),
      document.fonts.load('800 40px "Inter Variable"'),
    ]).catch(() => undefined);
    resetTextCache();
  })();
  return ready;
}
