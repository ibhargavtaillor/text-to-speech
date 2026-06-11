# 🎧 Podcastify — Listen to Any Page

A Chrome (Manifest V3) extension that extracts the main content of a webpage and
reads it aloud as a podcast-style experience: play / pause / resume / stop / skip,
live highlighting of the spoken section, and **click-to-play a single section**.

Built with **React 19 + TypeScript (strict) + Tailwind + Vite (CRXJS)**, organized
with Atomic Design. The legacy vanilla-JS build is preserved under [`legacy/`](legacy/).

## Quick start

```bash
nvm use            # Node 24 (see .nvmrc)
pnpm install
pnpm build         # tsc --noEmit && vite build  →  dist/
# then: chrome://extensions → Developer mode → Load unpacked → select dist/
pnpm dev           # HMR build into dist/ while developing
pnpm typecheck     # strict tsc, no emit
pnpm lint          # eslint (type-aware), 0 warnings allowed
```

## Architecture — React only where it earns its place

A deliberate decision: **the content script and service worker are plain typed
TS modules, not React.** Imperative DOM extraction/highlighting and a background
state machine gain nothing from React and would only pay bundle cost. React +
Tailwind power the **Popup** UI alone.

```
Popup (React)  ⇄  Service Worker (brain: state machine + queue + TTS)  ⇄  Content Script (TS)
                              │
                              └─ Offscreen document (speechSynthesis fallback)
```

| Decision | Reason |
| --- | --- |
| **Typed message contract** (`src/types/messages.ts`) | Every cross-context message is a member of a discriminated union keyed by `type`. `switch (msg.type)` is exhaustively checked; a wrong payload is a compile error. Imported by every surface — no more duplicated `MSG` maps. |
| **Chrome API wrappers** (`src/lib/chrome`) | The only place `chrome.*` is touched. Everything depends on these abstractions (Dependency Inversion), so engines/storage are swappable and testable. |
| **`chrome.tts` over `speechSynthesis`** | Runs in the browser process — survives navigation/tab-switch and is driven from the worker. `speechSynthesis` (offscreen) is the fallback when no `chrome.tts` voices exist. |
| **Worker is the single source of truth** | The popup is destroyed on close and the content script dies on navigation. State lives in the worker, mirrored to `chrome.storage.session` to survive MV3 eviction. |
| **God-object split** | The legacy `PlaybackController` is now `PlaybackController` (state machine) composing `ChunkQueue`, `TtsEngine`, `TabMessenger`, `StateStore` — one responsibility each. |
| **Zustand for the popup** | Popup mirrors worker snapshots and re-renders minimally via selector subscriptions; memoized atomic components skip unchanged props. |
| **Passive content script on `http(s)`** | Declared statically but does nothing until messaged (removes the legacy injection dance and `scripting`/`activeTab`). Trade-off: broader host access than the legacy `activeTab` build — tighten later with `registerContentScripts` if desired. |

## Folder structure (Atomic Design)

```
src/
  assets/                 static assets
  components/
    atoms/                Button, IconButton, Text, Slider, Select
    molecules/            MediaControls, StatusBar, RangeField, VoiceSelect
    organisms/            Header, PlayerPanel
    templates/            PopupLayout
  pages/Popup/            index.html · main.tsx · Popup.tsx (composition only)
  hooks/                  usePlaybackInit, useVoices
  services/               playbackService, voiceService (popup → worker API)
  stores/                 playbackStore (Zustand)
  lib/chrome/             typed wrappers: runtime, storage, tabs, tts, offscreen
  background/             service worker: index + Controller/Queue/Tts/Store/Messenger
  content-scripts/        index + extractor/highlighter/selection/spaWatcher/styles
  offscreen/              speechSynthesis fallback host
  utils/                  chunker, dom, logger, cn
  constants/  types/      design tokens / domain + message + storage contracts
  manifest/               typed MV3 manifest (CRXJS defineManifest)
  styles/                 Tailwind entry + base layer
```

## Features

- Play / Pause / Resume / Stop, ⏮ / ⏭ skip by section
- **🎯 Pick a section** — hover-to-select on the page; click plays only that section
- Live highlight + auto-scroll of the spoken section
- Voice / speed / pitch controls (persisted in `chrome.storage.local`)
- ↻ Rescan for lazy-loaded / infinite-scroll content
- Auto-stop on hard navigation, tab close, and SPA soft navigation
- Chunked utterances (CJK-aware), worker-eviction rehydration, `speechSynthesis` fallback

## Accessibility

Semantic HTML, `aria-label` required on every icon button by construction,
`aria-live` status region, visible focus ring, full keyboard operability.

## Tooling notes

- `pnpm-workspace.yaml` allowlists esbuild's build script (pnpm v11 requirement).
- Strict TypeScript: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, unused locals/params, etc. `any` is an ESLint error.

## Future scope

- Word-level karaoke highlighting (the `HIGHLIGHT_WORD` path is already wired).
- Options page for persisted defaults; export audio via cloud neural TTS.
- Per-block language detection for mixed-language pages.
