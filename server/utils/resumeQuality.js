/**
 * Normalisation and completeness scoring for resumes.
 *
 * Normalisation exists because the builder and the schema drifted apart: the
 * form posted `education[].year`, `experience[].company`, `projects[].technologies`
 * and `achievements` as `{title, description}` objects, while the schema stored
 * `years`, `organization`, no technologies, and achievements as bare strings.
 * Mongoose drops unknown subpaths without complaining, so those answers were
 * written into a black hole and the preview rendered blanks for them. The
 * schema is now the form's shape; this module accepts either spelling so
 * documents saved before the fix keep rendering.
 *
 * Completeness scoring is the other half: a resume is only worth emailing to a
 * recruiter when the sections that recruiters actually read are filled in, so
 * the score weights those sections rather than counting fields.
 */

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);

/** Drop entries whose every value is blank — the form always renders one empty row. */
const nonEmpty = (items) => items.filter((it) => Object.values(it).some(Boolean));

/**
 * Accept either a bare string or a {title, description} object.
 * Legacy documents stored achievements/leadership as plain strings.
 */
const toTitled = (entry) => {
  if (typeof entry === 'string') return { title: str(entry), description: '' };
  return { title: str(entry?.title), description: str(entry?.description) };
};

/**
 * Coerce an arbitrary request body into the canonical stored shape.
 *
 * The returned object is spread straight into a `$set`, so every key here is a
 * path the save is allowed to overwrite — and, just as importantly, anything
 * absent from it survives untouched. The photo's `url`/`publicId` are
 * deliberately absent: they belong to the upload route, and a form body echoing
 * a stale copy of them back would otherwise let a draft save undo an upload the
 * student made seconds earlier.
 */
function normalizeResume(body = {}) {
  const p = body.personal || {};

  const fields = {
    personal: {
      fullName: str(p.fullName),
      email: str(p.email),
      phone: str(p.phone),
      location: str(p.location),
      linkedin: str(p.linkedin),
      website: str(p.website),
    },
    summary: str(body.summary),
    education: nonEmpty(
      arr(body.education).map((e) => ({
        degree: str(e?.degree),
        institution: str(e?.institution),
        // `years` is the pre-fix spelling.
        year: str(e?.year) || str(e?.years),
        score: str(e?.score),
      }))
    ),
    experience: nonEmpty(
      arr(body.experience).map((e) => ({
        role: str(e?.role),
        // `company` is what the form sent before the schema was aligned.
        organization: str(e?.organization) || str(e?.company),
        duration: str(e?.duration),
        description: str(e?.description),
      }))
    ),
    projects: nonEmpty(
      arr(body.projects).map((pr) => ({
        title: str(pr?.title),
        description: str(pr?.description),
        technologies: str(pr?.technologies),
        link: str(pr?.link),
      }))
    ),
    skills: [...new Set(arr(body.skills).map(str).filter(Boolean))],
    certifications: nonEmpty(
      arr(body.certifications).map((c) => ({
        name: str(c?.name),
        issuer: str(c?.issuer),
        year: str(c?.year),
      }))
    ),
    achievements: nonEmpty(arr(body.achievements).map(toTitled)),
    leadership: nonEmpty(arr(body.leadership).map(toTitled)),
  };

  // Whether to *show* the photo is the student's to change from the builder, so
  // it does travel with a save — as a dot path, which touches the one flag and
  // leaves the sibling url/publicId in place. Setting `photo` as an object here
  // would replace the whole sub-document and take the file with it.
  if (typeof body.photo?.visible === 'boolean') fields['photo.visible'] = body.photo.visible;

  return fields;
}

/**
 * Weighted by what a recruiter screens on, not by field count. Contact details
 * and education are table stakes; experience and projects are what actually
 * differentiates a student, so they carry the most weight.
 */
const CHECKS = [
  { key: 'name', label: 'Your full name', weight: 8, met: (r) => Boolean(r.personal?.fullName) },
  {
    key: 'contact',
    label: 'An email and a phone number',
    weight: 10,
    met: (r) => Boolean(r.personal?.email && r.personal?.phone),
  },
  {
    key: 'linkedin',
    label: 'A LinkedIn or portfolio link',
    weight: 6,
    met: (r) => Boolean(r.personal?.linkedin || r.personal?.website),
  },
  {
    key: 'summary',
    // Under ~40 characters is a placeholder, not a summary.
    label: 'A professional summary of at least 40 characters',
    weight: 12,
    met: (r) => str(r.summary).length >= 40,
  },
  { key: 'education', label: 'At least one education entry', weight: 12, met: (r) => arr(r.education).length > 0 },
  {
    key: 'experience',
    label: 'At least one experience entry with a description',
    weight: 20,
    met: (r) => arr(r.experience).some((e) => e.role && e.description),
  },
  {
    key: 'projects',
    label: 'At least two projects',
    weight: 16,
    met: (r) => arr(r.projects).filter((p) => p.title && p.description).length >= 2,
  },
  { key: 'skills', label: 'At least five skills', weight: 10, met: (r) => arr(r.skills).length >= 5 },
  {
    key: 'proof',
    label: 'A certification or an achievement',
    weight: 6,
    met: (r) => arr(r.certifications).length > 0 || arr(r.achievements).length > 0,
  },
];

/**
 * @returns {{score:number, met:string[], missing:string[], ready:boolean}}
 *   `ready` marks a resume complete enough to put in front of a recruiter.
 */
function scoreResume(resume = {}) {
  const met = [];
  const missing = [];
  let earned = 0;
  let total = 0;

  for (const check of CHECKS) {
    total += check.weight;
    if (check.met(resume)) {
      earned += check.weight;
      met.push(check.label);
    } else {
      missing.push(check.label);
    }
  }

  const score = Math.round((earned / total) * 100);
  return { score, met, missing, ready: score >= 70 };
}

module.exports = { normalizeResume, scoreResume, CHECKS };
