const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Compact, URL-safe, time-sortable identifier: base36 timestamp + random suffix.
 * Uses `crypto.getRandomValues` when available (Node, browsers, Hermes) and falls back to Math.random.
 */
export function generateId(prefix = ''): string {
  const time = Date.now().toString(36);
  const bytes = new Uint8Array(10);
  const cryptoObj = (
    globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }
  ).crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let random = '';
  for (const byte of bytes) random += ALPHABET[byte % ALPHABET.length];
  return prefix ? `${prefix}_${time}${random}` : `${time}${random}`;
}
