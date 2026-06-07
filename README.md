# 🎧 Podcastify — Listen to Any Page

A Chrome (Manifest V3) extension that extracts the main content of a webpage and
reads it aloud as a podcast-style experience, with play / pause / resume / stop /
skip controls and live highlighting of the spoken section.

## Why these choices

| Decision | Reason |
| --- | --- |
| **`chrome.tts` in the service worker** (not `speechSynthesis` in a page) | `speechSynthesis` lives on `window` and dies on navigation / tab switch / SPA re-render, and can't be driven from a popup. `chrome.tts` runs in the browser process, survives navigation, and emits `word`/`sentence` boundary events for highlighting. |
| **`speechSynthesis` fallback via an offscreen document** | Used only when `chrome.tts` reports zero voices (some Linux/ChromeOS setups). A worker has no `window`, so the fallback needs an offscreen host. |
| **Readability.js for extraction** | Battle-tested article-detection (Firefox Reader View). We run it on a *clone*, use it to locate the live article container, then walk the live DOM to attach highlightable ids. |
| **Service worker is the single source of truth** | The popup is destroyed on close and the content script dies on navigation. Playback state lives in the worker, mirrored to `chrome.storage.session` to survive MV3 worker eviction. |
| **`activeTab` + on-demand injection** (no `<all_urls>`) | Minimal-permission footprint; nothing runs on pages the user never activates. |

## Architecture

```
Popup (remote control)  ⇄  Service Worker (brain: state + queue + TTS)  ⇄  Content Script (extract + highlight)
                                         │
                                         └─ Offscreen doc (speechSynthesis fallback)
```

- **Popup** holds no state — asks the worker for a snapshot, listens for pushes.
- **Service worker** owns the `PlaybackController` (state machine + chunk queue) and the `TtsEngine`.
- **Content script** is a classic script injected after `Readability.js`; extracts ordered blocks and paints the active one.

## File structure

```
manifest.json
src/
  background/   service-worker.js · PlaybackController.js · TtsEngine.js · stateStore.js
  content/      content-script.js          (extractor + highlighter + SPA watcher)
  popup/        popup.html · popup.css · popup.js
  offscreen/    offscreen.html · offscreen.js   (speechSynthesis fallback)
  shared/       messages.js · chunker.js · logger.js
  vendor/       Readability.js              (@mozilla/readability)
icons/          16 · 32 · 48 · 128
```

## Load & run

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (`cm/`).
4. Open any article, click the 🎧 toolbar icon, hit **▶ Play**.

> Requires Chrome 116+ (offscreen API). The placeholder icons in `icons/` are
> generated solid swatches — swap in real artwork before publishing.

## Controls & features

- Play / Pause / Resume / Stop
- ⏮ / ⏭ skip by section (block)
- Live highlight + auto-scroll of the spoken section
- Voice / speed / pitch selectors (persisted in `chrome.storage.local`)
- **↻ Scan page again** — re-extract to pick up lazy-loaded / infinite-scroll content and append it to the queue
- Auto-stop on hard navigation, tab close, and SPA soft navigation

## Edge cases handled

- No clear article → falls back to the largest visible content container, then `<body>`.
- Very long content → chunked into ≤240-char utterances (engine limits + responsive events).
- Multilingual → language from `<html lang>`; CJK-aware sentence splitting.
- Duplicate / nav / ad / hidden nodes → dedup + tag/role/visibility filters.
- Worker eviction → state rehydrated from session storage.

## Future scope

- Export audio (cloud neural TTS → `MediaRecorder` in the offscreen doc).
- Per-block language detection for mixed-language pages.
- Word-level karaoke highlighting (boundary events are already wired).
- Resume-from-section across visits; multi-tab listening playlist.

## Updating Readability

```
curl -sSL -o src/vendor/Readability.js \
  https://raw.githubusercontent.com/mozilla/readability/main/Readability.js
```

Licensed under Apache-2.0 (Mozilla).
