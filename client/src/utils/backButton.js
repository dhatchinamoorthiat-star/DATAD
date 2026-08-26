/**
 * Android hardware back button.
 *
 * Capacitor's default is `webView.goBack()`, exiting the app when there is no
 * history left. That is right for the navigation half and wrong for everything
 * layered on top of it: with a dialog open, back navigates the page *behind*
 * the dialog, which stays on screen over a route the student never asked for.
 * On Android, back is the close gesture — the same way Escape is on a keyboard —
 * so an overlay has to consume it before navigation ever sees it.
 *
 * The overlay half is a registry rather than history manipulation. The obvious
 * alternative is to push a history entry when a dialog opens and pop it on
 * close, which makes back "just work" — until a dialog is closed by its X
 * button, or by the action inside it succeeding, and now there is a phantom
 * entry that swallows the next back press. A stack of dismiss callbacks has no
 * such coupling: whoever is on top is asked to close itself, and nothing
 * touches history.
 *
 * A stack, not a single slot, because dialogs nest — a confirm raised from
 * inside another dialog must close only itself.
 *
 * Everything here is a no-op on the web. The listener is only ever attached
 * inside the shell (there is no hardware back button in a browser; the
 * browser's own back is history, which React Router already handles), and
 * push()/registration stay cheap so call sites need no `isNative` branch of
 * their own.
 */

import { App } from '@capacitor/app';
import { isNative } from './native';
import toast from './toast';

/** Dismiss callbacks, innermost last. */
const dismissers = [];

/**
 * Register something that back should close instead of navigating.
 * Returns the unregister function — call it on close *and* on unmount.
 */
export function pushDismissable(onDismiss) {
  if (!isNative) return () => {};

  const entry = { onDismiss };
  dismissers.push(entry);

  return () => {
    // Spliced by identity, not popped. An overlay can be closed by its own X,
    // by Escape, or by the route changing underneath it, and those do not
    // unwind in stack order — popping blind would unregister whichever dialog
    // happens to be on top rather than the one that actually closed.
    const i = dismissers.indexOf(entry);
    if (i !== -1) dismissers.splice(i, 1);
  };
}

// Two back presses within this window exit the app.
const EXIT_CONFIRM_MS = 2000;
let exitArmed = 0;

/**
 * Attach the listener. Call once, from the app root.
 * Returns a cleanup function.
 */
export function installBackButtonHandler() {
  if (!isNative) return () => {};

  const handle = App.addListener('backButton', ({ canGoBack }) => {
    // 1. An overlay is open — close the innermost one and stop.
    if (dismissers.length) {
      dismissers[dismissers.length - 1].onDismiss();
      return;
    }

    // 2. Ordinary navigation. `canGoBack` is the WebView's own history depth,
    //    which BrowserRouter drives via pushState, so this covers routes.
    if (canGoBack) {
      window.history.back();
      return;
    }

    // 3. Root of history. Capacitor would exit immediately; a single stray tap
    //    then closes the app mid-task, and on a fresh launch the student is
    //    back at the landing page having lost whatever was on screen. Ask for
    //    the press twice — the standard Android affordance, and the toast is
    //    what makes it discoverable rather than feeling like a missed tap.
    const now = Date.now();
    if (now - exitArmed < EXIT_CONFIRM_MS) {
      App.exitApp();
      return;
    }
    exitArmed = now;
    toast.info('Press back again to exit');
  });

  return () => {
    // addListener resolves to the handle in Capacitor 6+, so this is a promise.
    Promise.resolve(handle).then((h) => h.remove());
  };
}
