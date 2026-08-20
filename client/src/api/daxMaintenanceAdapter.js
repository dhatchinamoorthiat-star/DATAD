// Drop-in replacement for createDaxChatAdapter() while Dax is in maintenance.
//
// Same shape as the real adapter (sendMessage / loadInitialMessages /
// clearRemoteHistory) so nothing downstream in the Dax library changes — but
// it never touches the network. sendMessage returns a plain string, which
// lib/streaming.js reveals word-by-word, so the reply still types out the way
// a real one does.

import { maintenanceReply } from '../dax/maintenance';

// Long enough to read as "thinking", short enough not to feel broken.
const THINKING_MS = 450;

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

export function createDaxMaintenanceAdapter() {
  return {
    async sendMessage({ text, attachments = [], signal }) {
      await wait(THINKING_MS, signal);
      return maintenanceReply(text, attachments);
    },
    // No server history to seed from — local conversations are the only
    // history that exists in maintenance mode.
    async loadInitialMessages() {
      return [];
    },
    async clearRemoteHistory() {},
  };
}
