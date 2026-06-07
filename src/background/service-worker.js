// MV3 service worker — message router + tab lifecycle. Stateless wiring around
// a single PlaybackController instance (rehydrated from session storage when the
// worker cold-starts).
import { PlaybackController } from './PlaybackController.js';
import { MSG } from '../shared/messages.js';
import { loadState, loadPrefs } from './stateStore.js';
import { log } from '../shared/logger.js';

const controller = new PlaybackController();

// Cold-start rehydration: the worker may have been evicted mid-session.
const ready = (async () => {
  controller.hydratePrefs(await loadPrefs());
  controller.rehydrate(await loadState());
})();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Events coming back from the offscreen fallback document.
  if (msg.type === MSG.OFFSCREEN && msg.event) {
    controller.tts.handleOffscreenEvent(msg);
    return false;
  }

  (async () => {
    await ready;
    try {
      switch (msg.type) {
        case MSG.START_FROM_POPUP: {
          const tabId = msg.tabId;
          await injectContentScript(tabId);
          const data = await chrome.tabs.sendMessage(tabId, { type: MSG.EXTRACT });
          if (!data || !data.blocks?.length) {
            sendResponse({ error: 'NO_CONTENT', ...controller.snapshot() });
            return;
          }
          await controller.load(tabId, data);
          controller.play();
          sendResponse(controller.snapshot());
          break;
        }

        case MSG.RESCAN: {
          if (controller.tabId == null) { sendResponse(controller.snapshot()); break; }
          await injectContentScript(controller.tabId);
          const data = await chrome.tabs.sendMessage(controller.tabId, { type: MSG.EXTRACT });
          const added = await controller.append(data);
          sendResponse({ ...controller.snapshot(), added });
          break;
        }

        case MSG.PLAY: controller.play(); sendResponse(controller.snapshot()); break;
        case MSG.PAUSE: controller.pause(); sendResponse(controller.snapshot()); break;
        case MSG.RESUME: controller.resume(); sendResponse(controller.snapshot()); break;
        case MSG.STOP: controller.stop(); sendResponse(controller.snapshot()); break;
        case MSG.NEXT: controller.skipNext(); sendResponse(controller.snapshot()); break;
        case MSG.PREV: controller.skipPrev(); sendResponse(controller.snapshot()); break;

        case MSG.SET_PREFS:
          await controller.setPrefs(msg.prefs || {});
          sendResponse(controller.snapshot());
          break;

        case MSG.GET_STATE:
          sendResponse(controller.snapshot());
          break;

        case MSG.SPA_NAVIGATED:
          // Soft navigation in the source tab — the old content is gone.
          if (sender.tab && sender.tab.id === controller.tabId) controller.stop();
          break;

        default:
          sendResponse(controller.snapshot());
      }
    } catch (e) {
      log.error('handler failed', msg.type, e);
      sendResponse({ error: String(e), ...controller.snapshot() });
    }
  })();

  return true; // keep the message channel open for async sendResponse
});

// Hard navigation or tab close in the source tab → stop the audio.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading' && tabId === controller.tabId) controller.stop();
});
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === controller.tabId) controller.stop();
});

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      // Order matters: Readability defines the global the content script uses.
      files: ['src/vendor/Readability.js', 'src/content/content-script.js'],
    });
  } catch (e) {
    // Re-injection on an already-injected page throws harmlessly (guarded).
    log.warn('inject (likely already present):', e?.message);
  }
}
