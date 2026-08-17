import { Link } from 'react-router-dom';
import { Home, BookOpen, Briefcase, ArrowLeft } from 'lucide-react';
import { DatadMark } from '../components/common/Logo';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <DatadMark size="lg" />
      </div>

      <p className="mb-2 text-7xl font-black tabular-nums text-gray-200 dark:text-gray-800">404</p>
      <h1 className="mb-2 text-xl font-bold text-gray-800 dark:text-gray-100">Page not found</h1>
      <p className="mb-8 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        This page doesn&rsquo;t exist or may have moved. Head back to a familiar place.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Home className="h-4 w-4" /> Dashboard
        </Link>
        <Link
          to="/study"
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-800 dark:text-gray-300"
        >
          <BookOpen className="h-4 w-4" /> Study
        </Link>
        <Link
          to="/career"
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-800 dark:text-gray-300"
        >
          <Briefcase className="h-4 w-4" /> Career
        </Link>
      </div>

      <Link
        to="/"
        className="mt-8 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <ArrowLeft className="h-3 w-3" /> Back to DATAD
      </Link>
    </div>
  );
}
