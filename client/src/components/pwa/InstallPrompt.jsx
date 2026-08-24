import { X, Download, Zap, WifiOff, Bell } from 'lucide-react';
import { usePWA } from '../../context/PWAContext';
import { getInstallInstructions } from '../../utils/installInstructions';

export default function InstallPrompt() {
  const {
    showInstallPrompt, installed, isIOS, isAndroid, browser, installMode,
    installApp, dismissInstall,
  } = usePWA();

  if (!showInstallPrompt || installed) return null;

  const manual = installMode === 'manual';
  const { steps, supported } = getInstallInstructions({ isIOS, browser, isAndroid });

  return (
    <div
      role="dialog"
      aria-label="Install DATAD app"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-4 right-4 z-[60] animate-in lg:bottom-6 lg:left-auto lg:right-6 lg:w-80"
    >
      <div className="rounded-2xl border border-indigo-200/60 bg-white shadow-2xl shadow-indigo-500/10 dark:border-indigo-800/40 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
            <img src="/icon.svg" alt="DATAD" className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white">Install DATAD</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Add to your home screen</p>
          </div>
          <button
            onClick={dismissInstall}
            aria-label="Dismiss install prompt"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Benefits — omitted when this browser can't install at all, since
            there's nothing the user can do here to get them. */}
        <ul className={`mx-4 mb-4 space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60 ${supported ? '' : 'hidden'}`}>
          <li className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
            <Zap className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
            Opens instantly from your home screen
          </li>
          <li className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
            <WifiOff className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
            Works offline — notes, planner &amp; journal
          </li>
          <li className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
            <Bell className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
            Placement alerts &amp; daily briefing
          </li>
        </ul>

        {/* Actions */}
        {manual ? (
          /* No install API here (iOS Safari, desktop Safari, Firefox, or a
             Chrome that never fired the event) — walk the user through it. */
          <div className="px-4 pb-4">
            <ol className="mb-3 space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-900/20">
              {steps.map((step, i) => (
                <li key={step} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                    {supported ? i + 1 : '!'}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <button
              onClick={dismissInstall}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={installApp}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800"
            >
              <Download className="h-4 w-4" />
              Install
            </button>
            <button
              onClick={dismissInstall}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
