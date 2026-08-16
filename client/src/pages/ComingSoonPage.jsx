import { Link } from 'react-router-dom';
import { Sparkles, Home, ArrowLeft } from 'lucide-react';
import { DatadMark } from '../components/common/Logo';

export default function ComingSoonPage({ title = 'This page' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <DatadMark className="text-4xl" />
      </div>

      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        <Sparkles className="h-6 w-6" />
      </div>

      <h1 className="mb-2 text-xl font-bold text-gray-800 dark:text-gray-100">{title} is coming soon</h1>
      <p className="mb-8 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        We're still polishing this part of DATAD. Check back soon.
      </p>

      <Link
        to="/"
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        <Home className="h-4 w-4" /> Dashboard
      </Link>

      <Link
        to="/"
        className="mt-8 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <ArrowLeft className="h-3 w-3" /> Back to DATAD
      </Link>
    </div>
  );
}
