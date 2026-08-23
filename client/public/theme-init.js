/**
 * Theme resolution, before first paint.
 *
 * Mirrors ThemeContext's rule — dark-first, and an explicit saved choice always
 * wins — so a light-theme user never sees a flash of the dark surface. Keep the
 * two in sync.
 *
 * This lives in a file rather than inline in index.html, and the reason is the
 * Content-Security-Policy: `script-src 'self'` blocks inline scripts, and the
 * whole value of that directive comes from NOT adding 'unsafe-inline' back to
 * accommodate one snippet. An inline script that the policy blocks would leave
 * the class unset and reintroduce exactly the flash this code exists to avoid.
 *
 * It must stay a plain synchronous <script src> in <head>, not `defer` or
 * `type="module"` — both defer execution until after the document is parsed,
 * which is after first paint, which defeats the point.
 */
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var dark = saved
      ? saved === 'dark'
      : !window.matchMedia('(prefers-color-scheme: light)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
