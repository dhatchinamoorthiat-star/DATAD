import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import toast from '../utils/toast';
import { Eye, Plus, Save, Trash2, Sparkles, Loader2, CheckCircle2, Send, Mail } from 'lucide-react';
import { getMyResume, saveResume, submitResume } from '../api/resume';
import resumeCompleteness from '../utils/resumeCompleteness';
import { reviewResume } from '../api/dax';
import { FeedSkeleton } from '../components/common/Skeleton';
import AIBadge from '../components/common/AIBadge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

/** One radio row in SendDialog — the whole card is the label, so the hit target
 *  is the card rather than the 16px radio itself. */
function DeliveryChoice({ value, selected, onSelect, title, detail }) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
        selected === value
          ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/30'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'
      }`}
    >
      <input
        type="radio"
        name="resume-delivery"
        value={value}
        checked={selected === value}
        onChange={() => onSelect(value)}
        // The visible title sits in a nested span for layout, which a screen
        // reader would otherwise announce only as unlabelled radio.
        aria-label={title}
        className="mt-0.5 h-4 w-4 accent-indigo-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{title}</span>
        <span className="mt-0.5 block break-words text-xs text-gray-500 dark:text-gray-400">{detail}</span>
      </span>
    </label>
  );
}

/**
 * Asked before the resume is submitted, because "submit" quietly meaning "email
 * my own account" is the kind of thing a student only discovers afterwards —
 * and the address they actually want the PDF at is often a recruiter's, not
 * their own. The account address is the default; the other option reveals a
 * field rather than living in a second, easily-missed button.
 *
 * The dialog collects the choice only. Validation and rate limiting are the
 * server's, since nothing enforced here survives a crafted request.
 */
// Mounted only while open (see the call site), so its state starts fresh every
// time — a recruiter's address left sitting in the box from last week is the one
// mistake this dialog must not invite.
function SendDialog({ onClose, accountEmail, submitting, onConfirm }) {
  const [mode, setMode] = useState('account');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = email.trim();
  const looksValid = /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/.test(trimmed);
  const blocked = mode === 'other' && !looksValid;

  const confirm = () => {
    setTouched(true);
    if (blocked) return;
    onConfirm(mode === 'other' ? { deliverTo: 'other', recipientEmail: trimmed } : { deliverTo: 'account' });
  };

  return (
    <Modal open onClose={onClose} title="Where should we send it?">
      <div className="space-y-3">
        <DeliveryChoice
          value="account"
          selected={mode}
          onSelect={setMode}
          title="My registered email"
          detail={accountEmail || 'The address on your DATAD account'}
        />
        <DeliveryChoice
          value="other"
          selected={mode}
          onSelect={setMode}
          title="A different email address"
          detail="Send the PDF to a recruiter, a mentor, or a personal address"
        />

        {mode === 'other' && (
          <div className="pl-1">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400" htmlFor="resume-recipient">
              Recipient&apos;s email
            </label>
            <input
              id="resume-recipient"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirm()}
              onBlur={() => setTouched(true)}
              placeholder="name@company.com"
              className={`input ${touched && blocked ? 'border-rose-300 dark:border-rose-500/60' : ''}`}
            />
            {touched && blocked && (
              <p className="mt-1 text-xs text-rose-500">Enter a valid email address</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              They receive your resume as a PDF, with replies coming back to you.
              You&apos;ll still get your own copy at {accountEmail || 'your registered address'}.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
        <button
          type="button"
          onClick={confirm}
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Sending…' : 'Send resume'}
        </button>
      </div>
    </Modal>
  );
}

function AIReviewPanel() {
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);

  const run = async () => {
    setState('loading');
    try {
      const res = await reviewResume();
      setResult(res.data);
      setState('done');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dax could not review your resume');
      setState('error');
    }
  };

  if (state === 'idle') {
    return (
      <button type="button" onClick={run} className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-800/60 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50">
        <Sparkles className="h-4 w-4" /> Review with Dax
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-600 dark:border-violet-800/60 dark:bg-violet-900/30 dark:text-violet-300">
        <Loader2 className="h-4 w-4 animate-spin" /> Analysing your resume…
      </div>
    );
  }

  if (state === 'done' && result) {
    return (
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-800/40 dark:bg-violet-950/20">
        <div className="flex items-center justify-between mb-3">
          <AIBadge provider={result._meta?.provider} confidence={result._meta?.confidence} />
          <button onClick={() => setState('idle')} className="text-xs text-violet-500 hover:text-violet-700">Refresh</button>
        </div>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
          {result.overallScore != null && (
            <p><span className="font-semibold">Overall:</span> {result.overallScore}/100</p>
          )}
          {result.summary && <p className="text-xs leading-relaxed">{result.summary}</p>}
          {result.strengths?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2">Strengths</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {result.weaknesses?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-2">Areas to improve</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">{result.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {result.suggestions?.length > 0 && (
            <div className="mt-3 border-t border-violet-200 dark:border-violet-800/40 pt-3">
              <p className="text-xs font-semibold mb-1">Suggestions</p>
              {result.suggestions.map((s, i) => (
                <p key={i} className="text-xs flex items-start gap-1.5 mt-1">{i + 1}. {s}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

const EMPTY_RESUME = {
  personal: { fullName: '', email: '', phone: '', location: '', linkedin: '', website: '' },
  summary: '',
  skills: [],
  education: [{ degree: '', institution: '', year: '', score: '' }],
  experience: [{ organization: '', role: '', duration: '', description: '' }],
  projects: [{ title: '', description: '', technologies: '', link: '' }],
  achievements: [{ title: '', description: '' }],
  certifications: [{ name: '', issuer: '', year: '' }],
  leadership: [{ title: '', description: '' }],
};

/**
 * Progress against what recruiters screen for. Shown above the form because the
 * single most common failure mode is a resume abandoned half-filled — the
 * student cannot otherwise tell how far off "sendable" they are.
 */
function CompletenessMeter({ score, missing, ready }) {
  return (
    <div className="mb-6 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Resume strength</h2>
        <span className={`text-sm font-bold ${ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {score}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${Math.max(score, 2)}%` }}
        />
      </div>
      {missing.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {missing.map((m) => (
            <li key={m} className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" /> {m}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Every section is complete — this is ready to send.
        </p>
      )}
    </div>
  );
}

export default function ResumePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const { user } = useAuth();

  const { register, control, handleSubmit, reset, getValues, setValue, formState: { errors } } =
    useForm({ defaultValues: EMPTY_RESUME });

  const { fields: eduFields, append: addEdu, remove: rmEdu } = useFieldArray({ control, name: 'education' });
  const { fields: expFields, append: addExp, remove: rmExp } = useFieldArray({ control, name: 'experience' });
  const { fields: projFields, append: addProj, remove: rmProj } = useFieldArray({ control, name: 'projects' });
  const { fields: achFields, append: addAch, remove: rmAch } = useFieldArray({ control, name: 'achievements' });
  const { fields: certFields, append: addCert, remove: rmCert } = useFieldArray({ control, name: 'certifications' });
  const { fields: leadFields, append: addLead, remove: rmLead } = useFieldArray({ control, name: 'leadership' });

  const [skillInput, setSkillInput] = useState('');

  // Recomputed on every keystroke so the meter tracks what is actually typed.
  // useWatch rather than watch() — the latter returns a fresh function each
  // render, which opts the whole page out of React Compiler memoization.
  const live = useWatch({ control });
  const completeness = resumeCompleteness(live);

  const addSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    const current = getValues('skills') || [];
    // setValue rather than reset: reset() rebuilds every field array and steals
    // focus from the skill input mid-typing.
    if (!current.includes(val)) setValue('skills', [...current, val], { shouldDirty: true });
    setSkillInput('');
  };

  const removeSkill = (idx) => {
    const current = getValues('skills') || [];
    setValue('skills', current.filter((_, i) => i !== idx), { shouldDirty: true });
  };

  useEffect(() => {
    getMyResume()
      .then((res) => {
        const data = res.data?.data || res.data;
        // Merge onto the empty shape: a resume saved before a section existed
        // has no key for it, and an undefined field array renders nothing.
        if (data) {
          reset({
            ...EMPTY_RESUME,
            ...data,
            personal: { ...EMPTY_RESUME.personal, ...(data.personal || {}) },
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      await saveResume(data);
      toast.success('Resume saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    }
    setSaving(false);
  };

  // Save + email. Separate from the draft save so a student editing over
  // several sittings is not mailed on every keystroke-and-save. `delivery`
  // comes from SendDialog and decides whether a copy also goes to an address
  // the student typed.
  const onFinalSubmit = (delivery) => async (data) => {
    setSubmitting(true);
    try {
      const res = await submitResume(data, delivery);
      const { copy } = res.data || {};

      // The copy is the thing the student was actually watching, so when one
      // was requested its outcome — not the confirmation's — leads the toast.
      if (copy?.sent) toast.success(`Resume sent to ${copy.to}`);
      else if (copy?.reason === 'limit') toast.error("You've sent your resume to a few addresses today — try again tomorrow");
      else if (copy) toast.error(`Resume saved, but we couldn't email ${copy.to}`);
      else if (res.data?.emailed) toast.success('Resume submitted — confirmation sent to your email');
      else if (res.data?.emailThrottled) toast.success('Resume submitted');
      else toast.success("Resume submitted — we couldn't email you just now");

      // A failed copy keeps the dialog open with the address still in it, so
      // the fix is a retry rather than retyping from a closed dialog.
      if (!copy || copy.sent) setSendOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-10"><FeedSkeleton count={6} /></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Resume</h1>
          <p className="text-sm text-gray-500">Build your placement profile</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/career/resume/preview">
            <Button variant="ghost" size="sm" icon={Eye}>Preview</Button>
          </Link>
          <button onClick={handleSubmit(onSubmit)} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <CompletenessMeter {...completeness} />

      <div className="mb-6">
        <AIReviewPanel />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Section title="Personal Information">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name" {...register('personal.fullName', { required: true })} error={errors.personal?.fullName} />
            <Input label="Email" {...register('personal.email')} />
            <Input label="Phone" {...register('personal.phone')} />
            <Input label="Location" {...register('personal.location')} />
            <Input label="LinkedIn URL" {...register('personal.linkedin')} />
            <Input label="Portfolio / Website" {...register('personal.website')} />
          </div>
        </Section>

        <Section title="Professional Summary">
          <textarea rows={3} {...register('summary')} className="input" placeholder="Brief overview of your background and goals…" />
        </Section>

        <Section title="Skills">
          <div className="flex flex-wrap gap-2 mb-3">
            {(live.skills || []).map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {s} <button type="button" onClick={() => removeSkill(i)} className="hover:text-rose-500">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())} className="input flex-1" placeholder="Add a skill…" />
            <Button type="button" variant="ghost" size="sm" onClick={addSkill}>Add</Button>
          </div>
        </Section>

        <Section title="Education" addLabel="Add education" onAdd={() => addEdu({ degree: '', institution: '', year: '', score: '' })}>
          {eduFields.map((field, i) => (
            <ArrayItem key={field.id} index={i} onRemove={() => rmEdu(i)}>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Degree" {...register(`education.${i}.degree`)} />
                <Input label="Institution" {...register(`education.${i}.institution`)} />
                <Input label="Year" {...register(`education.${i}.year`)} />
                <Input label="Score / CGPA" {...register(`education.${i}.score`)} />
              </div>
            </ArrayItem>
          ))}
        </Section>

        <Section title="Experience" addLabel="Add experience" onAdd={() => addExp({ organization: '', role: '', duration: '', description: '' })}>
          {expFields.map((field, i) => (
            <ArrayItem key={field.id} index={i} onRemove={() => rmExp(i)}>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <Input label="Organization" {...register(`experience.${i}.organization`)} />
                <Input label="Role" {...register(`experience.${i}.role`)} />
                <Input label="Duration" {...register(`experience.${i}.duration`)} />
              </div>
              {/* One line per bullet — the preview splits this on newlines. */}
              <textarea rows={3} {...register(`experience.${i}.description`)} className="input" placeholder={'One achievement per line, e.g.\nCut report turnaround from 3 days to 4 hours'} />
              <p className="mt-1 text-xs text-gray-400">Each line becomes a bullet. Lead with the result, not the task.</p>
            </ArrayItem>
          ))}
        </Section>

        <Section title="Projects" addLabel="Add project" onAdd={() => addProj({ title: '', description: '', technologies: '', link: '' })}>
          {projFields.map((field, i) => (
            <ArrayItem key={field.id} index={i} onRemove={() => rmProj(i)}>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Title" {...register(`projects.${i}.title`)} />
                <Input label="Link" {...register(`projects.${i}.link`)} />
              </div>
              <textarea rows={2} {...register(`projects.${i}.description`)} className="input mt-2" placeholder="Description…" />
              <div className="mt-2">
                <Input label="Technologies" {...register(`projects.${i}.technologies`)} />
              </div>
            </ArrayItem>
          ))}
        </Section>

        <Section title="Achievements" addLabel="Add achievement" onAdd={() => addAch({ title: '', description: '' })}>
          {achFields.map((field, i) => (
            <ArrayItem key={field.id} index={i} onRemove={() => rmAch(i)}>
              <Input label="Title" {...register(`achievements.${i}.title`)} />
              <Input label="Description" {...register(`achievements.${i}.description`)} />
            </ArrayItem>
          ))}
        </Section>

        <Section title="Certifications" addLabel="Add certification" onAdd={() => addCert({ name: '', issuer: '', year: '' })}>
          {certFields.map((field, i) => (
            <ArrayItem key={field.id} index={i} onRemove={() => rmCert(i)}>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Name" {...register(`certifications.${i}.name`)} />
                <Input label="Issuer" {...register(`certifications.${i}.issuer`)} />
                <Input label="Year" {...register(`certifications.${i}.year`)} />
              </div>
            </ArrayItem>
          ))}
        </Section>

        <Section title="Leadership & Extracurricular" addLabel="Add entry" onAdd={() => addLead({ title: '', description: '' })}>
          {leadFields.map((field, i) => (
            <ArrayItem key={field.id} index={i} onRemove={() => rmLead(i)}>
              <Input label="Role or activity" {...register(`leadership.${i}.title`)} />
              <div className="mt-2">
                <Input label="Description" {...register(`leadership.${i}.description`)} />
              </div>
            </ArrayItem>
          ))}
        </Section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-5 dark:border-gray-800">
          <p className="mr-auto flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Mail className="h-3.5 w-3.5" /> Submitting lets you email the PDF to yourself or to someone else.
          </p>
          <button type="submit" disabled={saving || submitting} className="flex items-center gap-1.5 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button type="button" onClick={() => setSendOpen(true)} disabled={saving || submitting} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit resume'}
          </button>
        </div>
      </form>

      {sendOpen && <SendDialog
        onClose={() => !submitting && setSendOpen(false)}
        accountEmail={user?.email}
        submitting={submitting}
        // handleSubmit runs the form's validation first, so an incomplete
        // resume never reaches a recruiter's inbox on a stray click.
        onConfirm={(delivery) =>
          handleSubmit(onFinalSubmit(delivery), () => {
            // Otherwise the button just does nothing and the invalid field is
            // behind the backdrop, unseen.
            setSendOpen(false);
            toast.error('Fill in the highlighted fields before submitting');
          })()
        }
      />}
    </div>
  );
}

function Section({ title, children, addLabel, onAdd }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
        {addLabel && onAdd && (
          <button type="button" onClick={onAdd} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
            <Plus className="h-3.5 w-3.5" /> {addLabel}
          </button>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ArrayItem({ onRemove, children }) {
  return (
    <div className="relative rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="absolute right-2 top-2">
        <button type="button" onClick={onRemove} className="rounded-lg p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {children}
    </div>
  );
}

function Input({ label, error, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <input {...props} className={`input ${error ? 'border-rose-300 dark:border-rose-500/60' : ''}`} />
      {error && <p className="mt-0.5 text-xs text-rose-500">Required</p>}
    </div>
  );
}
