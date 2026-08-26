/**
 * usePushNotifications — subscribe this browser to Web Push.
 *
 * Powers a single opt-in toggle (Settings → Notifications). Deliberately never
 * prompts on its own: `Notification.requestPermission()` fired on page load is
 * the single fastest way to get permanently blocked, because browsers remember
 * a "Block" forever and Chrome hides the prompt entirely for origins that abuse
 * it. The prompt only ever appears inside `enable()`, which only runs from a
 * click.
 *
 * Degrades quietly at every step — unsupported browser, server without VAPID
 * keys configured, permission denied — so a student on an older browser sees a
 * disabled toggle with a reason, never a broken one or an error.
 */

import { useCallback, useEffect, useState } from 'react';
import { getPushKey, subscribePush, unsubscribePush } from '../api/notifications';

// A VAPID key travels as base64url in JSON but PushManager wants raw bytes.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

const isSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export default function usePushNotifications() {
  const [supported] = useState(isSupported);
  // Whether the *server* can send: no VAPID keys means no point offering this.
  const [available, setAvailable] = useState(false);
  const [permission, setPermission] = useState(
    isSupported ? Notification.permission : 'denied'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Reflect reality on mount: the browser is the source of truth for whether
  // this device already has a subscription, not anything we stored.
  useEffect(() => {
    if (!supported) return;

    let cancelled = false;

    (async () => {
      try {
        const { data } = await getPushKey();
        if (cancelled) return;
        setAvailable(Boolean(data?.enabled));

        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(Boolean(existing));
      } catch {
        // A failed probe means "can't offer this", not an error worth showing.
        if (!cancelled) setAvailable(false);
      }
    })();

    return () => { cancelled = true; };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported || busy) return false;

    setBusy(true);
    setError(null);

    try {
      const { data } = await getPushKey();
      if (!data?.enabled || !data.publicKey) {
        setAvailable(false);
        setError('Push notifications are not configured on the server.');
        return false;
      }
      setAvailable(true);

      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        // Not an error — the student said no, which is a valid answer.
        return false;
      }

      const reg = await navigator.serviceWorker.ready;

      // Reuse an existing subscription when there is one. Calling subscribe()
      // twice with a different key throws InvalidStateError, which is what
      // happens after the server's VAPID keys are rotated — unsubscribe first
      // so the new key takes.
      let sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe().catch(() => {});

      sub = await reg.pushManager.subscribe({
        // Required to be true by every browser that ships push: the payload
        // must always result in a visible notification.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      await subscribePush(sub.toJSON());
      setSubscribed(true);
      return true;
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not turn on notifications.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, busy]);

  const disable = useCallback(async () => {
    if (!supported || busy) return;

    setBusy(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // Tell the server first: if unsubscribe() succeeds and the request then
        // fails, the row survives with an endpoint no push service will accept,
        // and every later send burns a request discovering that.
        await unsubscribePush(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }

      setSubscribed(false);
    } catch (err) {
      setError(err?.message || 'Could not turn off notifications.');
    } finally {
      setBusy(false);
    }
  }, [supported, busy]);

  return {
    supported,
    available,
    permission,
    subscribed,
    busy,
    error,
    // Blocked is worth distinguishing: no amount of clicking will fix it, the
    // student has to change it in browser settings, so the UI must say so.
    blocked: permission === 'denied',
    enable,
    disable,
  };
}
