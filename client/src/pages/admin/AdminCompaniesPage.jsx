import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { Briefcase, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { listCompanies, createCompany, deleteCompany } from '../../api/companies';
import { SECTORS } from '../../utils/companies';
import { AdminShell, inputClass } from './shared';
import ConfirmModal from '../../components/common/ConfirmModal';

const lines = (s) =>
  (s || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

// One question per line as "hr | Why TCS?" — category prefix optional.
const parseQuestions = (s) =>
  lines(s).map((l) => {
    const m = l.match(/^(hr|technical|case|guesstimate)\s*\|\s*(.+)$/i);
    return m
      ? { category: m[1].toLowerCase(), question: m[2] }
      : { category: 'hr', question: l };
  });

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { register, handleSubmit, reset, formState } = useForm();

  const load = () => listCompanies().then((res) => setCompanies(res.data));
  useEffect(() => {
    load();
  }, []);

  const onCreate = async (form) => {
    const payload = {
      name: form.name,
      sector: form.sector,
      website: form.website || undefined,
      headquarters: form.headquarters || undefined,
      salaryRange: form.salaryRange || undefined,
      overview: form.overview,
      businessModel: form.businessModel || undefined,
      whatTheyLookFor: form.whatTheyLookFor || undefined,
      roles: lines(form.roles),
      rounds: lines(form.rounds),
      interviewQuestions: parseQuestions(form.interviewQuestions),
      prepTips: lines(form.prepTips),
    };
    try {
      await createCompany(payload);
      toast.success('Company card published');
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish');
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteCompany(id);
      toast.success('Company deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <AdminShell
      title="Company prep cards"
      icon={Briefcase}
      subtitle="Publish one page per recruiter — students see them under Companies"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
            <input {...register('name', { required: true })} placeholder="Company name *" aria-label="Company name" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <select {...register('sector', { required: true })} aria-label="Sector" className={inputClass}>
                {SECTORS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <input {...register('salaryRange')} placeholder="Salary range (e.g. ₹4 – 7 LPA)" aria-label="Salary range" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input {...register('website')} placeholder="Website URL" aria-label="Website" className={inputClass} />
              <input {...register('headquarters')} placeholder="Headquarters" aria-label="Headquarters" className={inputClass} />
            </div>
            <textarea {...register('overview', { required: true })} rows={3} placeholder="Overview — what they do *" aria-label="Overview" className={inputClass} />
            <textarea {...register('businessModel')} rows={2} placeholder="How they make money" aria-label="Business model" className={inputClass} />
            <textarea {...register('whatTheyLookFor')} rows={2} placeholder="What they look for in candidates" aria-label="What they look for" className={inputClass} />
            <textarea {...register('roles')} rows={2} placeholder={'Roles — one per line\nBusiness Analyst\nHR Associate'} aria-label="Roles" className={inputClass} />
            <textarea {...register('rounds')} rows={3} placeholder={'Hiring rounds — one per line, in order\nAptitude test\nGroup discussion\nHR interview'} aria-label="Hiring rounds" className={inputClass} />
            <textarea
              {...register('interviewQuestions')}
              rows={4}
              placeholder={'Interview questions — one per line as "category | question"\nhr | Why our company?\ncase | Client profits fell 10%. Diagnose.\n(categories: hr, technical, case, guesstimate)'}
              aria-label="Interview questions"
              className={inputClass}
            />
            <textarea {...register('prepTips')} rows={2} placeholder={'Prep tips — one per line'} aria-label="Prep tips" className={inputClass} />
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {formState.isSubmitting ? 'Publishing…' : 'Publish company card'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <p className="mb-2 text-xs text-gray-400">
            {companies ? `${companies.length} card${companies.length === 1 ? '' : 's'} published` : 'Loading…'}
          </p>
          <ul className="max-h-[36rem] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
            {companies?.map((c) => (
              <li key={c._id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-gray-400">
                    {c.sector?.replace('_', ' ')} · {c.salaryRange || 'no salary info'} · {c.views || 0} views
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link to={`/companies/${c.slug}`} aria-label="View card" className="rounded p-1 text-gray-400 hover:text-indigo-500">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button onClick={() => setConfirmDeleteId(c._id)} aria-label="Delete card" className="rounded p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            {companies?.length === 0 && <li className="py-2 text-sm text-gray-400">No company cards yet.</li>}
          </ul>
        </div>
      </div>
      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => onDelete(confirmDeleteId)}
        title="Delete company card"
        message="This company card and all its prep content will be permanently deleted."
        danger
        confirmLabel="Delete"
      />
    </AdminShell>
  );
}
