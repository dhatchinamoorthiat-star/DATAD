import { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import Button from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';
import toast from '../utils/toast';
import { apiUrl } from '../api/base';

export default function DeveloperPage() {
  useDocumentTitle('Developer');
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchKeys = () =>
    fetch(apiUrl('/keys'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json())
      .then((d) => setKeys(d.keys || []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { fetchKeys(); }, []);

  const generate = async () => {
    if (!newKeyName.trim()) return;
    const res = await fetch(apiUrl('/keys'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ name: newKeyName }),
    });
    if (!res.ok) { toast.error('Failed to create key'); return; }
    const data = await res.json();
    setNewKeyValue(data.key);
    setNewKeyName('');
    toast.success('API key created — copy it now, you won\'t see it again');
    fetchKeys();
  };

  const remove = async (id) => {
    const res = await fetch(apiUrl(`/keys/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    // Revoking a key is the one action here with a security consequence, so a
    // failure must not be reported as success — the user would walk away
    // believing a leaked key was dead.
    if (!res.ok) { toast.error('Could not delete that key — it may already be gone'); fetchKeys(); return; }
    fetchKeys();
    toast.success('Key deleted');
  };

  const copyKey = () => {
    navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Developer</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">API keys for programmatic access to DATAD.</p>

      {/* New key */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Plus className="h-4 w-4" /> Create a new key
        </h2>
        <div className="flex gap-2">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. My App"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <Button onClick={generate} disabled={!newKeyName.trim()}>Generate</Button>
        </div>
        {newKeyValue && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
            <code className="flex-1 break-all font-mono text-amber-800 dark:text-amber-200">{newKeyValue}</code>
            <button onClick={copyKey} className="shrink-0 rounded-lg p-1.5 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Existing keys */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Your API keys</h2>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-400">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k._id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{k.name}</span>
                  {/* The key itself is stored only as a hash, so this prefix is
                      the only way to tell two similarly-named keys apart when
                      deciding which one to revoke. */}
                  {k.keyPrefix && (
                    <code className="font-mono text-[11px] text-gray-400">{k.keyPrefix}…</code>
                  )}
                  <span className="text-[11px] text-gray-400">{k.scopes?.join(', ') || 'read'}</span>
                </div>
                <div className="flex items-center gap-3">
                  {k.lastUsedAt && <span className="text-[11px] text-gray-400">Last used {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                  <button onClick={() => remove(k._id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
