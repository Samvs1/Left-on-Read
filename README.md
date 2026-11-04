# Left on Read

**Your chats, unwrapped.** Drop in a chat export and get a story, a full dashboard, eras, awards and share cards. Think year-in-review meets data science. It works with WhatsApp chat exports, both one-on-one and groups, and **runs entirely in your browser**: nothing is uploaded, ever.

> Not affiliated with, endorsed by or connected to WhatsApp or Meta. "Works with WhatsApp chat exports" just describes the file format we read.

- **Story mode.** 12 to 20 animated, swipeable slides: the first message, who talks most, reply speed, peak hours, your eras, signature words, emoji of the chat, awards and a summary card.
- **Dashboard.** Overview, people, dynamics (initiations, response times, ghosting, double texts, effort balance), time (heatmaps, calendar, eras), words, emojis, media, mood and group dynamics. Every chart has a one-line takeaway, a table view and a text summary for screen readers.
- **Person profiles.** A radar "fingerprint", timing heatmap, reply histogram, signature words, catchphrases and the awards each person won.
- **33 awards** in English and Dutch (The Starter, The Ghost, The Comedian, The Night Owl, The Speedrunner …). Each one is only handed out when the data clearly supports it.
- **Share cards.** 1080×1920 (stories) and 1080×1080 (square) PNGs for the overview, any award, any chart or a head-to-head. Cards never contain message text.
- **Anonymous mode.** Names become playful aliases and message text is hidden, so you can screenshot anything.
- **Compare mode.** Put two chats side by side.
- **Settings drawer.** Conversation gap, ghosting threshold, double-text window, revive threshold, the "Others" cut-off for groups, time-zone shift, date range and media/system filters. Everything recomputes live in a worker.
- **Installable PWA** that works offline (airplane mode included). On Android the installed app shows up in the share sheet, so you can share an export straight from WhatsApp.
- **English and Dutch**, auto-detected, with a toggle. Light and dark themes. Respects `prefers-reduced-motion`.

## Quick start

Requires Node.js 22.12 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173, then click **Try the demo** or drop in a `.txt`/`.zip` export.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (no CSP, so HMR can use its websocket) |
| `npm test` | 152 Vitest tests: parser, engine and i18n |
| `npm run build` | Type-check (app + service worker), SSR prerender build, then the production build into `dist/` |
| `npm run preview` | Serve `dist/` locally, with the production CSP |
| `npm run verify:network` | Headless end-to-end check that **nothing reaches the network** after load (see below) |
| `npm run lighthouse` | Lighthouse (mobile and desktop) for the three static pages |
| `npm run bench` | Parser + engine benchmark on a generated 185,000-message chat |
| `npm run assets` | Regenerates the PWA icons and the Open Graph image |

### How to export a chat

- **iPhone:** open the chat, tap the contact or group name, scroll down, tap **Export Chat** and choose **Without Media**. Save it to Files and pick the `.zip` here.
- **Android:** open the chat, tap **⋮ → More → Export chat** and choose **Without media**. Share it to the installed app, or save it and pick the file here.

`.txt`, `.zip`, drag and drop, the file picker and pasting the raw text all work.

## Deploy

The output is a fully static folder (`dist/`). There is no server and no backend.

### GitHub Pages (one command)

```bash
npm run deploy:gh-pages
```

This builds with `BASE_PATH=/Left-on-Read/` and pushes `dist/` to the `gh-pages` branch. If your repository has a different name, change `BASE_PATH` in that script. Then set **Settings → Pages → Source** to the `gh-pages` branch.

**Or let CI do it:** `.github/workflows/deploy-pages.yml` runs the tests, builds with the right base path and site URL (for the canonical URL and sitemap) and deploys on every push to `main`. Set **Settings → Pages → Source** to **GitHub Actions**.

### Netlify (one command)

```bash
npm run deploy:netlify
```

Or connect the repository in the Netlify UI: `netlify.toml` already sets the build command and publish folder. `public/_headers` sends the CSP and security headers as real HTTP headers.

### Cloudflare Pages

Build command `npm run build`, output directory `dist`. Cloudflare Pages also reads `public/_headers`.

### Environment variables (all optional)

| Variable | Purpose |
|---|---|
| `BASE_PATH` | Sub-path the app is served from, e.g. `/Left-on-Read/`. Defaults to `/`. |
| `SITE_URL` | Absolute origin, e.g. `https://example.com`. Enables canonical URLs, absolute Open Graph image URLs and `sitemap.xml`. |

## Privacy by architecture

Privacy here is enforced by the browser, not just promised:

