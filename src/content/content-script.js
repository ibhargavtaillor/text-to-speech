/*
 * Podcastify — content script (CLASSIC script, isolated world)
 *
 * Injected on demand via chrome.scripting.executeScript AFTER vendor/Readability.js,
 * so the global `Readability` is available here. It cannot use ES `import`, so the
 * message-type constants are re-declared inline (kept in sync with shared/messages.js).
 *
 * Responsibilities:
 *   - Extract the main content into ordered, highlightable blocks.
 *   - Paint / scroll the currently spoken block.
 *   - Detect SPA soft navigations and tell the worker to stop.
 *
 * Guard against double injection: executeScript may run this more than once.
 */
(() => {
  if (window.__PODCASTIFY_INJECTED__) return;
  window.__PODCASTIFY_INJECTED__ = true;

  const MSG = {
    EXTRACT: 'EXTRACT',
    HIGHLIGHT_BLOCK: 'HIGHLIGHT_BLOCK',
    HIGHLIGHT_WORD: 'HIGHLIGHT_WORD',
    CLEAR_HIGHLIGHT: 'CLEAR_HIGHLIGHT',
    SPA_NAVIGATED: 'SPA_NAVIGATED',
  };

  const DATA_ATTR = 'data-podcastify-id';
  const MIN_BLOCK_CHARS = 25;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'FOOTER', 'ASIDE', 'FORM', 'BUTTON']);
  const SKIP_ROLES = new Set(['navigation', 'banner', 'complementary', 'contentinfo', 'search', 'menu', 'dialog']);
  const LEAF_RE = /^(P|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE|FIGCAPTION|TD|DD|DT|PRE)$/;

  // ---------------------------------------------------------------------------
  // EXTRACTION
  // ---------------------------------------------------------------------------

  function extractBlocks() {
    const root = locateArticleRoot() || document.body;
    const blocks = [];
    const seen = new Set();
    let counter = nextCounterStart();

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: nodeFilter,
    });

    let el;
    while ((el = walker.nextNode())) {
      const text = normalize(el.innerText || el.textContent || '');
      if (text.length < MIN_BLOCK_CHARS) continue;

      const key = text.slice(0, 140);
      if (seen.has(key)) continue; // dedup repeated CTAs / sidebars / nav echoes
      seen.add(key);

      // Reuse an existing id if we already tagged this node on a previous scan.
      let id = el.getAttribute(DATA_ATTR);
      if (!id) {
        id = `pc-${counter++}`;
        el.setAttribute(DATA_ATTR, id);
      }
      blocks.push({ id, text, charCount: text.length });
    }

    return {
      title: getTitle(),
      url: location.href,
      lang: detectLang(),
      blocks,
    };
  }

  function nodeFilter(node) {
    if (SKIP_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
    const role = node.getAttribute && node.getAttribute('role');
    if (role && SKIP_ROLES.has(role)) return NodeFilter.FILTER_REJECT;
    if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
    if (!isVisible(node)) return NodeFilter.FILTER_REJECT;

    return LEAF_RE.test(node.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
  }

  function isVisible(el) {
    if (el === document.body) return true;
    if (el.offsetParent === null) {
      const s = getComputedStyle(el);
      if (s.position !== 'fixed' && s.position !== 'sticky') return false;
    }
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  }

  // Use Readability (on a CLONE so the live page is never mutated) to decide the
  // best article title/container, then map back onto a live element we can
  // highlight. Falls back to semantic selectors, then <body>.
  function locateArticleRoot() {
    let parsed = null;
    try {
      const clone = document.cloneNode(true);
      parsed = new Readability(clone, { keepClasses: false, charThreshold: 200 }).parse();
    } catch (_) {
      /* Readability can throw on exotic docs — fall through to heuristics. */
    }

    const candidates = document.querySelectorAll(
      'article, main, [role="main"], #content, #main, .post, .article, .entry-content'
    );

    if (parsed && parsed.textContent) {
      const target = normalize(parsed.textContent).slice(0, 200);
      let best = null;
      for (const c of candidates) {
        if (normalize(c.innerText || '').includes(target)) { best = c; break; }
      }
      if (best) return best;
    }

    // No Readability match — pick the visible candidate with the most text.
    let best = null;
    let bestLen = 0;
    for (const c of candidates) {
      if (!isVisible(c)) continue;
      const len = (c.innerText || '').length;
      if (len > bestLen) { bestLen = len; best = c; }
    }
    return best;
  }

  function nextCounterStart() {
    // Continue numbering past any ids assigned on a previous scan (rescan case).
    let max = -1;
    document.querySelectorAll(`[${DATA_ATTR}]`).forEach((n) => {
      const m = /^pc-(\d+)$/.exec(n.getAttribute(DATA_ATTR));
      if (m) max = Math.max(max, +m[1]);
    });
    return max + 1;
  }

  function getTitle() {
    return (
      document.querySelector('article h1, main h1, h1')?.innerText?.trim() ||
      document.title
    );
  }

  function detectLang() {
    return (
      document.documentElement.getAttribute('lang') ||
      document.querySelector('[lang]')?.getAttribute('lang') ||
      'en-US'
    );
  }

  function normalize(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  // ---------------------------------------------------------------------------
  // HIGHLIGHTING
  // ---------------------------------------------------------------------------

  let activeEl = null;

  function injectStyles() {
    if (document.getElementById('podcastify-style')) return;
    const style = document.createElement('style');
    style.id = 'podcastify-style';
    style.textContent = `
      .podcastify-active {
        background: rgba(255, 213, 0, 0.32) !important;
        box-shadow: 0 0 0 2px rgba(255, 213, 0, 0.55) !important;
        border-radius: 3px !important;
        transition: background 0.2s ease !important;
      }`;
    (document.head || document.documentElement).appendChild(style);
  }

  function highlightBlock(blockId) {
    clearHighlight();
    const el = document.querySelector(`[${DATA_ATTR}="${CSS.escape(blockId)}"]`);
    if (!el) return;
    el.classList.add('podcastify-active');
    activeEl = el;
    // Keep spoken text in view but don't aggressively yank if already visible.
    const rect = el.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!inView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearHighlight() {
    if (activeEl) activeEl.classList.remove('podcastify-active');
    activeEl = null;
  }

  // ---------------------------------------------------------------------------
  // SPA NAVIGATION WATCH
  // ---------------------------------------------------------------------------

  function watchSpaNavigation() {
    let lastPath = location.pathname + location.search;
    const onChange = debounce(() => {
      const now = location.pathname + location.search;
      if (now === lastPath) return;
      lastPath = now;
      clearHighlight();
      try {
        chrome.runtime.sendMessage({ type: MSG.SPA_NAVIGATED, url: location.href });
      } catch (_) {}
    }, 250);

    for (const m of ['pushState', 'replaceState']) {
      const orig = history[m];
      history[m] = function (...args) {
        const r = orig.apply(this, args);
        onChange();
        return r;
      };
    }
    window.addEventListener('popstate', onChange);
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  }

  // ---------------------------------------------------------------------------
  // MESSAGE HANDLER
  // ---------------------------------------------------------------------------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case MSG.EXTRACT:
        // Yield a frame so a heavy walk never blocks the click that triggered it.
        requestAnimationFrame(() => {
          try {
            sendResponse(extractBlocks());
          } catch (e) {
            sendResponse({ title: document.title, url: location.href, lang: 'en-US', blocks: [] });
          }
        });
        return true; // async response

      case MSG.HIGHLIGHT_BLOCK:
        highlightBlock(msg.blockId);
        break;

      case MSG.CLEAR_HIGHLIGHT:
        clearHighlight();
        break;
    }
  });

  injectStyles();
  watchSpaNavigation();
})();
