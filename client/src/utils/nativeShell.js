/**
 * The things that stop a WebView from feeling like a browser.
 *
 * The layout is already phone-shaped — AppShell has a bottom tab bar, safe-area
 * insets and 44pt targets, and the breakpoints do their job. What gives the
 * shell away is smaller and more physical than layout: a blue flash when you
 * tap, a long-press that selects the nav label instead of doing nothing, a
 * status bar whose clock disappears when the app switches to dark.
 *
 * All of it is native-only and lives here rather than in index.css for two
 * reasons. It must not reach the web bundle — killing text selection or the
 * tap highlight in a real browser removes affordances people rely on there —
 * and a stylesheet injected behind `isNative` cannot leak the way a media
 * query or a `.native` class on <html> eventually does.
 */
import { isNative } from './native';

/**
 * Selection is disabled on chrome only, never on content.
 *
 * The tempting version of this rule is `body { user-select: none }`, which is
 * what most "make it feel native" snippets say. It also means a student cannot
 * select a sentence out of their own note, journal entry or Dax answer — this
 * app is largely a writing app, so that is most of the product. Chrome is the
 * part that should feel like a control surface; the text a student wrote is
 * text, and stays selectable.
 */
const NATIVE_CSS = `
  /* Taps flash a translucent blue rectangle by default. Nothing in a native
     app does this, and it is the single most recognisable WebView tell. */
  * {
    -webkit-tap-highlight-color: transparent;
  }

  button, a, nav, header, label, summary,
  [role="button"], [role="tab"], [role="menuitem"] {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  /* The pull-past-the-end glow, and the rubber-band that reveals a blank strip
     under a fixed bottom tab bar. Content still scrolls; only the overscroll
     chrome goes. */
  html, body {
    overscroll-behavior: none;
  }

  /* The other half of overlaying the status bar. Once the bar is transparent
     the WebView owns those pixels, and without this every sticky header — the
     app shell's and the landing page's alike — renders underneath the clock.
     Applied to body rather than to each header so it cannot be forgotten by
     the next one, and env() falls back to 0px on anything that reports no
     inset. */
  body {
    padding-top: env(safe-area-inset-top, 0px);
  }
`;

let styleApplied = false;

/** Inject the native-only stylesheet. Safe to call more than once. */
export function applyNativeShellStyles() {
  if (!isNative || styleApplied || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.setAttribute('data-native-shell', '');
  el.textContent = NATIVE_CSS;
  document.head.appendChild(el);
  styleApplied = true;
}

/**
 * Point the status bar at the theme the app is actually showing.
 *
 * capacitor.config.json can only state one style, and it states `DARK`
 * permanently. Capacitor's naming is the opposite of the intuition: `Style.Dark`
 * means *light* icons, for a dark background. So the configured value is only
 * ever right in dark mode, and in light mode it asks for white icons on a white
 * status bar. Nothing enforced it either way, which is why the clock survived
 * light mode — but relying on the platform to ignore our own configuration is
 * not a fix.
 *
 * The background is set as well as the style, and that is not redundant.
 * `overlaysWebView: true` is supposed to make the bar transparent and let the
 * page paint behind it, in which case Android ignores this colour. On the
 * emulator it does not overlay — the system paints its own background — so
 * setting only the style produced white icons on a white bar in dark mode, with
 * the clock completely invisible. Setting both is correct under either
 * behaviour: when the bar really does overlay, the colour is ignored rather
 * than wrong.
 *
 * Dynamic import so the plugin is never pulled into the web bundle, and every
 * failure is swallowed: a status bar that did not restyle is a cosmetic
 * problem, and must never take the app down with it.
 */
export async function syncStatusBar(dark) {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Style.Dark means *light* icons — it names the background it is meant for,
    // not the ink. Dark theme therefore wants Style.Dark.
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });

    // Re-assert the overlay at runtime rather than trusting the value in
    // capacitor.config.json, which was observed not to take: the bar kept a
    // system-painted background, so dark mode rendered light icons on a light
    // strip and the clock vanished.
    //
    // setBackgroundColor cannot rescue that on this build. It calls
    // Window.setStatusBarColor, which Android deprecated and made a no-op from
    // API 35 — and we target 36. Overlaying is the only lever that still works:
    // the bar goes transparent and the page paints its own background behind
    // it, which is what makes the colour follow the theme at all.
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    /* Plugin missing, or iOS, where these calls differ. */
  }
}
