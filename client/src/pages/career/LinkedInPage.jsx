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

import { useEffect, useState } from 'react';
import { Contact, Sparkles, RefreshCw, Trash2, ArrowRight, ClipboardPaste, FileText, Briefcase } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
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
  getLinkedIn, saveLinkedInProfile, setLinkedInTarget, analyzeLinkedIn, deleteLinkedInData,
} from '../../api/linkedin';

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

  useEffect(() => {
    track('linkedin_enhancer_viewed');

    getLinkedIn()
      .then(({ data }) => {
        setState(data);
        // Land on the furthest step the stored data supports, so returning to
        // the page never means re-walking the wizard.
        setStep(!data.hasProfile ? 'import' : !data.target?.role ? 'target' : 'result');
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
    if (!window.confirm('Delete your imported LinkedIn profile and every analysis of it? This cannot be undone.')) return;
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
    <Page className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        icon={Contact}
        title="LinkedIn Enhancer"
        subtitle="How strong is your profile for the role you actually want — and exactly what to change."
        action={state?.hasProfile && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={Trash2} onClick={removeAll}>Delete</Button>
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
              setStep(next.target?.role ? 'result' : 'target');
              if (next.target?.role) runAnalysis();
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

  return (
    <div className="space-y-4">
      <Card padding="lg">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 text-primary-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Paste your profile</h2>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Open your LinkedIn profile, select the whole page, copy it, and paste it below. Everything —
          headline, About, experience, skills, recommendations — is parsed out for you. We never ask for your
          LinkedIn password and never fetch your profile ourselves.
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

      {suggested?.inferred && (
        <p className="mt-3 rounded-xl bg-indigo-50/70 px-3 py-2 text-xs leading-relaxed text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
          We guessed <strong>{suggested.role}</strong> from your DATAD profile. Change it if that is not what you are
          going after.
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
