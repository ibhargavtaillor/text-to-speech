import { BLOCK_ATTR } from '@/constants';
import { emit } from '@/lib/chrome/runtime';
import { MessageType } from '@/types';
import type { ExtractionResult } from '@/types';
import { extractBlocks } from './extractor';

/**
 * Hover-to-select mode. When armed, every readable block gets a hover outline
 * and clicking one tells the worker to play THAT section only. Click is
 * intercepted in the capture phase so we never follow page links.
 */
export class SectionSelector {
  private active = false;
  private hoverEl: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private lastExtraction: ExtractionResult | null = null;

  private readonly onOver = (e: Event): void => this.handleOver(e);
  private readonly onClick = (e: MouseEvent): void => this.handleClick(e);
  private readonly onKey = (e: KeyboardEvent): void => this.handleKey(e);

  enable(): void {
    if (this.active) return;
    this.lastExtraction = extractBlocks();
    if (this.lastExtraction.blocks.length === 0) {
      this.flashHint('No readable sections found');
      return;
    }
    this.active = true;
    document.documentElement.classList.add('podcastify-picking');
    document.addEventListener('mouseover', this.onOver, true);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('keydown', this.onKey, true);
    this.showHint('🎯 Click a section to listen');
  }

  disable(): void {
    if (!this.active) return;
    this.active = false;
    document.documentElement.classList.remove('podcastify-picking');
    document.removeEventListener('mouseover', this.onOver, true);
    document.removeEventListener('click', this.onClick, true);
    document.removeEventListener('keydown', this.onKey, true);
    this.hoverEl?.classList.remove('podcastify-pick-hover');
    this.hoverEl = null;
    this.hideHint();
  }

  private handleOver(e: Event): void {
    const target = e.target as HTMLElement;
    const el = target.closest<HTMLElement>(`[${BLOCK_ATTR}]`);
    if (el === this.hoverEl) return;
    this.hoverEl?.classList.remove('podcastify-pick-hover');
    this.hoverEl = el;
    this.hoverEl?.classList.add('podcastify-pick-hover');
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const el = target.closest<HTMLElement>(`[${BLOCK_ATTR}]`);
    if (!el || !this.lastExtraction) return;
    e.preventDefault();
    e.stopPropagation();
    const blockId = el.getAttribute(BLOCK_ATTR);
    if (blockId) {
      emit({ type: MessageType.SectionPicked, blockId, data: this.lastExtraction });
    }
    this.disable();
  }

  private handleKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.disable();
    }
  }

  private showHint(text: string): void {
    if (!this.hintEl) {
      this.hintEl = document.createElement('div');
      this.hintEl.id = 'podcastify-hint';
      this.hintEl.addEventListener('click', () => this.disable(), { capture: true });
      (document.body ?? document.documentElement).appendChild(this.hintEl);
    }
    this.hintEl.innerHTML = `${text} <span class="pc-esc">Esc to cancel</span>`;
  }

  private hideHint(): void {
    this.hintEl?.remove();
    this.hintEl = null;
  }

  private flashHint(text: string): void {
    this.showHint(text);
    setTimeout(() => this.hideHint(), 1600);
  }
}
