import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CONSENT_CLAUSES, CONSENT_SUMMARY, LEGAL_UPDATED_LABEL, LEGAL_VERSIONS } from '../../constants/legal';
import useReadGate from '../../hooks/useReadGate';

// The half of a login that stopped for consent.
//
// It exists because the acceptance recorded at signup only covers the terms
// that were published at signup. Accounts made before consent was collected
// have no record at all, and accounts that accepted an earlier revision have
// not agreed to the current one — treating either as consenting would make the
// whole record decorative. So login stops here, once, per revision.
//
// The rules are the same ones signup applies, and the reading gate is literally
// the same hook: scroll to the end, then three unticked boxes. What differs is
// only the skin, because this screen sits inside the login terminal rather than
// the signup shell. If the two ever disagreed, the weaker one would become the
// real policy — which is why the legal copy and the gate live in shared modules
// and only the markup is duplicated.

export default function ReconsentGate({ email, returning, onAccept, submitting }) {
  const { ref, onScroll, read } = useReadGate();
  const [ticked, setTicked] = useState({});

  const allTicked = CONSENT_CLAUSES.every((c) => ticked[c.id] === true);

  return (
    <div className="space-y-4">
      <div className="font-mono text-xs leading-relaxed text-emerald-400/80">
        <p>&gt; consent --required</p>
        <p className="mt-1 text-gray-400">
          {returning
            ? 'Our Terms of Use and Privacy Policy have changed since you last accepted them.'
            : 'Your account predates our current Terms of Use and Privacy Policy.'}{' '}
          Read them through and accept to continue as{' '}
          <span className="text-emerald-300">{email}</span>.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-emerald-500/20">
        <div className="border-b border-emerald-500/20 bg-black/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-emerald-400/70">
          terms &amp; privacy &middot; {LEGAL_UPDATED_LABEL} (v{LEGAL_VERSIONS.terms})
        </div>

        <div
          ref={ref}
          onScroll={onScroll}
          // Focusable for the same reason as the signup panel: a scroll
          // container that cannot take focus cannot be scrolled from the
          // keyboard, and the boxes below would never unlock.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          role="region"
          aria-label="Terms of Use and Privacy Policy summary"
          className="max-h-52 space-y-3 overflow-y-auto bg-black/20 px-3 py-3 text-[11.5px] leading-relaxed text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40"
        >
          {CONSENT_SUMMARY.map((block) => (
            <div key={block.heading}>
              <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wide text-emerald-400/80">
                {block.heading}
              </h3>
              <ul className="ml-4 list-disc space-y-1">
                {block.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </div>
          ))}
          <p className="border-t border-emerald-500/15 pt-2 text-[11px] text-gray-400">
            A summary, not a substitute. Open the{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline underline-offset-2">
              Terms of Use
            </Link>{' '}
            and the{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline underline-offset-2">
              Privacy Policy
            </Link>{' '}
            in full before you accept.
          </p>
        </div>

        <div
          className={`border-t border-emerald-500/20 px-3 py-1.5 font-mono text-[10px] ${
            read ? 'bg-emerald-500/10 text-emerald-300' : 'bg-black/40 text-gray-500'
          }`}
          aria-live="polite"
        >
          {read ? '✓ end of document reached' : '↓ scroll to the end to enable acceptance'}
        </div>
      </div>

      <fieldset disabled={!read} className="space-y-2 disabled:opacity-50">
        <legend className="sr-only">Acceptance</legend>
        {CONSENT_CLAUSES.map((clause) => (
          <label
            key={clause.id}
            htmlFor={`reconsent-${clause.id}`}
            className={`flex gap-2.5 rounded-lg border p-2.5 ${read ? 'cursor-pointer' : 'cursor-not-allowed'} ${
              ticked[clause.id] ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-gray-700'
            }`}
          >
            <input
              id={`reconsent-${clause.id}`}
              type="checkbox"
              checked={ticked[clause.id] === true}
              onChange={(e) => setTicked((prev) => ({ ...prev, [clause.id]: e.target.checked }))}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-600 bg-black/40 text-emerald-500 focus:ring-emerald-500/40"
            />
            <span className="min-w-0">
              <span className="block text-[12px] text-gray-200">{clause.label}</span>
              {clause.href && (
                <Link
                  to={clause.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 inline-block font-mono text-[10.5px] text-emerald-400/80 underline underline-offset-2"
                >
                  {clause.linkLabel}
                </Link>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        onClick={() => onAccept(ticked)}
        disabled={!allTicked || submitting}
        className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 font-mono text-sm text-emerald-300 transition-colors hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'recording acceptance…' : 'accept() && continue'}
      </button>

      <p className="font-mono text-[10.5px] leading-relaxed text-gray-500">
        Your acceptance is stored against these document versions with the server&rsquo;s timestamp.
        Declining simply means not continuing &mdash; you can still delete your account, and its
        data, by asking from the address you registered with.
      </p>
    </div>
  );
}
