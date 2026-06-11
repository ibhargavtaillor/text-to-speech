import { BLOCK_ATTR } from '@/constants';

/**
 * Paints and scrolls the currently spoken block. Block-level (not word-level)
 * highlighting is robust across nested inline markup and cheap to render.
 */
export class Highlighter {
  private activeEl: HTMLElement | null = null;

  highlightBlock(blockId: string): void {
    this.clear();
    const el = document.querySelector<HTMLElement>(`[${BLOCK_ATTR}="${CSS.escape(blockId)}"]`);
    if (!el) return;
    el.classList.add('podcastify-active');
    this.activeEl = el;

    const rect = el.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!inView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  clear(): void {
    this.activeEl?.classList.remove('podcastify-active');
    this.activeEl = null;
  }
}
