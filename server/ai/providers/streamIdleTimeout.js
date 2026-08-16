// Wraps an SDK stream (async iterable) so a connection that opens fine but
// then goes idle - no chunk, no error, no close - fails fast instead of
// hanging indefinitely. The OpenAI SDK's own `timeout` option (set on the
// client) only governs the initial request/response; once inside a live
// stream that clock has already served its purpose and does not re-arm per
// chunk, so a provider that stalls mid-stream (observed with NVIDIA under
// network stress) can hold the connection open forever with nothing to show
// for it — no token, no terminal frame, no thrown error — leaving every
// caller (the provider chain, the SSE route, the client's own reader) stuck
// waiting on a promise that will never settle on its own.
const IDLE_TIMEOUT_MS = Number(process.env.AI_STREAM_IDLE_TIMEOUT_MS) || 20000;

async function* withStreamIdleTimeout(stream, ms = IDLE_TIMEOUT_MS) {
  const iterator = stream[Symbol.asyncIterator]();
  try {
    while (true) {
      let timer;
      const timedOut = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Provider stream stalled: no data received for ${ms}ms`)),
          ms
        );
      });
      let result;
      try {
        result = await Promise.race([iterator.next(), timedOut]);
      } finally {
        clearTimeout(timer);
      }
      if (result.done) return;
      yield result.value;
    }
  } finally {
    // Best-effort: let the SDK release the underlying connection when we
    // bail early (timeout, or the caller stops iterating via break/return).
    if (typeof iterator.return === 'function') {
      iterator.return().catch(() => {});
    }
  }
}

module.exports = { withStreamIdleTimeout, IDLE_TIMEOUT_MS };
