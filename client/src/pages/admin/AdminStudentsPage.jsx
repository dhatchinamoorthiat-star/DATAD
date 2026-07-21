import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { listStudents, approveStudent, rejectStudent } from '../../api/admin';
import { formatDate } from '../../utils/dateUtils';
import Loader from '../../components/common/Loader';
import { AdminShell } from './shared';
import ConfirmModal from '../../components/common/ConfirmModal';

const DOMAIN_LABEL = {
  business: 'Business',
  'engineering-tech': 'Engineering / Tech',
  science: 'Science',
  'medicine-health': 'Medicine / Health',
  'psychology-mentalhealth': 'Psychology / Mental Health',
  law: 'Law',
  'arts-humanities': 'Arts / Humanities',
  general: 'General',
};

function Chips({ items }) {
  if (!items || items.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {item}
        </span>
      ))}
    </div>
  );
}

function StudentProfilePanel({ profile }) {
  if (!profile) {
    return <p className="py-3 text-xs text-gray-400">No profile data submitted at registration.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 border-t border-gray-100 py-3 text-xs sm:grid-cols-2 dark:border-gray-800">
      <div>
        <p className="mb-0.5 font-semibold text-gray-500 dark:text-gray-400">Course / Specialization</p>
        <p className="text-gray-800 dark:text-gray-200">{profile.course || '—'}{profile.specialization ? ` — ${profile.specialization}` : ''}</p>
      </div>
      <div>
        <p className="mb-0.5 font-semibold text-gray-500 dark:text-gray-400">Domain</p>
        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
          {DOMAIN_LABEL[profile.domainPrimary] || profile.domainPrimary || 'General'}
        </span>
      </div>
      <div>
        <p className="mb-0.5 font-semibold text-gray-500 dark:text-gray-400">College</p>
        <p className="text-gray-800 dark:text-gray-200">{profile.college || '—'}</p>
      </div>
      <div>
        <p className="mb-0.5 font-semibold text-gray-500 dark:text-gray-400">Dream role</p>
        <p className="text-gray-800 dark:text-gray-200">{profile.dreamRole || '—'}</p>
      </div>
      <div>
        <p className="mb-1 font-semibold text-gray-500 dark:text-gray-400">Career interests</p>
        <Chips items={profile.careerInterests} />
      </div>
      <div>
        <p className="mb-1 font-semibold text-gray-500 dark:text-gray-400">Skills</p>
        <Chips items={profile.skills} />
      </div>
      <div>
        <p className="mb-1 font-semibold text-gray-500 dark:text-gray-400">Preferred industries</p>
        <Chips items={profile.preferredIndustries} />
      </div>
      <div>
        <p className="mb-1 font-semibold text-gray-500 dark:text-gray-400">Goals</p>
        <Chips items={profile.goals} />
      </div>
    </div>
  );
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [confirmReject, setConfirmReject] = useState(null); // student object

  const load = () => listStudents().then((res) => setStudents(res.data));
  useEffect(() => {
    load();
  }, []);

  const onApprove = async (s) => {
    try {
      await approveStudent(s._id);
      toast.success(`${s.name} approved — they've been emailed`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    }
  };

  const onReject = async (s) => {
    try {
      await rejectStudent(s._id);
      toast.success('Pending account removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    }
  };

  if (!students) return <Loader />;

  const pending = students.filter((s) => s.status === 'pending').length;

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AdminShell
      title={`Students (${students.length})`}
      icon={Users}
      subtitle={pending ? `${pending} signup${pending === 1 ? '' : 's'} waiting for your approval` : 'Everyone is approved'}
    >
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {students.map((s) => (
            <li key={s._id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleExpanded(s._id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  {expanded.has(s._id) ? (
                    <ChevronUp className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {s.name}
                      {s.role === 'admin' && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          admin
                        </span>
                      )}
                      {s.status === 'pending' && (
                        <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                          pending
                        </span>
                      )}
                      {/* The main bot signal: an unconfirmed address means
                          nobody has proven they can receive mail there. */}
                      {!s.emailVerifiedAt && s.status === 'pending' && (
                        <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                          unconfirmed email
                        </span>
                      )}
                      {s.program?.label && (
                        <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {s.program.label}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-gray-400">{s.email}</p>
                  </div>
                </button>
                {s.status === 'pending' ? (
                  <div className="ml-2 flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => onApprove(s)}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setConfirmReject(s)}
                      className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-red-300 hover:text-red-500 dark:border-gray-700"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="ml-2 shrink-0 text-xs text-gray-400">{formatDate(s.createdAt)}</span>
                )}
              </div>
              {expanded.has(s._id) && <StudentProfilePanel profile={s.profile} />}
            </li>
          ))}
        </ul>
      </div>
      <ConfirmModal
        open={!!confirmReject}
        onClose={() => setConfirmReject(null)}
        onConfirm={() => onReject(confirmReject)}
        title="Reject account"
        message={confirmReject ? `Reject and remove ${confirmReject.name}'s pending account? This cannot be undone.` : ''}
        danger
        confirmLabel="Reject"
      />
    </AdminShell>
  );
}
