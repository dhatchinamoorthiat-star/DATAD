import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import { reportError } from '../../utils/reportError';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'Unknown error' };
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', err, info);
    // This boundary sits inside the Sentry boundary in main.jsx, and a React
    // boundary stops propagation — so catching here previously meant the error
    // reached a console and nothing else. Every section crash a student
    // actually saw was invisible to us.
    reportError(err, { componentStack: info?.componentStack, kind: 'ReactRenderError' });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-100">This section hit an unexpected error</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            The rest of DATAD is fine and none of your data was lost — this section just failed to
            render, usually after a flaky network response. Refreshing almost always fixes it.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Refresh this page
          </button>
          <a
            href="/"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }
}
