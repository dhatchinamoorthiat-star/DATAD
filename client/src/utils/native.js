/**
 * Am I running inside the Capacitor native shell, or in a browser?
 *
 * The same bundle ships to both, so several things that are correct on the web
 * are wrong in the app and have to be branched on:
 *
 *   - Service worker / Web Push. The shell serves the bundle from its own local
 *     origin, so a worker registered there caches an app the store already
 *     versions, and PWAContext's "a new version is available, reload" prompt is
 *     nonsense next to an App Store update. WKWebView has no PushManager at
 *     all; Android's WebView has a ServiceWorker but no push, which is the
 *     worse case — feature-detection alone says "supported" and then never
 *     delivers anything.
 *   - The API base URL. On the web the API is same-origin (`/api`); in the
 *     shell there is no same origin to be relative to. That one is handled at
 *     build time by client/.env.native rather than here.
 *
 * Asked of @capacitor/core rather than of a bare `window.Capacitor`, even
 * though the native bridge does define that global. The global is injected by
 * the platform, so reading it directly makes this module's answer depend on
 * script ordering inside a WebView we do not control — and the failure mode is
 * silent and one-directional: too early and `isNative` is false in the app,
 * which re-enables exactly the service worker and push toggle this exists to
 * suppress. Going through the package costs a few KB in the web bundle and
 * removes the ordering question entirely.
 *
 * Not detected from the user agent, which is a WebView's and says nothing about
 * who is hosting it.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

/** 'ios' | 'android' | 'web' */
export const nativePlatform = Capacitor.getPlatform();
