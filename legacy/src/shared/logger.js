// Tiny namespaced logger so logs are filterable and easy to strip later.
const PREFIX = '[Podcastify]';

export const log = {
  info: (...a) => console.log(PREFIX, ...a),
  warn: (...a) => console.warn(PREFIX, ...a),
  error: (...a) => console.error(PREFIX, ...a),
};
