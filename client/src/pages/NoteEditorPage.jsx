import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from '../utils/toast';
import { Paperclip, Link2, X, Upload, FileText, FileSpreadsheet, File, Loader2 } from 'lucide-react';
import Button from '../components/common/Button';
import { getNote, createNote, updateNote } from '../api/notes';
import { SUBJECTS } from '../utils/constants';
import api from '../api/axios';


const FILE_ICONS = {
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  ppt: File,
  default: File,
};

function AttachmentIcon({ fileType }) {
  const Icon = FILE_ICONS[fileType] || FILE_ICONS.default;
  return <Icon className="h-4 w-4 text-gray-400" />;
}

export default function NoteEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { register, handleSubmit, reset, watch, formState } = useForm();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [attachments, setAttachments] = useState([]);
  const [linkInput, setLinkInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const subject = watch('subject');

  useEffect(() => {
    if (isEdit) {
      getNote(id).then((res) => {
        const { title, subject, semester, content, customSubject, attachments: att } = res.data;
        reset({ title, subject, semester, content, customSubject });
        setAttachments(att || []);
      });
    }
  }, [id, isEdit, reset]);

  const handleFileUpload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/notes/upload-attachment', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setAttachments((prev) => [...prev, res.data]);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
  };

  const addLink = () => {
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    try { new URL(trimmed); } catch { toast.error('Invalid URL'); return; }
    const name = trimmed.includes('drive.google.com') ? 'Google Drive link'
      : trimmed.includes('docs.google.com') ? 'Google Docs link'
      : trimmed.includes('sheets.google.com') ? 'Google Sheets link'
      : 'External link';
    setAttachments((prev) => [...prev, { name, url: trimmed, fileType: 'link', size: 0 }]);
    setLinkInput('');
  };

  const removeAttachment = (i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i));

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, attachments };
      if (isEdit) {
        await updateNote(id, payload);
        toast.success('Note updated');
        navigate(`/study/notes/${id}`);
      } else {
        const res = await createNote(payload);
        toast.success('Note created');
        navigate(`/study/notes/${res.data._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save note');
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1.5 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{isEdit ? 'Edit note' : 'New note'}</h1>
      {!isEdit && (
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          Paraphrase, don&rsquo;t copy — putting it in your own words is where the learning happens.
        </p>
      )}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card space-y-5 p-6"
      >
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">Title</label>
          <input id="title" {...register('title', { required: true })} className="input" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium">Subject</label>
            <select id="subject" {...register('subject', { required: true })} className="input">
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="semester" className="mb-1 block text-sm font-medium">
              Semester <span className="text-gray-400">(optional)</span>
            </label>
            <input id="semester" {...register('semester')} placeholder="e.g. Sem 2" className="input" />
          </div>
        </div>

        {/* Mandatory custom subject when "Other" is selected */}
        {subject === 'Other' && (
          <div>
            <label htmlFor="customSubject" className="mb-1 block text-sm font-medium">
              Specify subject <span className="text-danger-500">*</span>
            </label>
            <input
              id="customSubject"
              {...register('customSubject', { required: subject === 'Other' })}
              placeholder="e.g. Business Law, Entrepreneurship…"
              className="input"
            />
            {formState.errors.customSubject && (
              <p className="mt-1 text-xs text-danger-500">Please specify the subject name</p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="content" className="mb-1 block text-sm font-medium">Content</label>
          <textarea
            id="content"
            rows={10}
            {...register('content')}
            placeholder="What did you learn today? Explain it the way you'd tell a friend before the exam…"
            className="input"
          />
        </div>

        {/* Attachments section */}
        <div>
          <p className="mb-2 text-sm font-medium">Attachments <span className="text-xs font-normal text-gray-400">(files, PDFs, Drive links, docs, Excel…)</span></p>

          {/* Existing attachments */}
          {attachments.length > 0 && (
            <ul className="mb-3 space-y-2">
              {attachments.map((att, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                  <AttachmentIcon fileType={att.fileType} />
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-primary-600 hover:underline dark:text-primary-400">
                    {att.name}
                  </a>
                  <span className="shrink-0 text-xs text-gray-400 uppercase">{att.fileType}</span>
                  <button type="button" onClick={() => removeAttachment(i)} className="shrink-0 text-gray-400 hover:text-danger-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add link */}
          <div className="flex gap-2 mb-2">
            <input
              type="url"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
              placeholder="Paste Google Drive / Docs / any link…"
              className="input"
            />
            <button
              type="button"
              onClick={addLink}
              className="flex shrink-0 items-center gap-1 rounded-full border border-gray-300 px-3.5 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <Link2 className="h-4 w-4" /> Add
            </button>
          </div>

          {/* File upload */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.gif"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-2xl border border-dashed border-gray-300 px-4 py-3 w-full text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/50 dark:border-gray-700 dark:hover:border-primary-500 disabled:opacity-60 transition-colors"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload PDF, Word, Excel, PPT, or any file'}
            </button>
            <p className="mt-1 text-xs text-gray-400">Max 50 MB per file</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <Button type="submit" disabled={formState.isSubmitting || uploading}>
            {formState.isSubmitting ? 'Saving…' : 'Save note'}
          </Button>
        </div>
      </form>
    </div>
  );
}
