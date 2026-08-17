import { Link } from 'react-router-dom';
import { DatadMark } from '../common/Logo';

// Shared shell for public legal pages (privacy, terms).
export default function LegalLayout({ title, updated, children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center font-semibold">
            <DatadMark size="sm" />
          </Link>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-xs text-gray-400">Last updated: {updated}</p>
        <div className="prose-sm mt-6 space-y-5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {children}
        </div>
      </main>

      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-800">
        DATAD · Built by Dhatchina Moorthi
      </footer>
    </div>
  );
}

export function LegalSection({ heading, children }) {
  return (
    <section>
      <h2 className="mb-1 font-semibold text-gray-900 dark:text-gray-100">{heading}</h2>
      {children}
    </section>
  );
}
