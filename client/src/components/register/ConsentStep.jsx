import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { CONSENT_CLAUSES, CONSENT_SUMMARY, LEGAL_UPDATED_LABEL, LEGAL_VERSIONS } from '../../constants/legal';
import useReadGate from '../../hooks/useReadGate';

// The last screen before an account exists.
//
// Two things have to be true here, and they are different things. The person
// has to have *had the terms in front of them* — which is why the text is
// embedded and the boxes stay disabled until it has been scrolled through,
// rather than reduced to a link nobody opens. And they have to *act*: three
// separate, unticked-by-default boxes, one of which is the agreement that
// ticking a box counts as signing. A pre-ticked box records nothing, and a
// single "I agree to everything" box cannot show which document was agreed to.
//
// The reading gate is honest about its own limits. It proves the text was
// presented and scrolled, not that anyone read it — but "presented, scrolled,
// then affirmatively accepted at a recorded time against a recorded version"
// is the record that has to exist before the confirmation email goes out.

export default function ConsentStep() {
  const { register, watch, setValue, formState: { errors } } = useFormContext();
  const { ref: scrollerRef, onScroll, read } = useReadGate();

  const accepted = watch('consent') || {};
  const allAccepted = CONSENT_CLAUSES.every((c) => accepted[c.id] === true);

  // Timestamp the moment the last required box goes on. Taken from the client
  // for display only — the server stamps its own `acceptedAt`, because a time
  // the browser chose is not evidence of anything.
  useEffect(() => {
    if (allAccepted) setValue('consentAcceptedAt', new Date().toISOString(), { shouldDirty: true });
  }, [allAccepted, setValue]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-900 dark:text-white">
          Before your account exists
        </h2>
        <p className="mt-1.5 text-[13.5px] text-gray-500 dark:text-gray-400">
          Read this through, then accept. Nothing is created and no email is sent until you do.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/60">
          <FileText className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <p className="text-[11.5px] font-medium text-gray-500 dark:text-gray-400">
            Terms of Use &amp; Privacy Policy &middot; {LEGAL_UPDATED_LABEL} (v{LEGAL_VERSIONS.terms})
          </p>
        </div>

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          // A scroll container that can't take focus can't be scrolled from the
          // keyboard, which would leave keyboard-only students unable to reach
          // the end of the document and therefore unable to register at all.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          role="region"
          aria-label="Terms of Use and Privacy Policy summary"
          className="max-h-64 space-y-4 overflow-y-auto px-4 py-4 text-[12.5px] leading-relaxed text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 dark:text-gray-300"
        >
          {CONSENT_SUMMARY.map((block) => (
            <div key={block.heading}>
              <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                {block.heading}
              </h3>
              <ul className="ml-4 list-disc space-y-1.5">
                {block.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </div>
          ))}

          <p className="border-t border-gray-100 pt-3 text-[12px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
            This is a summary of the full documents, not a substitute for them. Open the{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 underline underline-offset-2 dark:text-primary-400">
              Terms of Use
            </Link>{' '}
            and the{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 underline underline-offset-2 dark:text-primary-400">
              Privacy Policy
            </Link>{' '}
            in full before you accept.
          </p>
        </div>

        <div
          className={`flex items-center gap-2 border-t px-4 py-2 text-[11.5px] transition-colors ${
            read
              ? 'border-gray-200 bg-primary-50/60 text-primary-700 dark:border-gray-800 dark:bg-primary-500/10 dark:text-primary-300'
              : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400'
          }`}
          aria-live="polite"
        >
          {read
            ? <><Check className="h-3.5 w-3.5" aria-hidden="true" />You&rsquo;ve reached the end. You can accept below.</>
            : <>Scroll to the end of the document to enable the acceptance boxes.</>}
        </div>
      </div>

      <fieldset disabled={!read} className="space-y-2.5 disabled:opacity-55">
        <legend className="sr-only">Acceptance</legend>

        {CONSENT_CLAUSES.map((clause) => (
          <label
            key={clause.id}
            htmlFor={`consent-${clause.id}`}
            className={`flex gap-3 rounded-xl border p-3 transition-colors ${
              read ? 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-700' : 'cursor-not-allowed'
            } ${
              accepted[clause.id]
                ? 'border-primary-300 bg-primary-50/50 dark:border-primary-700 dark:bg-primary-500/10'
                : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            <input
              id={`consent-${clause.id}`}
              type="checkbox"
              // Never defaultChecked. A pre-ticked box is not a decision, and a
              // consent record that cannot show a decision is worth nothing.
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900"
              {...register(`consent.${clause.id}`, {
                required: 'Every box above has to be ticked before an account can be created.',
              })}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-gray-900 dark:text-white">{clause.label}</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-gray-500 dark:text-gray-400">
                {clause.detail}
              </span>
              {clause.href && (
                <Link
                  to={clause.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary-600 underline underline-offset-2 dark:text-primary-400"
                >
                  {clause.linkLabel}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      {errors.consent && (
        <p role="alert" className="text-[12px] font-medium text-danger-600 dark:text-danger-400">
          {Object.values(errors.consent)[0]?.message ||
            'Every box above has to be ticked before an account can be created.'}
        </p>
      )}

      <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-gray-400 dark:text-gray-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Your acceptance is stored with the document versions and the server&rsquo;s timestamp, and it
          is what the confirmation email is sent against. You can withdraw it by deleting your
          account, which removes your data.
        </span>
      </p>
    </motion.div>
  );
}
