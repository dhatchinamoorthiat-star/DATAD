import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowDown } from 'lucide-react';
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
// the same hook: scroll to the end, then three unticked boxes. If the two ever
// disagreed, the weaker one would become the real policy — which is why the
// legal copy and the gate live in shared modules and only the markup differs.
//
// `tone` carries the login skin's classes (see pages/loginSkins.jsx). This
// panel renders inside the login card, so it has to wear whichever dress that
// card is wearing — it used to hardcode the terminal's emerald-on-black, which
// meant it painted a dark console inside the standard skin's white card.

export default function ReconsentGate({ email, returning, onAccept, submitting, tone }) {
  const { ref, onScroll, read } = useReadGate();
  const [ticked, setTicked] = useState({});

  const allTicked = CONSENT_CLAUSES.every((c) => ticked[c.id] === true);

  return (
    <div className="space-y-4">
      <div>
        <p className={tone.heading}>{tone.headingText}</p>
        <p className={tone.lead}>
          {returning
            ? 'Our Terms of Use and Privacy Policy have changed since you last accepted them.'
            : 'Your account predates our current Terms of Use and Privacy Policy.'}{' '}
          Read them through and accept to continue as{' '}
          <span className={tone.email}>{email}</span>.
        </p>
      </div>

      <div className={tone.panel}>
        <div className={tone.panelHeader}>
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
          className={tone.body}
        >
          {CONSENT_SUMMARY.map((block) => (
            <div key={block.heading}>
              <h3 className={tone.blockHeading}>
                {block.heading}
              </h3>
              <ul className="ml-4 list-disc space-y-1">
                {block.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </div>
          ))}
          <p className={tone.footnote}>
            A summary, not a substitute. Open the{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className={tone.link}>
              Terms of Use
            </Link>{' '}
            and the{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className={tone.link}>
              Privacy Policy
            </Link>{' '}
            in full before you accept.
          </p>
        </div>

        <div
          className={`flex items-center gap-1.5 ${tone.status} ${read ? tone.statusRead : tone.statusUnread}`}
          aria-live="polite"
        >
          {read ? <Check className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />}
          {read ? 'End of document reached' : 'Scroll to the end to enable acceptance'}
        </div>
      </div>

      <fieldset disabled={!read} className="space-y-2 disabled:opacity-50">
        <legend className="sr-only">Acceptance</legend>
        {CONSENT_CLAUSES.map((clause) => (
          <label
            key={clause.id}
            htmlFor={`reconsent-${clause.id}`}
            className={`flex gap-2.5 rounded-lg border p-2.5 ${read ? 'cursor-pointer' : 'cursor-not-allowed'} ${
              ticked[clause.id] ? tone.clauseOn : tone.clauseOff
            }`}
          >
            <input
              id={`reconsent-${clause.id}`}
              type="checkbox"
              checked={ticked[clause.id] === true}
              onChange={(e) => setTicked((prev) => ({ ...prev, [clause.id]: e.target.checked }))}
              className={tone.checkbox}
            />
            <span className="min-w-0">
              <span className={tone.clauseLabel}>{clause.label}</span>
              {clause.href && (
                <Link
                  to={clause.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={tone.clauseLink}
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
        className={tone.button}
      >
        {submitting ? tone.buttonBusy : tone.buttonText}
      </button>

      <p className={tone.disclaimer}>
        Your acceptance is stored against these document versions with the server&rsquo;s timestamp.
        Declining simply means not continuing &mdash; you can still delete your account, and its
        data, by asking from the address you registered with.
      </p>
    </div>
  );
}
