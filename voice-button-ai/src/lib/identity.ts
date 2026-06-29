/**
 * Soft client identity for metering/throttling before real auth exists.
 * A random id persisted in localStorage and sent on credit-bearing calls.
 * When accounts land, this is replaced by the authenticated user id.
 */
const KEY = 'vbai:clientId';

export function getClientId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
        `c-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}
