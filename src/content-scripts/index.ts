/**
 * Content script entry (passive). At load it only injects styles, starts the
 * SPA watcher, and registers a message listener — no extraction or DOM walking
 * happens until the worker asks for it. This keeps the always-on footprint
 * negligible despite the broad `matches`.
 */
import { injectStyles } from './styles';
import { extractBlocks } from './extractor';
import { Highlighter } from './highlighter';
import { SectionSelector } from './selection';
import { watchSpaNavigation } from './spaWatcher';
import { onTabMessage, emit } from '@/lib/chrome/runtime';
import { MessageType } from '@/types';
import type { ExtractResponse } from '@/types';

const highlighter = new Highlighter();
const selector = new SectionSelector();

injectStyles();

watchSpaNavigation((url) => {
  highlighter.clear();
  selector.disable();
  emit({ type: MessageType.SpaNavigated, url });
});

onTabMessage((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case MessageType.Extract:
      // Yield a frame so a heavy walk never blocks the click that triggered it.
      requestAnimationFrame(() => {
        try {
          sendResponse(extractBlocks() satisfies ExtractResponse);
        } catch {
          sendResponse({
            title: document.title,
            url: location.href,
            lang: 'en-US',
            blocks: [],
          } satisfies ExtractResponse);
        }
      });
      return true; // async response

    case MessageType.HighlightBlock:
      highlighter.highlightBlock(msg.blockId);
      break;
    case MessageType.ClearHighlight:
      highlighter.clear();
      break;
    case MessageType.EnableSelection:
      selector.enable();
      break;
    case MessageType.DisableSelection:
      selector.disable();
      break;
    case MessageType.HighlightWord:
      // Reserved for future word-level karaoke highlighting.
      break;
    default:
      break;
  }
  return undefined;
});
