import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load data for a page, with the failure path handled by default.
 *
 * The pattern this replaces — `useState(null)` + `useEffect(() => api().then(setData))`
 * + `if (!data) return <Skeleton/>` — has no rejection handler, so a failed
 * request leaves the page on its skeleton forever with no way back. That is the
 * worst failure mode available: it is indistinguishable from a slow network, so
 * the student waits instead of retrying.
 *
 *   const { data, error, loading, reload } = useAsync(() => listNotes(), []);
 *   if (loading) return <CardGridSkeleton />;
 *   if (error) return <ErrorState onRetry={reload} />;
 *
 * `fn` is called with an AbortSignal; pass it through to axios where the request
 * is worth cancelling. Results from a superseded or unmounted call are dropped
 * either way, so state is never written after unmount.
 */
export default function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);

  // `fn` is almost always an inline arrow, so its identity changes every render.
  // Holding it in a ref keeps `deps` the single source of truth for when to
  // refetch. The ref is seeded at construction and updated in an effect — never
  // written during render.
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // Deliberately inside the promise chain rather than the effect body: a
    // synchronous setState here would cascade an extra render on every load.
    Promise.resolve()
      .then(() => {
        if (!active) return undefined;
        setState((s) => (s.loading && !s.error ? s : { data: s.data, error: null, loading: true }));
        return fnRef.current(controller.signal);
      })
      .then((result) => {
        if (!active) return;
        // Unwrap the axios envelope so callers get the payload, not the response.
        setState({ data: result?.data !== undefined ? result.data : result, error: null, loading: false });
      })
      .catch((err) => {
        // An abort is this hook tidying up after itself, not a failure to show.
        if (!active || err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        setState({ data: null, error: err, loading: false });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
