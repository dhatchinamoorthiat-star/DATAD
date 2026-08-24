// Manual "add to home screen / install" steps for browsers that never fire
// `beforeinstallprompt`. Without this, iOS was the only platform with a
// fallback, so desktop Safari and Firefox users saw no install path at all.

export function detectBrowser(ua = navigator.userAgent) {
  // Order matters: Edge and Chrome-for-iOS both claim "Chrome"/"Safari".
  if (/fxios|firefox/i.test(ua)) return 'firefox';
  if (/edg(?:e|a|ios)?\//i.test(ua)) return 'edge';
  if (/opr\/|opera/i.test(ua)) return 'opera';
  if (/crios|chrome|chromium/i.test(ua)) return 'chrome';
  if (/safari/i.test(ua)) return 'safari';
  return 'other';
}

export function detectAndroid(ua = navigator.userAgent) {
  return /android/i.test(ua);
}

/**
 * Steps for installing by hand.
 * @returns {{ steps: string[], supported: boolean }} `supported: false` means
 *   this browser cannot install web apps at all, so `steps` explains what to
 *   do instead rather than pretending there is a menu item to find.
 */
export function getInstallInstructions({ isIOS, browser, isAndroid }) {
  if (isIOS) {
    return {
      supported: true,
      steps: [
        'Tap the Share button in Safari',
        'Choose "Add to Home Screen"',
      ],
    };
  }

  if (isAndroid) {
    // Firefox for Android can do this too, unlike its desktop build.
    return {
      supported: true,
      steps: [
        'Open the browser menu (⋮)',
        'Tap "Install app" or "Add to Home screen"',
      ],
    };
  }

  switch (browser) {
    case 'edge':
      return {
        supported: true,
        steps: ['Open the ••• menu', 'Choose Apps → "Install this site as an app"'],
      };
    case 'chrome':
    case 'opera':
      return {
        supported: true,
        steps: ['Open the ⋮ menu', 'Choose "Cast, save and share" → "Install page as app"'],
      };
    case 'safari':
      // Safari 17+ on macOS; older versions have no install path.
      return {
        supported: true,
        steps: ['In the menu bar, choose File', 'Choose "Add to Dock"'],
      };
    case 'firefox':
      return {
        supported: false,
        steps: ['Firefox on desktop cannot install web apps', 'Open datad.online in Chrome, Edge or Safari to install'],
      };
    default:
      return {
        supported: false,
        steps: ['This browser cannot install web apps', 'Open datad.online in Chrome, Edge or Safari to install'],
      };
  }
}
