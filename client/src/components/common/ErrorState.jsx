import { AlertCircle, RotateCw } from 'lucide-react';

// Shown when a page's data fails to load. The point is to replace an infinite
// skeleton with something that (a) says the load failed and (b) offers a retry,
// so a dropped request costs a tap rather than a page reload.
export default function ErrorState({
  title = 'Could not load this',
  message = 'Something went wrong on our side. Check your connection and try again.',
  onRetry,
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center rounded-2xl border border-gray-200/80 bg-white px-6 py-12 text-center dark:border-gray-800/80 dark:bg-gray-900 ${className}`}
    >
      <AlertCircle className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary-400 hover:text-primary-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-primary-700 dark:hover:text-primary-400"
        >
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}
