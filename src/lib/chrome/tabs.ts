/** Typed chrome.tabs helpers. Worker→content messages are constrained to TabMessage. */
import type { TabMessage } from '@/types';

export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Send a typed message to a tab's content script. Swallows "no receiver". */
export async function sendToTab<R = void>(
  tabId: number,
  message: TabMessage,
): Promise<R | undefined> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message));
  } catch {
    return undefined;
  }
}

export function onTabUpdated(
  listener: (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => void,
): void {
  chrome.tabs.onUpdated.addListener(listener);
}

export function onTabRemoved(listener: (tabId: number) => void): void {
  chrome.tabs.onRemoved.addListener(listener);
}
