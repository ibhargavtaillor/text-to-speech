import { chunkText } from '@/utils/chunker';
import type { ContentBlock, QueueItem } from '@/types';

/**
 * Owns the flattened utterance queue and the cursor into it. Knows nothing
 * about TTS or Chrome — pure queue mechanics, fully unit-testable.
 */
export class ChunkQueue {
  private items: QueueItem[] = [];
  private cursor = 0;

  get length(): number {
    return this.items.length;
  }

  get index(): number {
    return this.cursor;
  }

  get current(): QueueItem | undefined {
    return this.items[this.cursor];
  }

  /** Replace the queue from a fresh block list and reset the cursor. */
  reset(blocks: ContentBlock[]): void {
    this.items = ChunkQueue.build(blocks);
    this.cursor = 0;
  }

  /** Append chunks for newly discovered blocks without moving the cursor. */
  append(blocks: ContentBlock[]): void {
    this.items.push(...ChunkQueue.build(blocks));
  }

  /** Advance the cursor; returns false when the queue is exhausted. */
  advance(): boolean {
    this.cursor += 1;
    return this.cursor < this.items.length;
  }

  setIndex(index: number): void {
    this.cursor = Math.max(0, Math.min(this.items.length - 1, index));
  }

  /** Index of the first chunk belonging to a block, or -1. */
  firstChunkIndexOf(blockId: string): number {
    return this.items.findIndex((item) => item.blockId === blockId);
  }

  blockIdAt(index: number): string | undefined {
    return this.items[index]?.blockId;
  }

  /** Restore from persisted state (worker rehydration). */
  hydrate(items: QueueItem[], index: number): void {
    this.items = items;
    this.cursor = index;
  }

  snapshot(): { items: QueueItem[]; index: number } {
    return { items: this.items, index: this.cursor };
  }

  private static build(blocks: ContentBlock[]): QueueItem[] {
    return blocks.flatMap((block) =>
      chunkText(block.text).map<QueueItem>((text) => ({ blockId: block.id, text })),
    );
  }
}
