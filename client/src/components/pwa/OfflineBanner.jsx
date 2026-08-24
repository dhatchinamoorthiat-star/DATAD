import { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { usePWA } from '../../context/PWAContext';

export default function OfflineBanner() {
  const { isOnline } = usePWA();
  const [visible, setVisible] = useState(false);
  const [justOnline, setJustOnline] = useState(false);
  const wentOffline = useRef(false);
  const wasOffline = useRef(false);

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

  if (!visible) return null;

  if (justOnline) {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-emerald-500 px-4 py-2 text-center text-xs font-semibold text-white print:hidden">
        <Wifi className="h-3.5 w-3.5" />
        Back online
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-white print:hidden">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      You&rsquo;re offline — showing your last loaded information
    </div>
  );
}
