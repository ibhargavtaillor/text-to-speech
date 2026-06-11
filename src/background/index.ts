/**
 * MV3 service worker entry. Stateless router around a single PlaybackController
 * (rehydrated on cold start). Narrows the typed RuntimeMessage union and
 * delegates; the controller holds all state.
 */
import { PlaybackController } from './PlaybackController';
import { StateStore } from './StateStore';
import { onRuntimeMessage } from '@/lib/chrome/runtime';
import { sendToTab, onTabUpdated, onTabRemoved } from '@/lib/chrome/tabs';
import { logger } from '@/utils/logger';
import { MessageType } from '@/types';
import type { ExtractResponse, PlaybackSnapshot, RuntimeMessage } from '@/types';

const controller = new PlaybackController();

const ready: Promise<void> = (async () => {
  controller.hydratePrefs(await StateStore.loadPrefs());
  controller.rehydrate(await StateStore.loadState());
})();

onRuntimeMessage((message, sender, sendResponse) => {
  const msg = message;

  // Offscreen fallback events are synchronous — handle and return early.
  if (msg.type === MessageType.OffscreenEvent) {
    // The engine lives inside the controller; expose a thin forwarder.
    controllerHandleOffscreen(msg);
    return false;
  }

  void (async () => {
    await ready;
    try {
      const response = await route(msg, sender);
      sendResponse(response);
    } catch (error) {
      logger.error('handler failed', msg.type, error);
      sendResponse({ ...controller.snapshot(), error: String(error) });
    }
  })();

  return true; // async sendResponse
});

async function route(
  msg: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
): Promise<PlaybackSnapshot | (PlaybackSnapshot & { added?: number; error?: string }) | void> {
  switch (msg.type) {
    case MessageType.StartFromPopup: {
      const data = await sendToTab<ExtractResponse>(msg.tabId, {
        type: MessageType.Extract,
      });
      if (!data || data.blocks.length === 0) {
        return { ...controller.snapshot(), error: 'NO_CONTENT' };
      }
      await controller.load(msg.tabId, data);
      controller.play();
      return controller.snapshot();
    }

    case MessageType.Rescan: {
      const tabId = controller.currentTabId;
      if (tabId == null) return controller.snapshot();
      const data = await sendToTab<ExtractResponse>(tabId, { type: MessageType.Extract });
      const added = data ? await controller.append(data) : 0;
      return { ...controller.snapshot(), added };
    }

    case MessageType.EnterPick: {
      await sendToTab(msg.tabId, { type: MessageType.EnableSelection });
      return controller.snapshot();
    }

    case MessageType.SectionPicked: {
      const tabId = sender.tab?.id;
      if (tabId == null || msg.data.blocks.length === 0) return controller.snapshot();
      await controller.playSection(tabId, msg.data, msg.blockId);
      return controller.snapshot();
    }

    case MessageType.SpaNavigated:
      if (sender.tab?.id === controller.currentTabId) controller.stop();
      return;

    case MessageType.Play:
      controller.play();
      return controller.snapshot();
    case MessageType.Pause:
      controller.pause();
      return controller.snapshot();
    case MessageType.Resume:
      controller.resume();
      return controller.snapshot();
    case MessageType.Stop:
      controller.stop();
      return controller.snapshot();
    case MessageType.Next:
      controller.skipNext();
      return controller.snapshot();
    case MessageType.Prev:
      controller.skipPrev();
      return controller.snapshot();
    case MessageType.SetPrefs:
      await controller.setPrefs(msg.prefs);
      return controller.snapshot();
    case MessageType.GetState:
      return controller.snapshot();

    default:
      return controller.snapshot();
  }
}

// The controller encapsulates its engine; forward offscreen events through a
// dedicated method to avoid leaking the engine instance.
function controllerHandleOffscreen(
  msg: Extract<RuntimeMessage, { type: typeof MessageType.OffscreenEvent }>,
): void {
  controller.handleOffscreenEvent(msg);
}

// Stop on hard navigation / tab close of the source tab.
onTabUpdated((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && tabId === controller.currentTabId) {
    controller.stop();
  }
});
onTabRemoved((tabId) => {
  if (tabId === controller.currentTabId) controller.stop();
});
