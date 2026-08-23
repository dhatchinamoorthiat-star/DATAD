import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { Users, Search, Edit2, ExternalLink, Link2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SmartSelect from '../../components/common/SmartSelect';
import { getDirectory, getMyProfile, upsertMyProfile } from '../../api/directory';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Page } from '../../components/common/motion';

function Avatar({ name, avatar, size = 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-12 w-12 text-base', lg: 'h-20 w-20 text-2xl' };
  if (avatar) return <img src={avatar} alt={name} className={`${sizes[size]} rounded-full object-cover`} />;
  return (
    <div className={`${sizes[size]} flex items-center justify-center rounded-full bg-indigo-500 font-bold text-white`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

export default function DirectoryPage() {
  useDocumentTitle('Student Directory');
  const [profiles, setProfiles] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [specFilter, setSpecFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [view, setView] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm();

  const loadDirectory = useCallback(() => {
    const params = {};
    if (search) params.search = search;
    if (specFilter) params.specialization = specFilter;
    getDirectory(params).then((r) => {
      let list = r.data;
      if (domainFilter) list = list.filter((p) => p.priorDomain === domainFilter);
      setProfiles(list);
    }).catch(() => setProfiles([]));
  }, [search, specFilter, domainFilter]);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);
  useEffect(() => { getMyProfile().then((r) => setMyProfile(r.data)).catch(() => {}); }, []);

  const onSaveProfile = async (data) => {
    try {
      const arr = (field) => data[field] ? data[field].split(',').map((s) => s.trim()).filter(Boolean) : [];
      const res = await upsertMyProfile({
        bio: data.bio, specialization: data.specialization, batch: data.batch,
        skills: arr('skills'), interests: arr('interests'), clubs: arr('clubs'), languages: arr('languages'),
        linkedin: data.linkedin, github: data.github, portfolio: data.portfolio, lookingFor: data.lookingFor,
        priorDomain: data.priorDomain || '',
      });
      setMyProfile(res.data);
      toast.success('Profile updated');
      setEditOpen(false);
      loadDirectory();
    } catch { toast.error('Could not update profile'); }
  };

  const openEdit = () => {
    if (myProfile) {
      reset({
        bio: myProfile.bio || '',
        specialization: myProfile.specialization || '',
        batch: myProfile.batch || '',
        skills: myProfile.skills?.join(', ') || '',
        interests: myProfile.interests?.join(', ') || '',
        clubs: myProfile.clubs?.join(', ') || '',
        languages: myProfile.languages?.join(', ') || '',
        linkedin: myProfile.linkedin || '',
        github: myProfile.github || '',
        portfolio: myProfile.portfolio || '',
        lookingFor: myProfile.lookingFor || '',
        priorDomain: myProfile.priorDomain || '',
      });
    }
    setEditOpen(true);
  };

  const ALL_SPECS = [
    'Finance', 'Marketing', 'HR', 'Operations', 'Analytics', 'Strategy', 'General',
    'CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical',
    'Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science',
    'Accounting', 'English', 'History', 'Political Science', 'Economics', 'Psychology',
    'Corporate', 'Criminal', 'Intellectual Property', 'Family Law',
    'MBBS', 'BDS', 'Nursing', 'Pharmacy',
  ];
  const DIR_DOMAINS = [
    'IT / Software', 'Banking / Finance', 'Consulting', 'Manufacturing / Ops',
    'Healthcare', 'FMCG / Retail', 'Govt / PSU', 'Media / Content', 'Startup',
  ];
  const specs = [...new Set(profiles?.map((p) => p.specialization).filter(Boolean) || [])];
  const domains = [...new Set(profiles?.map((p) => p.priorDomain).filter(Boolean) || [])];

  return (
    <Page overview={{
      pageKey: 'community-directory',
      title: 'Find the right batchmate',
      blurb: 'A searchable profile directory — skills, interests, prior background — so you know who to ask for what.',
      takeaway: 'Fill in your own profile so others can find you too.',
    }}>
      <PageHeader
        icon={Users}
        title="Student Directory"
        subtitle="Find the right batchmate for anything"
        action={{ label: 'My Profile', onClick: openEdit, icon: Edit2 }}
      />

      <div className="mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900" />
        </div>
        {specs.length > 0 && (
          <select value={specFilter} onChange={(e) => setSpecFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-900">
            <option value="">All specializations</option>
            {specs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {domains.length > 0 && (
          <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-900">
            <option value="">All backgrounds</option>
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {profiles === null ? <FeedSkeleton count={6} /> : profiles.length === 0 ? (
        <EmptyState icon={Users} title="No profiles yet" description="Set up your profile to appear in the directory" cta={{ label: 'Set up profile', onClick: openEdit }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <button key={p._id} onClick={() => setView(p)}
              className="group rounded-2xl border border-gray-200/80 bg-white p-5 text-left hover:border-indigo-300 dark:border-gray-800/80 dark:bg-gray-900">
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={p.user?.name} avatar={p.user?.avatarUrl} />
                <div>
                  <p className="font-semibold">{p.user?.name}</p>
                  {p.specialization && <p className="text-xs text-gray-500">{p.specialization}</p>}
                  {p.priorDomain && <p className="text-[11px] text-amber-600 dark:text-amber-400">{p.priorDomain}</p>}
                </div>
              </div>
              {p.bio && <p className="mb-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{p.bio}</p>}
              <div className="flex flex-wrap gap-1">
                {p.skills?.slice(0, 4).map((s) => <span key={s} className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{s}</span>)}
                {p.skills?.length > 4 && <span className="text-xs text-gray-400">+{p.skills.length - 4}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* View Profile Modal */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.user?.name || 'Profile'}>
        {view && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={view.user?.name} avatar={view.user?.avatarUrl} size="lg" />
              <div>
                <p className="text-lg font-bold">{view.user?.name}</p>
                {view.specialization && <p className="text-sm text-gray-500">{view.specialization}</p>}
                {view.batch && <p className="text-xs text-gray-400">Batch {view.batch}</p>}
              </div>
            </div>
            {view.bio && <p className="text-sm text-gray-600 dark:text-gray-300">{view.bio}</p>}
            {view.lookingFor && <p className="text-sm text-indigo-600 dark:text-indigo-400">Looking for: {view.lookingFor}</p>}
            {view.skills?.length > 0 && <div><p className="mb-1 text-xs font-semibold uppercase text-gray-400">Skills</p><div className="flex flex-wrap gap-1">{view.skills.map((s) => <span key={s} className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{s}</span>)}</div></div>}
            {view.interests?.length > 0 && <div><p className="mb-1 text-xs font-semibold uppercase text-gray-400">Interests</p><div className="flex flex-wrap gap-1">{view.interests.map((s) => <span key={s} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs dark:bg-gray-800">{s}</span>)}</div></div>}
            <div className="flex gap-3">
              {view.linkedin && <a href={view.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700"><Link2 className="h-3.5 w-3.5" />LinkedIn</a>}
              {view.github && <a href={view.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700"><Link2 className="h-3.5 w-3.5" />GitHub</a>}
              {view.portfolio && <a href={view.portfolio} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700"><ExternalLink className="h-3.5 w-3.5" />Portfolio</a>}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Profile Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="My Profile">
        <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-3">
          <textarea {...register('bio')} placeholder="Short bio (max 300 chars)" maxLength={300} rows={2} className="input" />
          <SmartSelect
            options={ALL_SPECS}
            value={watch('specialization') || ''}
            onChange={(val) => setValue('specialization', val)}
            label="Specialisation"
            placeholder="Select…"
            allowOther={true}
            variant="dropdown"
            name="specialization"
          />
          <input {...register('batch')} placeholder="Batch / year (e.g. 2025-27)" className="input" />
          <input {...register('skills')} placeholder="Skills (comma-sep: Excel, Python, Financial Modelling)" className="input" />
          <input {...register('interests')} placeholder="Interests (comma-sep: VC, Consulting, FMCG)" className="input" />
          <input {...register('clubs')} placeholder="Clubs / committees (comma-sep)" className="input" />
          <input {...register('languages')} placeholder="Languages (comma-sep)" className="input" />
          <input {...register('linkedin')} placeholder="LinkedIn URL" className="input" />
          <input {...register('github')} placeholder="GitHub URL (optional)" className="input" />
          <input {...register('portfolio')} placeholder="Portfolio / website URL (optional)" className="input" />
          <input {...register('lookingFor')} placeholder="Looking for (e.g. study partner, project teammate)" className="input" />
          <SmartSelect
            options={DIR_DOMAINS}
            value={watch('priorDomain') || ''}
            onChange={(val) => setValue('priorDomain', val)}
            label="Past work domain"
            placeholder="Select…"
            allowOther={true}
            variant="dropdown"
            name="priorDomain"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Save</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}