1. **No servers.** The app is static files. Your chat is read with the File API and analysed in a Web Worker on your device.
2. **A strict Content-Security-Policy** (meta tag in every page, plus HTTP headers on Netlify and Cloudflare) with `connect-src 'none'`. That blocks `fetch`, XHR, WebSockets, EventSource and `sendBeacon`, so the page *cannot* send data anywhere, even if a bug or a compromised dependency tried. `form-action 'self'`, `frame-src 'none'` and `object-src 'none'` close the other exits. The analysis worker is created from a `blob:` URL, so it inherits the same policy.
3. **No third parties at runtime.** Fonts, the chart library and all code are bundled. No analytics, no cookies, no CDNs. The only storage is `localStorage` for your theme and language.
4. **Offline-first.** A service worker precaches everything, so after the first visit the app works in airplane mode.

**Verify it yourself:**

- Open the site, turn on **airplane mode**, then load a chat. Everything still works.
- Or open DevTools → **Network**, load a chat and use the app. Nothing new shows up besides `blob:`/`data:` URLs.
- Or run `npm run build` and then `npm run verify:network`. The script starts `vite preview`, waits for the service worker, **switches the browser offline**, and then loads a `.txt` and a `.zip`, plays the story, opens every dashboard section, searches a word, changes settings, toggles anonymous mode, opens a profile, exports a share card, compares two chats and posts a file through the share target. It records every request and checks that `fetch()` is blocked by the CSP in both the page and the worker. Last run: *37 requests, all 37 answered locally by the service worker cache, 0 reached the network, no page errors.*

## Architecture

```
src/
  parser/   Pure TypeScript, no DOM. Detects iOS/Android formats, date order, 12/24h clocks,
            multilingual system and media placeholders; reads .txt and .zip.
  engine/   Pure TypeScript statistics. prepare() builds columnar features once per chat;
            computeStats() aggregates them for a given Settings object.
  worker/   The Web Worker (Comlink) that owns parsed chats and runs parser + engine.
  ui/       React app: pages, story slides, dashboard, charts (ECharts), share cards.
  i18n/     Typed dictionaries (English bundled, Dutch lazy-loaded), plurals, detection.
  demo/     Seeded generator for realistic duo and group chats in real export formats.
  sw.ts     Service worker: precache, offline navigation, Android share target.
```

**Data flow:** `File` → worker `loadFile` (JSZip or a streaming zip reader for very large archives → decode → `parseChat`) → a small `ChatSummary` goes back to the UI immediately, so the story intro shows while `prepare()` runs → `compute(chatId, settings)` returns `ChatStats` (plain JSON) → React renders. Changing a setting only re-runs `computeStats`, which reuses the prepared features.

Notable decisions:

- **Timestamps are naive wall-clock times**, stored as if they were UTC and always formatted with `timeZone: 'UTC'`. Exports carry no time zone, so this shows the times exactly as they appear in the chat. The time-zone setting shifts them.
- **Hand-written header scanner** instead of a regular expression, plus parallel arrays and a date cache. That's what makes a 200k-message chat parse in well under a second.
- **Columnar features** (typed arrays per message: author, day, hour, word count, flags, token ids) are computed once, so every statistic is a cheap pass over arrays.
- **Prerendered static pages.** The landing, privacy and how-it-works pages are rendered at build time with React SSR and hydrated on the client, so they are fast and indexable. The prerender runs inside Vite's `generateBundle`, so the service worker precaches the final HTML.
- **CSP-friendly by construction.** The only inline script, the pre-paint theme/language boot, is allowed by its SHA-256 hash. Share cards embed fonts as data URLs because the CSP forbids fetching them.

## How the statistics are defined

All thresholds in *italics* are adjustable in the settings drawer.

