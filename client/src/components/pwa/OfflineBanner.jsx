import { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { usePWA } from '../../context/PWAContext';
import { useToast } from '../../context/ToastContext';

// Stable id so background sync owns exactly one toast that we can replace or
// dismiss, rather than stacking a new one per tick. Connectivity itself
// (offline/back online) is signalled by the sticky banner below only — it's
// always on-screen while relevant, so a toast for the same transition would
// just be a duplicate, not a second useful signal.
const SYNC_TOAST_ID = 'connectivity:syncing';

export default function OfflineBanner() {
  const { isOnline, syncing } = usePWA();
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [justOnline, setJustOnline] = useState(false);
  const wentOffline = useRef(false);
  const wasOffline = useRef(false);

  // Connectivity transitions only. `syncing` is deliberately excluded: it
  // flips independently of the connection, and including it re-fired the
  // offline/online toasts on every sync tick.
  // Synchronising with the browser's connectivity state — the exact job an
  // effect exists for. The rule cannot distinguish it from derived state.
  useEffect(() => {
    if (!isOnline) {
      wentOffline.current = true;
      wasOffline.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      setJustOnline(false);
      return undefined;
    }

    if (!wentOffline.current) return undefined;

    wentOffline.current = false;
    wasOffline.current = false;
    setJustOnline(true);
    const t = setTimeout(() => {
      setVisible(false);
      setJustOnline(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [isOnline]);

  // Sync progress is its own signal, reported separately from connectivity.
  useEffect(() => {
    if (!isOnline) return undefined;
    if (syncing) {
      toast.info('Syncing your changes…', {
        id: SYNC_TOAST_ID,
        duration: 0,
        icon: '🔄',
      });
      return undefined;
    }
    toast.dismiss(SYNC_TOAST_ID);
    return undefined;
  }, [isOnline, syncing, toast]);

  if (!visible) return null;

  if (justOnline) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-emerald-500 px-4 py-2 text-center text-xs font-semibold text-white print:hidden">
        {syncing ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Syncing your changes…
          </>
        ) : (
          <>
            <Wifi className="h-3.5 w-3.5" />
            Back online
          </>
        )}
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-white print:hidden">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      You&rsquo;re offline — showing last synced information
    </div>
  );
}
