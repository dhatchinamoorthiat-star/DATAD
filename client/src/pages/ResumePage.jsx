import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, Plus, Save, Trash2, Sparkles, ChevronDown, ChevronUp, Loader2, Layout } from 'lucide-react';
import { DAX_CAPABILITY } from '../utils/dax';
import { getMyResume, saveResume } from '../api/resume';
import { reviewResume } from '../api/dax';
import { useAuth } from '../context/AuthContext';
import { FeedSkeleton } from '../components/common/Skeleton';
import TierGate from '../components/common/TierGate';
import AIBadge from '../components/common/AIBadge';
import CrownBadge from '../components/common/CrownBadge';
import Button from '../components/common/Button';

function AIReviewPanel({ resumeData }) {
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(true);

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

export default function ResumePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { register, control, handleSubmit, reset, watch, getValues, formState: { errors } } = useForm({ defaultValues: { personal: { fullName: '', email: '', phone: '', linkedin: '' }, summary: '', skills: [], education: [{ degree: '', institution: '', year: '' }], experience: [{ company: '', role: '', duration: '', description: '' }], projects: [{ title: '', description: '', technologies: '' }], achievements: [{ title: '', description: '' }], certifications: [{ name: '', issuer: '', year: '' }] } });

  const { fields: eduFields, append: addEdu, remove: rmEdu } = useFieldArray({ control, name: 'education' });
  const { fields: expFields, append: addExp, remove: rmExp } = useFieldArray({ control, name: 'experience' });
  const { fields: projFields, append: addProj, remove: rmProj } = useFieldArray({ control, name: 'projects' });
  const { fields: achFields, append: addAch, remove: rmAch } = useFieldArray({ control, name: 'achievements' });
  const { fields: certFields, append: addCert, remove: rmCert } = useFieldArray({ control, name: 'certifications' });

  const [skillInput, setSkillInput] = useState('');

  const addSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    const current = getValues('skills') || [];
    if (!current.includes(val)) {
      reset({ ...getValues(), skills: [...current, val] });
    }
    setSkillInput('');
  };

  const removeSkill = (idx) => {
    const current = getValues('skills') || [];
    reset({ ...getValues(), skills: current.filter((_, i) => i !== idx) });
  };

  useEffect(() => {
    getMyResume()
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data) reset(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      await saveResume(data);
      toast.success('Resume saved');
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    }
    setSaving(false);
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


      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Section title="Personal Information">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name" {...register('personal.fullName', { required: true })} error={errors.personal?.fullName} />
            <Input label="Email" {...register('personal.email')} />
            <Input label="Phone" {...register('personal.phone')} />
            <Input label="LinkedIn URL" {...register('personal.linkedin')} />
          </div>
        </Section>

        <Section title="Professional Summary">
          <textarea rows={3} {...register('summary')} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" placeholder="Brief overview of your background and goals…" />
        </Section>

        <Section title="Skills">
          <div className="flex flex-wrap gap-2 mb-3">
            {(watch('skills') || []).map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {s} <button type="button" onClick={() => removeSkill(i)} className="hover:text-rose-500">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" placeholder="Add a skill…" />
            <Button type="button" variant="ghost" size="sm" onClick={addSkill}>Add</Button>
          </div>
        </Section>

        <Section title="Education" addLabel="Add education" onAdd={() => addEdu({ degree: '', institution: '', year: '' })}>
          {eduFields.map((field, i) => (
            <ArrayItem key={field.id} index={i} onRemove={() => rmEdu(i)}>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Degree" {...register(`education.${i}.degree`)} />
                <Input label="Institution" {...register(`education.${i}.institution`)} />
                <Input label="Year" {...register(`education.${i}.year`)} />
              </div>
            </ArrayItem>
          ))}
        </Section>

        <Section title="Experience" addLabel="Add experience" onAdd={() => addExp({ company: '', role: '', duration: '', description: '' })}>
          {expFields.map((field, i) => (
            <ArrayItem key={field.id} index={i} onRemove={() => rmExp(i)}>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <Input label="Company" {...register(`experience.${i}.company`)} />
                <Input label="Role" {...register(`experience.${i}.role`)} />
                <Input label="Duration" {...register(`experience.${i}.duration`)} />
              </div>
              <textarea rows={2} {...register(`experience.${i}.description`)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" placeholder="Describe your role…" />
            </ArrayItem>
          ))}
        </Section>

        <Section title="Projects" addLabel="Add project" onAdd={() => addProj({ title: '', description: '', technologies: '' })}>
          {projFields.map((field, i) => (
            <ArrayItem key={field.id} index={i} onRemove={() => rmProj(i)}>
              <Input label="Title" {...register(`projects.${i}.title`)} />
              <textarea rows={2} {...register(`projects.${i}.description`)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 mt-2" placeholder="Description…" />
              <Input label="Technologies" {...register(`projects.${i}.technologies`)} />
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

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Resume'}
          </button>
        </div>
      </form>
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

function ArrayItem({ index, onRemove, children }) {
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
      <input {...props} className={`w-full rounded-lg border ${error ? 'border-rose-300' : 'border-gray-200'} px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800`} />
      {error && <p className="mt-0.5 text-xs text-rose-500">Required</p>}
    </div>
  );
}