| Statistic | Definition |
|---|---|
| **Conversation** | Messages that follow each other with less than *6 hours* of silence. The first author is the **initiator** and the last one the **ender**. |
| **Turn** | A run of consecutive messages by the same person. |
| **Response time** | Time from the last message of one turn to the first message of the next turn by someone else, within a conversation. Always reported as **median** and percentiles (P25/P75/P90), never the mean. |
| **Ghosting** | A conversation's last message that nobody else answers within *24 hours* (or the conversation gap, if that is longer). The sender **got ghosted**, the others **ghosted** them. The final conversation of the export is excluded, since a reply may still come. |
| **Double text** | Two messages in a row by the same person, more than *60 minutes* apart, with no reply in between. |
| **Revive** | Starting a conversation after at least *72 hours* of silence. |
| **Effort balance** (duos) | Weighted mix of message share (30%), conversation starts (30%), reply speed (20%) and message length (20%). 50 means perfectly balanced. |
| **Interest trend** | Per month and per person: share of conversation starts, median reply time and message count. Shows who is leaning in and who is drifting off. |
| **Signature words and emojis** | Weighted log-odds ratio with an informative Dirichlet prior (Monroe et al., 2008) comparing one person against everyone else, so rare words cannot win by appearing once. |
| **Catchphrases** | Two- and three-word phrases one person uses far more than the others, from the same log-odds model on n-grams. |
| **Lexical richness** | Mean segmental type-token ratio over 1,000-word windows (MSTTR), so prolific writers are not penalised. |
| **Laughter and the Comedian** | Laughs are detected in many languages (haha, hihi, lol, jaja, kkkk, 😂, 🤣, 💀 …). Each laugh credits the most recent non-laughing message by someone else in the same conversation, within 30 minutes and 6 messages. |
| **Eras** | Binary segmentation (change-point detection) on log-scaled monthly activity, with a noise estimate from the median absolute deviation and a BIC-style penalty. Each segment is labelled by how it compares to the rest: the beginning, the golden era, a quiet era, the comeback … |
| **Mood** | A small hand-made English/Dutch lexicon plus emojis, with negation and intensifiers. Each message gets a score squashed into −1…1 (VADER-style), averaged per day, month and person. A playful estimate, not a lie detector. |
| **Streak** | Longest run of consecutive calendar days with at least one message. |
| **Night owl / early bird** | Share of messages sent from 00:00 to 04:59, and from 05:00 to 07:59. |
| **"Others"** (groups) | People below *2%* of messages are folded into "Others" in charts, so the palette never has to cycle. |
| **Awards** | 33 awards, each with a minimum amount of data and a minimum margin over the runner-up. If nobody qualifies, the award is not handed out. |

The in-app **How it works** page (`/how-it-works/`) explains the same definitions for non-technical readers.

## Supported export formats

- iPhone (`[31/12/2024, 23:59:59] Name: text`) and Android (`31/12/2024, 23:59 - Name: text`) exports, including the variants with dots, dashes and other separators.
- Every date order (DMY, MDY, YMD), detected from the data with a fallback chain. If the guess is wrong, you can switch it in settings.
- 12- and 24-hour clocks, including the narrow no-break space and localized AM/PM markers.
- Invisible characters (LRM, RLM, BOM, zero-width) stripped, multi-line messages joined, authors with colons, emojis or phone numbers handled.
- System messages and media placeholders in English, Dutch, German, French, Spanish, Portuguese, Italian and Turkish, plus "You" in those languages.
- `.txt` (UTF-8 or UTF-16) and `.zip`. Zips over 48 MB are read lazily from the central directory with `DecompressionStream`, so media inside the zip is never loaded into memory.

## Performance

Parsing and statistics run in a Web Worker, with a progress bar, so the UI never freezes. The story intro appears as soon as parsing is done; the heavier statistics follow in the background.

Measured on the production build, in a cloud container whose single-core speed is roughly that of a mid-range phone:

| Chat | First screen (story intro) | Full statistics |
|---|---|---|
| 185,000 messages, 9.8 MB `.txt` | 1.4 s | 1.9 s |

`npm run bench` runs the parser and engine on a generated 185,000-message chat in Node (≈1.6–2.4 s end to end on the same machine).

## Quality

- **Tests:** 152 (67 parser, 82 engine, 3 i18n). The parser tests cover every format, date order and placeholder language; the engine tests check every statistic against hand-computed fixtures.
- **Lighthouse** (mobile/desktop, `npm run lighthouse`): Performance 96–98 / 100, Accessibility 100, Best Practices 100, SEO 91.
  The SEO score loses its points on one audit: Lighthouse fetches `robots.txt` *from inside the page*, and `connect-src 'none'` blocks that request. The file is there and valid; search engines fetch it directly and are not affected. Relaxing the CSP just for an audit would weaken the core privacy guarantee, so we keep it.
- **Accessibility:** keyboard navigable (skip link, focus rings, arrow keys in the story), WCAG AA contrast in both themes, a text summary and table view for every chart, `prefers-reduced-motion` respected everywhere, and every screen is laid out for 360 px wide.
- **Data visualisation:** a fixed-order categorical palette checked for colour-vision deficiencies, stepped separately for dark mode. People keep their colour across every chart.

## Known limitations

- Exports only contain what WhatsApp puts in them: no reactions, no read receipts and, on Android, often no call history. "Ghosting" is about replies, not about who read what.
- An export is a snapshot. Export the chat again to include newer messages. WhatsApp can also cap how many of the most recent messages an export contains, so very old history may be missing.
- Sentiment uses a small English/Dutch lexicon. It is deliberately simple and transparent.
- Very large chats (millions of messages) are limited by the memory of a browser tab.

## Credits

Built with Vite, React, TypeScript, Tailwind CSS, Framer Motion, Apache ECharts, JSZip, html-to-image, Comlink and Workbox. Fonts: Inter and Bricolage Grotesque (SIL Open Font License), bundled locally.
