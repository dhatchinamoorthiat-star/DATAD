import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Pencil } from 'lucide-react';
import { getMyResume, downloadResumePdf } from '../api/resume';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import toast from '../utils/toast';

// ATS-friendly on purpose: single column, real selectable text, standard
// section headings, no icons/graphics inside the document itself.
const SectionHeading = ({ children }) => (
  <h2 className="mb-2 mt-5 border-b border-gray-400 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-800">
    {children}
  </h2>
);

// Role/title on the left, dates right-aligned — the scanning pattern every
// recruiter already expects. `break-inside-avoid` keeps one entry from being
// split across two printed pages.
const EntryRow = ({ left, right, sub, subRight }) => (
  <div className="mb-2 break-inside-avoid">
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-semibold">{left}</span>
      {right && <span className="shrink-0 text-[11px] text-gray-600">{right}</span>}
    </div>
    {(sub || subRight) && (
      <div className="flex items-baseline justify-between gap-4 text-[11.5px] italic text-gray-700">
        <span>{sub}</span>
        {subRight && <span className="shrink-0 not-italic">{subRight}</span>}
      </div>
    )}
  </div>
);

// Accepts both shapes: achievements/leadership were stored as bare strings
// before they became {title, description} objects.
const titleOf = (item) => (typeof item === 'string' ? item : item?.title || '');
const descOf = (item) => (typeof item === 'string' ? '' : item?.description || '');

export default function ResumePreviewPage() {
  const [resume, setResume] = useState();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // `null` is the legitimate "no resume yet" state below, so a failed load
    // must land there too rather than sitting on <Loader/> forever.
    getMyResume()
      .then((res) => setResume(res.data))
      .catch(() => setResume(null));
  }, []);

  // The server renders the PDF so the file matches the one mailed on submit.
  // If that call fails we fall back to the browser's own print-to-PDF rather
  // than leaving the button dead.
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await downloadResumePdf();
      const name = resume?.personal?.fullName?.trim().replace(/\s+/g, '-') || 'resume';
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}-Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not build the PDF — opening your print dialog instead');
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  if (resume === undefined) return <Loader />;

  if (!resume) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState
          title="No resume yet"
          subtitle="Fill in your details first"
          action={
            <Link to="/placement/resume" className="text-sm font-medium text-indigo-600 hover:underline">
              Go to Resume Builder
            </Link>
          }
        />
      </div>
    );
  }

  const p = resume.personal || {};
  const contactLine = [p.email, p.phone, p.location, p.linkedin, p.website]
    .filter(Boolean)
    .join('  |  ');
  const bullets = (text) => (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  // Only when one was uploaded *and* left switched on — the builder's toggle
  // keeps the file while taking it off the document, and this is the document.
  const photo = resume.photo?.visible !== false && resume.photo?.url ? resume.photo.url : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { body { background: white; } }`}</style>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/placement/resume" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex gap-2">
          <Link
            to="/placement/resume"
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {downloading ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* The sheet: always paper-white with black text, even in dark mode */}
      <div className="rounded-lg bg-white p-10 text-[12px] leading-[1.5] text-gray-900 shadow print:rounded-none print:p-0 print:shadow-none">
        {/* Two headers, one per case. Without a photo the name and contact line
            stay centred, exactly as before. With one, the whole text block moves
            left and the photo takes the right — centred text under an off-centre
            picture is the one arrangement that looks like a mistake. Kept
            identical to the server renderer in utils/resumePdf.js so the sheet
            on screen and the PDF in the recruiter's inbox agree. */}
        <header
          className={`mb-1 flex items-start gap-6 border-b-2 border-gray-800 pb-3 ${
            photo ? 'text-left' : 'flex-col text-center'
          }`}
        >
          <div className={photo ? 'min-w-0 flex-1' : 'w-full'}>
            <h1 className="text-[26px] font-bold uppercase tracking-[0.18em]">
              {p.fullName || 'Your Name'}
            </h1>
            {contactLine && <p className="mt-1.5 break-words text-[11px] text-gray-700">{contactLine}</p>}
          </div>
          {photo && (
            <img
              src={photo}
              alt=""
              // Fixed box with object-cover: the stored file is already cropped
              // square on the face, and letting a stray aspect ratio through
              // would push the name off its own line.
              className="h-[92px] w-[74px] shrink-0 rounded-sm object-cover"
            />
          )}
        </header>

        {resume.summary && (
          <>
            <SectionHeading>Summary</SectionHeading>
            <p className="text-justify">{resume.summary}</p>
          </>
        )}

        {resume.education?.length > 0 && (
          <>
            <SectionHeading>Education</SectionHeading>
            {resume.education.map((e, i) => (
              <EntryRow
                key={i}
                left={e.degree}
                // `years` is the pre-migration spelling of this field.
                right={e.year || e.years}
                sub={e.institution}
                subRight={e.score}
              />
            ))}
          </>
        )}

        {resume.experience?.length > 0 && (
          <>
            <SectionHeading>Experience</SectionHeading>
            {resume.experience.map((e, i) => (
              <div key={i} className="mb-2.5 break-inside-avoid">
                {/* `company` is the pre-migration spelling of organization. */}
                <EntryRow left={e.role} right={e.duration} sub={e.organization || e.company} />
                <ul className="ml-4 list-outside list-disc space-y-0.5">
                  {bullets(e.description).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}

        {resume.projects?.length > 0 && (
          <>
            <SectionHeading>Projects</SectionHeading>
            {resume.projects.map((pr, i) => (
              <div key={i} className="mb-2 break-inside-avoid">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-semibold">{pr.title}</span>
                  {pr.link && <span className="shrink-0 text-[11px] text-gray-600">{pr.link}</span>}
                </div>
                {pr.description && <p>{pr.description}</p>}
                {pr.technologies && (
                  <p className="text-[11.5px] italic text-gray-700">{pr.technologies}</p>
                )}
              </div>
            ))}
          </>
        )}

        {resume.skills?.length > 0 && (
          <>
            <SectionHeading>Skills</SectionHeading>
            <p>{resume.skills.join(' · ')}</p>
          </>
        )}

        {resume.certifications?.length > 0 && (
          <>
            <SectionHeading>Certifications</SectionHeading>
            <ul className="ml-4 list-outside list-disc space-y-0.5">
              {resume.certifications.map((c, i) => (
                <li key={i}>
                  <span className="font-semibold">{c.name}</span>
                  {c.issuer && ` — ${c.issuer}`}
                  {c.year && ` (${c.year})`}
                </li>
              ))}
            </ul>
          </>
        )}

        {resume.achievements?.length > 0 && (
          <>
            <SectionHeading>Achievements</SectionHeading>
            <ul className="ml-4 list-outside list-disc space-y-0.5">
              {resume.achievements.map((a, i) => (
                <li key={i}>
                  <span className="font-semibold">{titleOf(a)}</span>
                  {descOf(a) && ` — ${descOf(a)}`}
                </li>
              ))}
            </ul>
          </>
        )}

        {resume.leadership?.length > 0 && (
          <>
            <SectionHeading>Leadership & Extracurricular</SectionHeading>
            <ul className="ml-4 list-outside list-disc space-y-0.5">
              {resume.leadership.map((l, i) => (
                <li key={i}>
                  <span className="font-semibold">{titleOf(l)}</span>
                  {descOf(l) && ` — ${descOf(l)}`}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-gray-400 print:hidden">
        Downloads a typeset A4 PDF — the same file we email you when you submit.
      </p>
    </div>
  );
}
