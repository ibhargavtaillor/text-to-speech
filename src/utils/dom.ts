/** Pure DOM helpers for the content script. */

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Whether an element is rendered and not visually hidden. */
export function isVisible(el: Element): boolean {
  if (el === document.body) return true;
  const htmlEl = el as HTMLElement;
  if (htmlEl.offsetParent === null) {
    const style = getComputedStyle(el);
    if (style.position !== 'fixed' && style.position !== 'sticky') return false;
  }
  const style = getComputedStyle(el);
  return (
    style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0'
  );
}
