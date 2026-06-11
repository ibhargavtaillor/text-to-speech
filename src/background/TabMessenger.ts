import { sendToTab } from '@/lib/chrome/tabs';
import { MessageType } from '@/types';

/**
 * Sends highlight/selection commands to the content script of a specific tab.
 * Centralizes the "which tab am I driving" concern so the controller just calls
 * intent-named methods.
 */
export class TabMessenger {
  constructor(private tabId: number | null = null) {}

  setTab(tabId: number | null): void {
    this.tabId = tabId;
  }

  highlightBlock(blockId: string): void {
    void this.send({ type: MessageType.HighlightBlock, blockId });
  }

  highlightWord(blockId: string, charIndex: number): void {
    void this.send({ type: MessageType.HighlightWord, blockId, charIndex });
  }

  clearHighlight(): void {
    void this.send({ type: MessageType.ClearHighlight });
  }

  enableSelection(): void {
    void this.send({ type: MessageType.EnableSelection });
  }

  disableSelection(): void {
    void this.send({ type: MessageType.DisableSelection });
  }

  private async send(message: Parameters<typeof sendToTab>[1]): Promise<void> {
    if (this.tabId == null) return;
    await sendToTab(this.tabId, message);
  }
}
