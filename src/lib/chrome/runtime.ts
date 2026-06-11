/**
 * Typed chrome.runtime messaging.
 *
 * `sendCommand` infers its response from the request type via ResponseMap, so
 * popup code never casts. `onRuntimeMessage` narrows the incoming union and
 * supports async responses (returns `true` to keep the channel open).
 */
import type {
  PopupCommand,
  ResponseMap,
  RuntimeMessage,
  TabMessage,
  MessageTypeValue,
} from '@/types';

type CommandResponse<C extends PopupCommand> = C['type'] extends keyof ResponseMap
  ? ResponseMap[C['type']]
  : never;

export async function sendCommand<C extends PopupCommand>(
  command: C,
): Promise<CommandResponse<C>> {
  return (await chrome.runtime.sendMessage(command));
}

/** Fire-and-forget a runtime message (broadcasts, content→worker events). */
export function emit(message: RuntimeMessage): void {
  void chrome.runtime.sendMessage(message).catch(() => {
    /* no receiver (e.g. popup closed) — expected */
  });
}

export type RuntimeHandler = (
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

export function onRuntimeMessage(handler: RuntimeHandler): void {
  chrome.runtime.onMessage.addListener(handler);
}

/**
 * Content-script side: only TabMessages arrive here (worker→content). Narrows
 * the message to the TabMessage union so the handler switch is type-checked.
 */
export type TabHandler = (
  message: TabMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

export function onTabMessage(handler: TabHandler): void {
  // Content-script listeners only ever receive TabMessages from the worker;
  // chrome's loose listener signature accepts the narrowed TabHandler directly.
  chrome.runtime.onMessage.addListener(handler);
}

/** Subscribe to a single broadcast message type; returns an unsubscribe fn. */
export function onMessageType<T extends MessageTypeValue>(
  type: T,
  handler: (message: Extract<RuntimeMessage, { type: T }>) => void,
): () => void {
  const listener = (message: RuntimeMessage): void => {
    if (message.type === type) {
      handler(message as Extract<RuntimeMessage, { type: T }>);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
