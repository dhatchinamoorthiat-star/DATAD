/**
 * LinkedIn Enhancer.
 *
 * Three steps, and the page always knows which one it is on: import a profile,
 * confirm what role it should be measured against, then read the analysis. The
 * middle step is not skippable — a strength score with no target is a score
 * against an imaginary average job, and acting on it is worse than not having
 * it.
 *
 * There is no "connect your LinkedIn" button anywhere here on purpose. DATAD
 * does not log into LinkedIn, does not ask for a password, and does not fetch
 * profiles by URL. Everything on this page is text the student chose to hand
 * over, and the delete control removes all of it.
 */

import { useEffect, useRef, useState } from 'react';
import { Contact, Sparkles, RefreshCw, Trash2, ArrowRight, ClipboardPaste, FileText, Briefcase, Upload, FileUp } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import ConfirmModal from '../../components/common/ConfirmModal';
import EmptyState from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/Skeleton';
import { Page } from '../../components/common/motion';
import TierGate from '../../components/common/TierGate';
import { FEATURE } from '../../utils/planFeatures';
import LinkedInScore from '../../components/career/linkedin/LinkedInScore';
import LinkedInFindings from '../../components/career/linkedin/LinkedInFindings';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import toast from '../../utils/toast';
import { track } from '../../utils/analytics';
import {
  getLinkedIn, saveLinkedInProfile, uploadLinkedInPdf, setLinkedInTarget, analyzeLinkedIn, deleteLinkedInData,
} from '../../api/linkedin';

/**
 * A target still needs the student's confirmation if there isn't one, or if the
 * one we have was inferred from their DATAD profile rather than stated. An
 * inferred target is a guess about what job someone wants; scoring against it
 * without asking is how a career tool confidently optimises for the wrong role.
 * Answering the form clears the flag, because the server marks an explicitly
 * supplied role as not inferred.
 */
const needsTargetConfirmation = (target) => !target?.role || Boolean(target.inferred);

const SENIORITY = [
  { value: 'intern', label: 'Internship' },
  { value: 'entry', label: 'Entry level' },
  { value: 'mid', label: 'Mid level' },
  { value: 'senior', label: 'Senior' },
];

export default function LinkedInPage() {
  useDocumentTitle('LinkedIn Enhancer');

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState('import');
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    track('linkedin_enhancer_viewed');

    getLinkedIn()
      .then(({ data }) => {
        setState(data);
        // Land on the furthest step the stored data supports, so returning to
        // the page never means re-walking the wizard — except where the target
        // was only inferred, which has to be confirmed before it is scored
        // against. Guessing the role and silently scoring against the guess is
        // the one thing the intent engine exists to avoid.
        setStep(!data.hasProfile ? 'import' : needsTargetConfirmation(data.target) ? 'target' : 'result');
      })
      .catch(() => toast.error('Could not load your LinkedIn analysis.'))
      .finally(() => setLoading(false));
  }, []);

  const runAnalysis = async (payload = {}) => {
    setAnalyzing(true);
    try {
      const { data } = await analyzeLinkedIn(payload);
      setState((prev) => ({ ...prev, analysis: data, stale: false, lastAnalyzedAt: new Date().toISOString() }));
      setStep('result');
      track('linkedin_analyzed', { score: data.score });
    } catch (err) {
      const message = err.response?.data?.message;
      if (err.response?.data?.code === 'TARGET_REQUIRED') setStep('target');
      toast.error(message || 'The analysis could not be completed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const removeAll = async () => {
    try {
      await deleteLinkedInData();
      setState({ hasProfile: false, analysis: null, target: null });
      setStep('import');
      toast.success('Your LinkedIn data has been deleted.');
    } catch {
      toast.error('Could not delete your LinkedIn data.');
    }
  };

  if (loading) {
    return (
      <Page className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="mb-4 h-9 w-64" />
        <Skeleton className="mb-6 h-4 w-full max-w-md" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Page>
    );
  }

  const analysis = state?.analysis;

  return (
    <Page overview={{
      pageKey: 'career-linkedin',
      title: 'Profile audit, role by role',
      blurb: 'Scores your LinkedIn profile against the job you actually want and names the specific lines to rewrite.',
      takeaway: 'Run it against one target role, then fix the headline and About section it flags.',
    }}>
      <PageHeader
        icon={Contact}
        title="LinkedIn Enhancer"
        subtitle="How strong is your profile for the role you actually want — and exactly what to change."
        action={state?.hasProfile && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmingRemove(true)}>Delete</Button>
            <Button size="sm" icon={RefreshCw} loading={analyzing} onClick={() => runAnalysis()}>
              {analysis ? 'Re-analyse' : 'Analyse'}
            </Button>
          </div>
        )}
      />

      <TierGate
        feature={FEATURE.LINKEDIN_ENHANCER}
        description="Dax reads your LinkedIn profile the way a recruiter does, scores it against the role you want, and tells you exactly what to change."
      >
        <Steps step={step} hasProfile={state?.hasProfile} hasTarget={Boolean(state?.target?.role)} onSelect={setStep} />

        {step === 'import' && (
          <ImportStep
            existing={state}
            onSaved={(next) => {
              setState((prev) => ({ ...prev, ...next, hasProfile: true }));
              const confirm = needsTargetConfirmation(next.target);
              setStep(confirm ? 'target' : 'result');
              if (!confirm) runAnalysis();
            }}
          />
        )}

        {step === 'target' && (
          <TargetStep
            target={state?.target || state?.suggestedTarget}
            suggested={state?.suggestedTarget}
            analyzing={analyzing}
            onSaved={(target) => {
              setState((prev) => ({ ...prev, target }));
              runAnalysis();
            }}
          />
        )}

        {step === 'result' && (
          analysis ? (
            <>
              {state?.stale && (
                <p className="mb-4 rounded-xl bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  You have edited your profile since this analysis ran. Re-analyse to score the current version.
                </p>
              )}
              <LinkedInScore analysis={analysis} dimensionLabels={state.dimensions} />
              <LinkedInFindings analysis={analysis} />
              <JobMatchPanel analyzing={analyzing} onMatch={(payload) => runAnalysis(payload)} />
            </>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Ready when you are"
              description="Your profile is imported and your target is set. Run the analysis to see your strength score and what to change."
              cta={{ label: analyzing ? 'Analysing…' : 'Analyse my profile', onClick: () => runAnalysis() }}
            />
          )
        )}
      </TierGate>

      <ConfirmModal
        open={confirmingRemove}
        onClose={() => setConfirmingRemove(false)}
        onConfirm={removeAll}
        danger
        title="Delete LinkedIn data?"
        message="This deletes your imported LinkedIn profile and every analysis of it. This cannot be undone."
        confirmLabel="Delete"
      />
    </Page>
  );
}

