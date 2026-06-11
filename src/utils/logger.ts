/** Namespaced, level-aware logger. Strip or silence in one place. */
const PREFIX = '[Podcastify]';

export const logger = {
  info: (...args: unknown[]): void => console.info(PREFIX, ...args),
  warn: (...args: unknown[]): void => console.warn(PREFIX, ...args),
  error: (...args: unknown[]): void => console.error(PREFIX, ...args),
};
