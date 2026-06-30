import { Readability } from '@mozilla/readability';
import { BLOCK_ATTR, MIN_BLOCK_CHARS } from '@/constants';
import { isVisible, normalizeText } from '@/utils/dom';
import type { ContentBlock, ExtractionResult } from '@/types';

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'FOOTER', 'ASIDE', 'FORM', 'BUTTON',
]);
const SKIP_ROLES = new Set([
  'navigation', 'banner', 'complementary', 'contentinfo', 'search', 'menu', 'dialog',
]);
const LEAF_RE = /^(P|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE|FIGCAPTION|TD|DD|DT|PRE)$/;

// Block-level containers that often hold text DIRECTLY on CMS/template sites
// (lyrics, verses, cards) instead of wrapping it in <p>. Without this, such
// content is invisible to extraction and section-pick.
const TEXT_CONTAINER_RE = /^(DIV|SECTION|ARTICLE|MAIN)$/;

// Any block-level descendant. A text container with NONE of these is a "leaf
// container": its own text is a single block, with no nested blocks to
// double-read. Inline children (span/a/strong/…) are intentionally excluded.
const BLOCK_DESCENDANT_SELECTOR =
  'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,dd,dt,pre,div,section,article,main,ul,ol,table';

/**
 * Extract main content as ordered, highlightable blocks.
 *
 * Hybrid strategy: run Readability on a CLONE (never mutate the live page) to
 * decide the best article container, then walk the LIVE DOM inside it so each
 * block id maps back to a real node we can highlight.
 */
export function extractBlocks(): ExtractionResult {
  const root = locateArticleRoot() ?? document.body;
  const blocks: ContentBlock[] = [];
  const seen = new Set<string>();
  let counter = nextCounterStart();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: nodeFilter,
  });

  let node = walker.nextNode();
  while (node) {
    const el = node as HTMLElement;
    const text = normalizeText(el.innerText || el.textContent || '');
    node = walker.nextNode();

    if (text.length < MIN_BLOCK_CHARS) continue;
    const key = text.slice(0, 140);
    if (seen.has(key)) continue; // dedup repeated CTAs / nav echoes
    seen.add(key);

    let id = el.getAttribute(BLOCK_ATTR);
    if (!id) {
      id = `pc-${counter++}`;
      el.setAttribute(BLOCK_ATTR, id);
    }
    blocks.push({ id, text, charCount: text.length });
  }

  return { title: getTitle(), url: location.href, lang: detectLang(), blocks };
}

function nodeFilter(node: Node): number {
  const el = node as HTMLElement;
  if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
  const role = el.getAttribute('role');
  if (role && SKIP_ROLES.has(role)) return NodeFilter.FILTER_REJECT;
  if (el.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
  if (!isVisible(el)) return NodeFilter.FILTER_REJECT;

  if (LEAF_RE.test(el.tagName)) return NodeFilter.FILTER_ACCEPT;
  // Accept a container only when it holds text directly with no block-level
  // descendants (so we never swallow nested blocks or double-read them).
  if (TEXT_CONTAINER_RE.test(el.tagName) && !el.querySelector(BLOCK_DESCENDANT_SELECTOR)) {
    return NodeFilter.FILTER_ACCEPT;
  }
  return NodeFilter.FILTER_SKIP;
}

function locateArticleRoot(): Element | null {
  let parsedText = '';
  try {
    const clone = document.cloneNode(true) as Document;
    const parsed = new Readability(clone, { keepClasses: false, charThreshold: 200 }).parse();
    parsedText = parsed?.textContent ? normalizeText(parsed.textContent).slice(0, 200) : '';
  } catch {
    /* Readability can throw on exotic docs — fall through to heuristics. */
  }

  const candidates = document.querySelectorAll(
    'article, main, [role="main"], #content, #main, .post, .article, .entry-content',
  );

  if (parsedText) {
    for (const candidate of candidates) {
      if (normalizeText((candidate as HTMLElement).innerText || '').includes(parsedText)) {
        return candidate;
      }
    }
  }

  let best: Element | null = null;
  let bestLen = 0;
  for (const candidate of candidates) {
    if (!isVisible(candidate)) continue;
    const len = (candidate as HTMLElement).innerText?.length ?? 0;
    if (len > bestLen) {
      bestLen = len;
      best = candidate;
    }
  }
  return best;
}

function nextCounterStart(): number {
  let max = -1;
  document.querySelectorAll(`[${BLOCK_ATTR}]`).forEach((node) => {
    const match = /^pc-(\d+)$/.exec(node.getAttribute(BLOCK_ATTR) ?? '');
    if (match?.[1]) max = Math.max(max, Number(match[1]));
  });
  return max + 1;
}

function getTitle(): string {
  const heading = document.querySelector<HTMLElement>('article h1, main h1, h1');
  return heading?.innerText?.trim() || document.title;
}

function detectLang(): string {
  return (
    document.documentElement.getAttribute('lang') ||
    document.querySelector('[lang]')?.getAttribute('lang') ||
    'en-US'
  );
}
