import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Sparkles, Loader2, AlertTriangle, CheckCircle2, RefreshCw, Trash2,
  CalendarClock, Save, Send, ExternalLink,
} from 'lucide-react';
import DateInput from '../../components/common/DateInput';
import Button from '../../components/common/Button';
import { AdminShell, inputClass } from './shared';
import {
  getItem, updateItem, publishItem, draftItem, scheduleItem, reanalyzeItem,
  removeItem, listDestinations,
} from '../../api/studio';
import { listAlbums } from '../../api/albums';
import { listCompanies } from '../../api/companies';

const META_FIELDS = [
  { name: 'title', label: 'Title' },
  { name: 'description', label: 'Description', textarea: true },
  { name: 'subject', label: 'Subject' },
  { name: 'semester', label: 'Semester' },
  { name: 'course', label: 'Course' },
  { name: 'company', label: 'Company' },
  { name: 'category', label: 'Category' },
];

function ConfidenceBadge({ value }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.8
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : value >= 0.5
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      <Sparkles className="h-3 w-3" /> {pct}% confident
    </span>
  );
}

export default function AdminStudioReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [meta, setMeta] = useState(null);
  const [destKey, setDestKey] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [published, setPublished] = useState(false);

  const load = () =>
    getItem(id).then((res) => {
      setItem(res.data);
      if (res.data.meta && meta === null && res.data.status !== 'analyzing' && res.data.status !== 'uploaded') {
        setMeta({ extra: {}, ...res.data.meta });
        setTagsText((res.data.meta.tags || []).join(', '));
        setDestKey(res.data.destination?.key || '');
      }
    });

  useEffect(() => {
    load().catch(() => setError('Item not found'));
    listDestinations().then((res) => setDestinations(res.data));
    listAlbums().then((res) => setAlbums(res.data)).catch(() => {});
    listCompanies().then((res) => setCompanies(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll while analysis is in flight.
  const analyzing = item && (item.status === 'analyzing' || item.status === 'uploaded');
  useEffect(() => {
    if (!analyzing) return;
    const t = setInterval(() => load().catch(() => {}), 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzing]);

  const destination = useMemo(
    () => destinations.find((d) => d.key === destKey),
    [destinations, destKey]
  );

  const saveMeta = async () => {
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    const res = await updateItem(id, { meta: { ...meta, tags }, destinationKey: destKey });
    setItem(res.data);
    return res.data;
  };

  const act = (name, fn) => async () => {
    setBusy(name);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.response?.data?.message || `${name} failed`);
    } finally {
      setBusy('');
    }
  };

  const handlePublish = (resolution) =>
    act('publish', async () => {
      await saveMeta();
      const res = await publishItem(id, resolution);
      setItem(res.data);
      setPublished(true);
    })();

  const editable = item && !['published', 'rejected'].includes(item.status);

  if (error && !item) {
    return (
      <AdminShell title="Content Studio" icon={Sparkles}>
        <p className="text-sm text-rose-600">{error}</p>
      </AdminShell>
    );
  }
  if (!item) {
    return (
      <AdminShell title="Content Studio" icon={Sparkles}>
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={analyzing ? 'Analyzing upload…' : 'Review & publish'}
      icon={Sparkles}
      subtitle={item.file?.originalName}
    >
      <Link to="/admin/studio" className="mb-4 inline-block text-xs text-indigo-500 hover:underline">
        ← All uploads
      </Link>

      {published && (
        <div className="animate-in mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" /> Published to {destination?.label || destKey}.
          <button onClick={() => navigate('/admin/studio')} className="ml-auto text-xs underline">
            Back to Studio
          </button>
        </div>
      )}

      {analyzing ? (
        <div className="flex flex-col items-center rounded-2xl border border-gray-200 py-14 dark:border-gray-800">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">Dax is reading your file…</p>
          <p className="mt-1 text-xs text-gray-500">Extracting text, generating metadata and picking a destination.</p>
        </div>
      ) : item.status === 'failed' ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm dark:border-rose-900 dark:bg-rose-950/30">
          <p className="mb-2 flex items-center gap-2 font-medium text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" /> Analysis failed
          </p>
          <p className="mb-3 text-rose-600 dark:text-rose-400">{item.rejectedReason}</p>
          <Button variant="danger" size="sm" onClick={act('reanalyze', async () => { await reanalyzeItem(id); await load(); })}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry analysis
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[280px,1fr]">
          {/* Preview pane */}
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              {item.analysis?.thumbnailUrl ? (
                <img src={item.analysis.thumbnailUrl} alt="preview" className="w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-gray-50 text-xs text-gray-400 dark:bg-gray-900">
                  No preview
                </div>
              )}
            </div>
            <a
              href={item.file?.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Open original file
            </a>
            <dl className="rounded-xl border border-gray-200 p-3 text-xs dark:border-gray-800">
              {[
                ['Type', item.file?.type],
                ['Size', item.file?.size ? `${(item.file.size / 1024 / 1024).toFixed(2)} MB` : '—'],
                ['Pages', item.file?.pageCount || '—'],
                ['Language', item.analysis?.language || '—'],
                ['Handwritten', item.analysis?.handwritten == null ? '—' : item.analysis.handwritten ? 'Likely' : 'No'],
                ['Model', item.analysis?.model || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                  <dd className="font-medium">{String(v)}</dd>
                </div>
              ))}
            </dl>
            {item.analysis?.summary && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs dark:border-indigo-900 dark:bg-indigo-950/30">
                <p className="mb-1 flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-300">
                  <Sparkles className="h-3 w-3" /> Dax summary
                </p>
                <p className="text-gray-600 dark:text-gray-300">{item.analysis.summary}</p>
              </div>
            )}
          </div>

          {/* Edit pane */}
          <div className="space-y-4">
            {item.duplicateOf && item.status !== 'published' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
                <p className="mb-1 flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {item.duplicateKind === 'exact' ? 'Exact duplicate detected' : 'Similar content already exists'}
                </p>
                <p className="text-amber-700/80 dark:text-amber-300/80">
                  “{item.duplicateOf.meta?.title || item.duplicateOf.analysis?.title || item.duplicateOf.file?.originalName}”
                  {' '}({item.duplicateOf.status}). Publishing offers replace / new-version below.
                </p>
              </div>
            )}

            {/* Destination picker */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p id="destination-group-label" className="text-xs font-semibold uppercase tracking-wide text-gray-500">Destination</p>
                <ConfidenceBadge value={item.analysis?.confidence} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-labelledby="destination-group-label">
                {destinations.map((d) => {
                  const disabled = d.fileTypes && !d.fileTypes.includes(item.file?.type);
                  return (
                    <button
                      key={d.key}
                      disabled={disabled || !editable}
                      onClick={() => setDestKey(d.key)}
                      title={d.description}
                      className={`rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                        destKey === d.key
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-gray-200 hover:border-indigo-300 dark:border-gray-700'
                      }`}
                    >
                      {d.label}
                      {item.analysis?.suggestedDestination === d.key && (
                        <span className="mt-0.5 block text-[10px] font-normal text-indigo-400">Dax pick</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metadata form */}
            {meta && (
              <div className="grid gap-3 sm:grid-cols-2">
                {META_FIELDS.map((f) => (
                  <div key={f.name} className={f.textarea ? 'sm:col-span-2' : ''}>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {f.label}
                      {destination?.requiredFields?.includes(f.name) && <span className="text-rose-500"> *</span>}
                    </label>
                    {f.textarea ? (
                      <textarea
                        rows={3}
                        className={inputClass}
                        disabled={!editable}
                        value={meta[f.name] || ''}
                        onChange={(e) => setMeta({ ...meta, [f.name]: e.target.value })}
                      />
                    ) : (
                      <input
                        className={inputClass}
                        disabled={!editable}
                        value={meta[f.name] || ''}
                        onChange={(e) => setMeta({ ...meta, [f.name]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                <div>
                  <label htmlFor="admin-studio-review-tags-comma-separated" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Tags (comma-separated)
                  </label>
                  <input id="admin-studio-review-tags-comma-separated"
                    className={inputClass}
                    disabled={!editable}
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="admin-studio-review-visibility" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Visibility
                  </label>
                  <select id="admin-studio-review-visibility"
                    className={inputClass}
                    disabled={!editable}
                    value={meta.visibility || 'members'}
                    onChange={(e) => setMeta({ ...meta, visibility: e.target.value })}
                  >
                    <option value="members">Members</option>
                    <option value="public">Public</option>
                    <option value="admins">Admins only</option>
                  </select>
                </div>

                {/* Destination-specific fields */}
                {destination?.extraFields?.map((f) => (
                  <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {f.label}
                      {f.required && <span className="text-rose-500"> *</span>}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea
                        rows={4}
                        className={inputClass}
                        disabled={!editable}
                        value={meta.extra?.[f.name] || ''}
                        onChange={(e) => setMeta({ ...meta, extra: { ...meta.extra, [f.name]: e.target.value } })}
                      />
                    ) : f.type === 'company' ? (
                      <select
                        className={inputClass}
                        disabled={!editable}
                        value={meta.extra?.[f.name] || ''}
                        onChange={(e) => setMeta({ ...meta, extra: { ...meta.extra, [f.name]: e.target.value } })}
                      >
                        <option value="">Select company…</option>
                        {companies.map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    ) : f.type === 'album' ? (
                      <select
                        className={inputClass}
                        disabled={!editable}
                        value={meta.extra?.[f.name] || ''}
                        onChange={(e) => setMeta({ ...meta, extra: { ...meta.extra, [f.name]: e.target.value } })}
                      >
                        <option value="">Select album…</option>
                        {albums.map((a) => (
                          <option key={a._id} value={a._id}>{a.title}</option>
                        ))}
                      </select>
                    ) : f.options ? (
                      <select
                        className={inputClass}
                        disabled={!editable}
                        value={meta.extra?.[f.name] || f.options[0]}
                        onChange={(e) => setMeta({ ...meta, extra: { ...meta.extra, [f.name]: e.target.value } })}
                      >
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className={inputClass}
                        disabled={!editable}
                        value={meta.extra?.[f.name] || ''}
                        onChange={(e) => setMeta({ ...meta, extra: { ...meta.extra, [f.name]: e.target.value } })}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

            {/* Actions */}
            {editable && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                {item.duplicateOf ? (
                  <>
                    <button
                      onClick={() => handlePublish('replace')}
                      disabled={!!busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Publish & replace old
                    </button>
                    <button
                      onClick={() => handlePublish('version')}
                      disabled={!!busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                    >
                      Publish as new version
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handlePublish()}
                    disabled={!!busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Publish
                  </button>
                )}
                <button
                  onClick={act('draft', async () => { await saveMeta(); const r = await draftItem(id); setItem(r.data); })}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                >
                  <Save className="h-4 w-4" /> Save draft
                </button>
                <button
                  onClick={() => setShowSchedule((s) => !s)}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                >
                  <CalendarClock className="h-4 w-4" /> Schedule
                </button>
                <button
                  onClick={act('reanalyze', async () => { await reanalyzeItem(id); setMeta(null); await load(); })}
                  disabled={!!busy}
                  title="Ask Dax to re-analyse"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={act('cancel', async () => { await removeItem(id); navigate('/admin/studio'); })}
                  disabled={!!busy}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-4 w-4" /> Cancel
                </button>
              </div>
            )}
            {showSchedule && editable && (
              <div className="flex items-center gap-2">
                <DateInput
                  type="datetime-local"
                  className="max-w-xs"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
                <button
                  onClick={act('schedule', async () => {
                    await saveMeta();
                    const r = await scheduleItem(id, new Date(scheduleAt).toISOString());
                    setItem(r.data);
                    setShowSchedule(false);
                  })}
                  disabled={!scheduleAt || !!busy}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  Confirm schedule
                </button>
              </div>
            )}
            {item.status === 'scheduled' && (
              <p className="text-sm text-sky-600 dark:text-sky-400">
                Scheduled for {new Date(item.scheduledFor).toLocaleString()}.
              </p>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
