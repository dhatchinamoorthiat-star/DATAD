import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { GraduationCap, Star, Users, Search, Plus, Phone } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { listSkills, createSkill, deleteSkill, rateSkill } from '../../api/skills';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import { Page } from '../../components/common/motion';

function StarRating({ value, max = 5, onChange }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type={onChange ? 'button' : 'button'}
          onClick={() => onChange?.(i + 1)}
          className={`text-lg ${i < Math.round(value || 0) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function SkillExchangePage() {
  useDocumentTitle('Skill Exchange');
  const { user } = useAuth();
  const [skills, setSkills] = useState(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [contactCard, setContactCard] = useState(null);
  const [rateCard, setRateCard] = useState(null);
  const [ratingVal, setRatingVal] = useState(5);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const load = useCallback(() => {
    listSkills(search ? { search } : {}).then((r) => setSkills(r.data)).catch(() => setSkills([]));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const onAdd = async (data) => {
    try {
      const tags = data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      await createSkill({ ...data, tags });
      toast.success('Skill listed!');
      setShowAdd(false);
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const onRate = async () => {
    try {
      await rateSkill(rateCard._id, { rating: ratingVal });
      toast.success('Rating submitted');
      setRateCard(null);
      load();
    } catch { toast.error('Could not submit rating'); }
  };

  const onDelete = async (id) => {
    try {
      await deleteSkill(id);
      setSkills((prev) => prev.filter((s) => s._id !== id));
    } catch { toast.error('Could not delete skill listing'); }
  };

  return (
    <Page overview={{
      pageKey: 'community-skills',
      title: 'Teach, learn, collaborate',
      blurb: 'A peer-to-peer skill board — batchmates offering to teach something, and batchmates looking to learn it.',
      takeaway: 'Offer a skill you know, or book a session with someone who does.',
    }}>
      <PageHeader
        icon={GraduationCap}
        title="Skill Exchange"
        subtitle="Everyone teaches, everyone learns"
        action={{ label: 'Offer a Skill', onClick: () => setShowAdd(true), icon: Plus }}
      />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills, tags…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      {skills === null ? <FeedSkeleton count={4} /> : skills.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No skills listed yet" description="Offer what you know and help a batchmate" cta={{ label: 'Offer a Skill', onClick: () => setShowAdd(true) }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((s) => (
            <div key={s._id} className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold">{s.skill}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <Users className="h-3.5 w-3.5" /> {s.user?.name}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  s.mode === 'online' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : s.mode === 'in-person' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {s.mode}
                </span>
              </div>
              {s.description && <p className="mb-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{s.description}</p>}
              {s.availability && <p className="mb-2 text-xs text-gray-400">Available: {s.availability}</p>}
              <div className="mb-3 flex flex-wrap gap-1">
                {s.tags?.map((t) => <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{t}</span>)}
              </div>
              <div className="flex items-center justify-between">
                {s.avgRating ? (
                  <button onClick={() => setRateCard(s)} className="flex items-center gap-1 text-xs text-amber-500">
                    <Star className="h-3.5 w-3.5 fill-current" /> {s.avgRating} ({s.ratingCount})
                  </button>
                ) : (
                  <button onClick={() => setRateCard(s)} className="text-xs text-gray-400 hover:text-amber-500">Rate</button>
                )}
                <div className="flex gap-2">
                  {user?._id === s.user?._id && (
                    <button onClick={() => onDelete(s._id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  )}
                  <button onClick={() => setContactCard(s)} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">
                    <Phone className="h-3.5 w-3.5" /> Book
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); }} title="Offer a Skill">
        <form onSubmit={handleSubmit(onAdd)} className="space-y-3">
          <input {...register('skill', { required: true })} placeholder="Skill name * (e.g. Excel, Python, Public Speaking)" className="input" />
          <textarea {...register('description')} placeholder="Describe what you'll teach and how" rows={3} className="input" />
          <select {...register('mode')} className="input">
            <option value="both">Online & In-person</option>
            <option value="online">Online only</option>
            <option value="in-person">In-person only</option>
          </select>
          <input {...register('availability')} placeholder="Availability (e.g. Weekends, evenings)" className="input" />
          <input {...register('contact')} placeholder="Contact (LinkedIn URL or email)" className="input" />
          <input {...register('tags')} placeholder="Tags (comma-separated: Finance, Excel, MBA)" className="input" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">List Skill</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!contactCard} onClose={() => setContactCard(null)} title="Book a Session">
        <div className="space-y-3">
          <p className="font-medium">{contactCard?.skill} with {contactCard?.user?.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{contactCard?.description}</p>
          {contactCard?.contact && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-xs text-gray-500 mb-1">Contact</p>
              <p className="text-sm font-medium break-all">{contactCard.contact}</p>
            </div>
          )}
          <p className="text-xs text-gray-400">Available: {contactCard?.availability || 'Not specified'}</p>
        </div>
      </Modal>

      <Modal open={!!rateCard} onClose={() => setRateCard(null)} title={`Rate: ${rateCard?.skill}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">How was the session with {rateCard?.user?.name}?</p>
          <StarRating value={ratingVal} onChange={setRatingVal} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setRateCard(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button onClick={onRate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Submit</button>
          </div>
        </div>
      </Modal>
    </Page>
  );
}
