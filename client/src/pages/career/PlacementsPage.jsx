import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { Briefcase, Calendar, Building2, Plus, ChevronRight, CheckCircle2, Clock, XCircle, TrendingUp } from 'lucide-react';
import { listDrives, createDrive, updateDrive, deleteDrive, applyToDrive, listMyApplications, updateMyApplication } from '../../api/placements';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import DateInput from '../../components/common/DateInput';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Page } from '../../components/common/motion';
import AIInsight from '../../components/common/AIInsight';
import PageHeader from '../../components/common/PageHeader';

const STATUS_COLORS = {
  upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const APP_STATUS = {
  applied:     { label: 'Applied',     color: 'text-blue-600',   icon: Clock },
  shortlisted: { label: 'Shortlisted', color: 'text-amber-600',  icon: TrendingUp },
  interview:   { label: 'Interview',   color: 'text-purple-600', icon: ChevronRight },
  offer:       { label: 'Offer',       color: 'text-emerald-600',icon: CheckCircle2 },
  rejected:    { label: 'Rejected',    color: 'text-red-500',    icon: XCircle },
};


function DriveCard({ drive, onApply }) {
  const deadline = drive.applicationDeadline ? new Date(drive.applicationDeadline) : null;
  const daysLeft = deadline ? Math.ceil((deadline - Date.now()) / 86400000) : null;
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{drive.company}</p>
          <p className="text-sm text-gray-500">{drive.name}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[drive.status]}`}>
          {drive.status}
        </span>
      </div>
      {drive.role && <p className="mb-1 text-sm"><span className="font-medium">Role:</span> {drive.role}</p>}
      {drive.package && <p className="mb-1 text-sm"><span className="font-medium">Package:</span> {drive.package}</p>}
      {drive.eligibility && <p className="mb-1 text-xs text-gray-500">Eligibility: {drive.eligibility}</p>}
      {deadline && (
        <p className={`mb-3 flex items-center gap-1 text-xs ${daysLeft < 3 ? 'text-red-500' : 'text-gray-400'}`}>
          <Calendar className="h-3.5 w-3.5" />
          Deadline: {deadline.toLocaleDateString()} {daysLeft !== null && `(${daysLeft}d left)`}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onApply(drive)}
          className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Track Application
        </button>
        {drive.applyLink && (
          <a
            href={drive.applyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Apply
          </a>
        )}
      </div>
    </div>
  );
}

function ApplicationCard({ app, onUpdate }) {
  const drive = app.drive;
  const meta = APP_STATUS[app.status];
  const Icon = meta.icon;
  const steps = ['applied', 'shortlisted', 'interview', 'offer'];
  const stepIdx = steps.indexOf(app.status);

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="font-semibold">{drive?.company || '—'}</p>
          <p className="text-sm text-gray-500">{drive?.role || drive?.name}</p>
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium ${meta.color}`}>
          <Icon className="h-3.5 w-3.5" /> {meta.label}
        </span>
      </div>
      {app.status !== 'rejected' && (
        <div className="mb-3 flex gap-1">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIdx ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(APP_STATUS).map(([key, v]) => (
          <button
            key={key}
            onClick={() => onUpdate(app._id, key)}
            disabled={app.status === key}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              app.status === key
                ? 'bg-indigo-600 text-white'
                : 'border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PlacementsPage() {
  useDocumentTitle('Placement Hub');
  const [tab, setTab] = useState('drives');
  const [drives, setDrives] = useState(null);
  const [apps, setApps] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [applyDrive, setApplyDrive] = useState(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  useEffect(() => { loadDrives(); }, [statusFilter]);
  useEffect(() => { if (tab === 'applications') loadApps(); }, [tab]);

  const loadDrives = () => {
    listDrives(statusFilter ? { status: statusFilter } : {})
      .then((r) => setDrives(r.data))
      .catch(() => setDrives([]));
  };

  const loadApps = () => {
    listMyApplications().then((r) => setApps(r.data)).catch(() => setApps([]));
  };

  const onAddDrive = async (data) => {
    try {
      await createDrive(data);
      toast.success('Drive added');
      setShowAdd(false);
      reset();
      loadDrives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add drive');
    }
  };

  const onApply = async (data) => {
    try {
      await applyToDrive(applyDrive._id, { status: data.status || 'applied', notes: data.notes });
      toast.success('Application tracked');
      setApplyDrive(null);
      if (tab === 'applications') loadApps();
    } catch (err) {
      toast.error('Failed');
    }
  };

  const onUpdateApp = async (appId, status) => {
    try {
      await updateMyApplication(appId, { status });
      setApps((prev) => prev.map((a) => (a._id === appId ? { ...a, status } : a)));
    } catch { toast.error('Update failed'); }
  };

  // Derive AI insight from drive data
  const urgentDrives = (drives || []).filter((d) => {
    if (!d.applicationDeadline) return false;
    const days = Math.ceil((new Date(d.applicationDeadline) - Date.now()) / 86400000);
    return days > 0 && days <= 21;
  });
  const appliedIds = new Set((apps || []).map((a) => a.drive?._id || a.drive));
  const urgentNotApplied = urgentDrives.filter((d) => !appliedIds.has(d._id));
  const placementInsight = urgentNotApplied.length > 0
    ? `${urgentNotApplied[0].company} closes in ${Math.ceil((new Date(urgentNotApplied[0].applicationDeadline) - Date.now()) / 86400000)} days — you haven't tracked an application yet`
    : drives?.length > 0 && (apps || []).length === 0
    ? 'You have access to placement drives but haven\'t tracked any application yet'
    : null;

  return (
    <Page>
      <PageHeader
        icon={Briefcase}
        title="Placement Hub"
        subtitle="Track every drive, application, and your interview journey"
        action={{ label: 'Add Drive', onClick: () => setShowAdd(true), icon: Plus }}
      />

      {placementInsight && (
        <AIInsight
          insight={placementInsight}
          why="Tracking applications helps DATAD predict your placement readiness and surface the right prep materials at the right time."
          action={{ label: 'Track Application', to: '#' }}
          confidence={urgentNotApplied.length > 0 ? 'high' : 'medium'}
          source="Based on your application history and upcoming deadlines"
          dismissKey={`placement-${new Date().toISOString().slice(0,10)}`}
        />
      )}

      <div className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900/50 w-fit">
        {[['drives', 'All Drives'], ['applications', 'My Applications']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white shadow-sm dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'drives' && (
        <>
          <div className="mb-4 flex gap-2 flex-wrap">
            {['', 'upcoming', 'active', 'closed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
          {drives === null ? (
            <FeedSkeleton count={3} />
          ) : drives.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No drives yet"
              description="Add placement drives to start tracking your applications"
              cta={{ label: 'Add Drive', onClick: () => setShowAdd(true) }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {drives.map((d) => <DriveCard key={d._id} drive={d} onApply={setApplyDrive} />)}
            </div>
          )}
        </>
      )}

      {tab === 'applications' && (
        apps === null ? <FeedSkeleton count={3} /> :
        apps.length === 0 ? (
          <EmptyState icon={Briefcase} title="No applications tracked" description="Click 'Track Application' on any drive to get started" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {apps.map((a) => <ApplicationCard key={a._id} app={a} onUpdate={onUpdateApp} />)}
          </div>
        )
      )}

      {/* Add Drive Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); }} title="Add Placement Drive">
        <form onSubmit={handleSubmit(onAddDrive)} className="space-y-3">
          <input {...register('name', { required: true })} placeholder="Drive name *" className="input" />
          <input {...register('company', { required: true })} placeholder="Company *" className="input" />
          <input {...register('role')} placeholder="Role / position" className="input" />
          <input {...register('package')} placeholder="Package (e.g. ₹6–8 LPA)" className="input" />
          <input {...register('eligibility')} placeholder="Eligibility criteria" className="input" />
          <DateInput {...register('applicationDeadline')} />
          <input {...register('applyLink')} placeholder="Apply link (optional)" className="input" />
          <select {...register('status')} className="input">
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Add Drive</button>
          </div>
        </form>
      </Modal>

      {/* Apply Modal */}
      <Modal open={!!applyDrive} onClose={() => setApplyDrive(null)} title={`Track: ${applyDrive?.company}`}>
        <form onSubmit={handleSubmit(onApply)} className="space-y-3">
          <select {...register('status')} className="input">
            {Object.entries(APP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <textarea {...register('notes')} placeholder="Notes (optional)" rows={3} className="input" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setApplyDrive(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
