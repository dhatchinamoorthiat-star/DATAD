import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProgramContext } from '../../context/ProgramContext';
import { ProgramBadge } from '../../components/program/ProgramBadge';
import { Page } from '../../components/common/motion';
import Button from '../../components/common/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import toast from 'react-hot-toast';
import { BookOpen, Edit2, Lock, AlertCircle } from 'lucide-react';

export default function ProgramSettingsPage() {
  useDocumentTitle('Program Settings');
  const { user } = useAuth();
  const program = useProgramContext();
  const [changeReason, setChangeReason] = useState('');
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const canChangeProgram = !user?.programHistory || user.programHistory.length === 0;

  const handleRequestChange = async () => {
    if (!changeReason.trim()) {
      toast.error('Please select a reason for changing');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement program change request endpoint
      toast.success('Program change requested! Admin will review shortly.');
      setShowChangeForm(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request change');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="mx-auto max-w-3xl px-4 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Program Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your academic program and preferences</p>
        </div>

        {/* Current Program Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-950/30 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Current Program
                </p>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {program.label}
                </h2>
              </div>
            </div>
            <ProgramBadge size="sm" />
          </div>

          {/* Program Details */}
          <div className="space-y-3 mb-6">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                {program.isPreset ? '✓ Preset Program' : '✨ Custom Program'}
              </p>
            </div>

            {program.specialization && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Specialization</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {program.specialization}
                </p>
              </div>
            )}

            {program.institution && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Institution</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {program.institution}
                </p>
              </div>
            )}

            {program.cohort && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Expected Graduation</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {program.cohort}
                </p>
              </div>
            )}
          </div>

          {/* Personalization Info */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Everything personalized:</strong> Your entire DATAD experience—news, companies, career paths, community, and study materials—are tailored to your {program.label} program.
            </p>
          </div>

          {/* Program History */}
          {user?.programHistory && user.programHistory.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Program History</h3>
              <div className="space-y-3">
                {user.programHistory.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <div className="mt-1 w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 shrink-0" />
                    <div>
                      <p>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {entry.program.label}
                        </span>
                        {' '}
                        ({entry.reason.replace(/_/g, ' ')})
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(entry.changedAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Change Program Section */}
        {canChangeProgram ? (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  Change Program
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                  You can change your program once due to graduation, transfer, or career change.
                </p>
              </div>
            </div>

            {!showChangeForm ? (
              <Button
                onClick={() => setShowChangeForm(true)}
                variant="outline"
                className="gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Request Program Change
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Reason for Change *
                  </label>
                  <select
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a reason...</option>
                    <option value="graduation_completed">Graduation Completed</option>
                    <option value="transfer_certificate">Transfer Certificate (TC)</option>
                    <option value="career_change">Career Change</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleRequestChange}
                    disabled={!changeReason || loading}
                    loading={loading}
                  >
                    Submit Request
                  </Button>
                  <Button
                    onClick={() => {
                      setShowChangeForm(false);
                      setChangeReason('');
                    }}
                    variant="outline"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Program Already Changed
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You've already used your one program change. To change again, please contact support.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Note:</strong> Changing your program will reset all your program-specific content (study notes, tasks, events) to match your new program. This action cannot be undone.
          </p>
        </div>
      </div>
    </Page>
  );
}
