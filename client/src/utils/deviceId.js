/**
 * A stable per-browser identifier, used to count and list active sessions.
 *
 * This is NOT a security token and proves nothing — a determined user can read
 * it, copy it, or clear it. It exists so the server can cap how many devices
 * hold a live session at once and show the student a "Your devices" list they
 * can evict from. Making account sharing inconvenient and visible is the goal;
 * making it impossible is not achievable in a browser.
 *
 * Deliberately random rather than fingerprinted: fingerprints are unstable
 * across browser updates and useless in private windows, so gating on one
 * locks out paying users. It also survives logout — AuthContext.logout clears
 * the token and `dax:` keys, and this key is intentionally not among them, so
 * signing back in on the same browser reuses the same device slot instead of
 * consuming a new one every time.
 */

const KEY = 'datad-device-id';

function generate() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Older browsers: 16 random bytes, hex encoded.
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = generate();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Storage blocked (private mode, embedded webview). A per-tab id still
    // lets the request through; it just consumes a device slot each time.
    return generate();
  }
}