function Steps({ step, hasProfile, hasTarget, onSelect }) {
  const items = [
    { key: 'import', label: 'Import', enabled: true },
    { key: 'target', label: 'Target role', enabled: hasProfile },
    { key: 'result', label: 'Analysis', enabled: hasProfile && hasTarget },
  ];

  return (
    <nav className="mb-6 flex items-center gap-1" aria-label="Progress">
      {items.map((item, i) => (
        <div key={item.key} className="flex items-center">
          {i > 0 && <span className="mx-1 h-px w-4 bg-gray-200 dark:bg-gray-800" aria-hidden="true" />}
          <button
            type="button"
            disabled={!item.enabled}
            onClick={() => onSelect(item.key)}
            aria-current={step === item.key ? 'step' : undefined}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              step === item.key
                ? 'bg-primary-600 text-white'
                : item.enabled
                  ? 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  : 'cursor-not-allowed text-gray-300 dark:text-gray-700'
            }`}
          >
            {item.label}
          </button>
        </div>
      ))}
    </nav>
  );
}

function ImportStep({ existing, onSaved }) {
  const [rawText, setRawText] = useState('');
  const [hints, setHints] = useState({ name: '', headline: '' });
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);

  const save = async (source) => {
    if (source === 'paste' && !rawText.trim()) {
      toast.error('Paste your profile text first.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await saveLinkedInProfile({ source, rawText, hints });
      toast.success(source === 'datad' ? 'Draft built from your DATAD resume.' : 'Profile imported.');
      onSaved(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not import that profile.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPdf = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('That is not a PDF. Use LinkedIn\'s "Save to PDF" option.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await uploadLinkedInPdf(file, hints);
      toast.success('Profile imported from your LinkedIn export.');
      onSaved(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not read that PDF.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* First, because it is the least effort and the best provenance:
          LinkedIn's own export, downloaded by the student themselves. */}
      <Card padding="lg">
        <div className="mb-3 flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Upload your LinkedIn PDF</h2>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Easiest
          </span>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          On your LinkedIn profile: <strong>More</strong> → <strong>Save to PDF</strong>. Drop the file here and we
          read it directly. Nothing is fetched on your behalf — you download your own data and hand it over.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            uploadPdf(e.dataTransfer.files?.[0]);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging
              ? 'border-primary-400 bg-primary-50/60 dark:border-primary-600 dark:bg-primary-950/30'
              : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <FileUp className="mx-auto mb-2 h-6 w-6 text-gray-300 dark:text-gray-600" aria-hidden="true" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drop your PDF here, or{' '}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="font-semibold text-primary-600 underline-offset-2 hover:underline dark:text-primary-400"
            >
              choose a file
            </button>
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="LinkedIn PDF export"
            onChange={(e) => {
              uploadPdf(e.target.files?.[0]);
              // Reset so re-picking the same file after a failure still fires.
              e.target.value = '';
            }}
          />
          {saving && <p className="mt-2 text-xs text-gray-400">Reading your profile…</p>}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
          The export does not include your Featured section, recommendations or your full skills list — we will tell
          you what it could not see rather than scoring those as empty.
        </p>
      </Card>

      <Card padding="lg">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 text-primary-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Or paste your profile</h2>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Copying the page gives us more than the PDF does — it includes your full skills list, your Featured
          section and your recommendations. Select the whole profile page, copy, and paste it below.
        </p>

        <label className="sr-only" htmlFor="linkedin-paste">LinkedIn profile text</label>
        <textarea
          id="linkedin-paste"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={10}
          placeholder="Paste your LinkedIn profile here…"
          className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
        />

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={hints.name}
            onChange={(e) => setHints({ ...hints, name: e.target.value })}
            placeholder="Your name (optional)"
            aria-label="Your name"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
          />
          <input
            value={hints.headline}
            onChange={(e) => setHints({ ...hints, headline: e.target.value })}
            placeholder="Your headline, if the paste missed it"
            aria-label="Your headline"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
          />
        </div>

        <div className="mt-4">
          <Button loading={saving} iconRight={ArrowRight} onClick={() => save('paste')}>
            Import profile
          </Button>
        </div>
      </Card>

      <Card padding="lg">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Or start from your DATAD resume</h2>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Builds a draft from the experience, projects and skills you have already entered in DATAD. Useful if you
          have not written much on LinkedIn yet — check it against your real profile before analysing.
        </p>
        <Button variant="secondary" loading={saving} onClick={() => save('datad')}>
          Build a draft from my resume
        </Button>
      </Card>

      {existing?.hasProfile && (
        <p className="text-xs text-gray-400">
          You already have an imported profile. Importing again replaces it; your past analyses are kept.
        </p>
      )}
    </div>
  );
}

function TargetStep({ target, suggested, analyzing, onSaved }) {
  const [form, setForm] = useState({
    role: target?.role || '',
    secondaryRole: target?.secondaryRole || '',
    industry: target?.industry || '',
    seniority: target?.seniority || 'entry',
    location: target?.location || '',
    objective: target?.objective || '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.role.trim()) {
      toast.error('Tell us the role you are targeting — the analysis measures your profile against it.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await setLinkedInTarget(form);
      if (!data.roleRecognised) {
        toast.success('Target saved. That role is not in our library yet, so keyword checks will be skipped rather than guessed.');
      }
      onSaved(data.target);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your target.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200';

  return (
    <Card padding="lg">
      <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">What is this profile trying to attract?</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        There is no universally good LinkedIn profile — only a profile that works for a particular role. Everything
        is scored against what you put here.
      </p>

      {/* Fires for a stored-but-unconfirmed target too, not only for a fresh
          suggestion — otherwise a guess that had already been saved would be
          presented as though the student had chosen it. */}
      {(target?.inferred || suggested?.inferred) && (
        <p className="mt-3 rounded-xl bg-indigo-50/70 px-3 py-2 text-xs leading-relaxed text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
          We guessed <strong>{target?.role || suggested?.role}</strong> from your DATAD profile — confirm it or change
          it. Everything below is scored against this, so a wrong guess would give you the wrong advice.
        </p>
      )}

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="li-role" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Target role</label>
            <input id="li-role" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="Product Analyst" className={field} />
          </div>
          <div>
            <label htmlFor="li-secondary" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Second choice (optional)</label>
            <input id="li-secondary" value={form.secondaryRole} onChange={(e) => setForm({ ...form, secondaryRole: e.target.value })}
              placeholder="Business Analyst" className={field} />
          </div>
          <div>
            <label htmlFor="li-industry" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Industry</label>
            <input id="li-industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="SaaS / Technology" className={field} />
          </div>
          <div>
            <label htmlFor="li-seniority" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Level</label>
            <select id="li-seniority" value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value })} className={field}>
              {SENIORITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="li-location" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Where</label>
            <input id="li-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Chennai / remote" className={field} />
          </div>
          <div>
            <label htmlFor="li-objective" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Short-term objective</label>
            <input id="li-objective" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}
              placeholder="Summer internship 2027" className={field} />
          </div>
        </div>

        <Button type="submit" loading={saving || analyzing} iconRight={ArrowRight}>
          Save and analyse
        </Button>
      </form>
    </Card>
  );
}

function JobMatchPanel({ onMatch, analyzing }) {
  const [open, setOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [jobLabel, setJobLabel] = useState('');

  return (
    <Card padding="lg" className="mt-6">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <Briefcase className="h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">Match against a specific job</span>
          <span className="block text-xs text-gray-400">Paste a job description to see what your profile is missing for it</span>
        </span>
      </button>

      {open && (
        <div className="mt-4">
          <label htmlFor="li-jd-label" className="sr-only">Job label</label>
          <input
            id="li-jd-label"
            value={jobLabel}
            onChange={(e) => setJobLabel(e.target.value)}
            placeholder="Label it, e.g. Zoho — Product Analyst"
            className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900"
          />
          <label htmlFor="li-jd" className="sr-only">Job description</label>
          <textarea
            id="li-jd"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={8}
            placeholder="Paste the responsibilities and requirements…"
            className="w-full rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800 dark:bg-gray-900"
          />
          <p className="mt-2 text-[11px] text-gray-400">
            The posting itself is not stored — only the comparison and the label you give it.
          </p>
          <Button
            className="mt-3"
            loading={analyzing}
            disabled={!jobDescription.trim()}
            onClick={() => onMatch({ jobDescription, jobLabel })}
          >
            Match my profile
          </Button>
        </div>
      )}
    </Card>
  );
}
