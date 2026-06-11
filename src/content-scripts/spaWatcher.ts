/**
 * Detects SPA soft navigations (history.pushState / replaceState / popstate),
 * which don't fire chrome.tabs.onUpdated. Debounced so rapid framework route
 * thrash collapses into one event.
 */
export function watchSpaNavigation(onNavigate: (url: string) => void): void {
  let lastPath = location.pathname + location.search;

  const fire = debounce(() => {
    const now = location.pathname + location.search;
    if (now === lastPath) return;
    lastPath = now;
    onNavigate(location.href);
  }, 250);

  (['pushState', 'replaceState'] as const).forEach((method) => {
    const original = history[method].bind(history);
    history[method] = function patched(
      this: History,
      ...args: Parameters<History['pushState']>
    ): void {
      original(...args);
      fire();
    };
  });
  window.addEventListener('popstate', fire);
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A): void => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
