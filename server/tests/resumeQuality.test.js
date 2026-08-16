/**
 * The bug this exists to prevent shipped and stayed hidden for a while: the
 * resume builder posted `education[].year`, `experience[].company`,
 * `projects[].technologies` and `achievements` as `{title, description}`
 * objects, while the Mongoose schema declared `years`, `organization`, no
 * technologies at all, and achievements as bare strings.
 *
 * Mongoose silently drops subpaths it does not recognise. So every one of those
 * answers was accepted, acknowledged with "Resume saved", and thrown away — and
 * the preview page, which read the schema spelling, rendered blanks where the
 * student had typed. Nothing threw and nothing logged.
 *
 * The schema now matches the form, and normalizeResume() accepts the old
 * spelling so documents written before the fix still render. These tests pin
 * both halves down, plus the completeness score that decides what the
 * submission email tells the student to improve.
 */

const { normalizeResume, scoreResume, CHECKS } = require('../utils/resumeQuality');

// A resume that satisfies every check, in the current spelling.
const complete = () => ({
  personal: {
    fullName: 'Asha Menon',
    email: 'asha@example.edu',
    phone: '9000000000',
    location: 'Chennai',
    linkedin: 'linkedin.com/in/asha',
    website: '',
  },
  summary: 'Final-year analytics student focused on demand forecasting and pricing.',
  education: [{ degree: 'B.Sc Statistics', institution: 'Presidency', year: '2022-2025', score: '8.7' }],
  experience: [
    { role: 'Data Intern', organization: 'Zoho', duration: 'Summer 2024', description: 'Cut ETL runtime by 40%.' },
  ],
  projects: [
    { title: 'Churn model', description: 'Gradient boosted churn scorer.', technologies: 'Python', link: '' },
    { title: 'Price tracker', description: 'Scrapes and alerts on price drops.', technologies: 'Node', link: '' },
  ],
  skills: ['SQL', 'Python', 'Pandas', 'Tableau', 'dbt'],
  certifications: [{ name: 'Google Data Analytics', issuer: 'Google', year: '2024' }],
  achievements: [{ title: 'Rank 1, inter-college datathon', description: '' }],
  leadership: [{ title: 'Secretary, Stats Club', description: '' }],
});

describe('normalizeResume', () => {
  it('keeps the fields the builder actually posts', () => {
    const out = normalizeResume(complete());

    expect(out.education[0].year).toBe('2022-2025');
    expect(out.experience[0].organization).toBe('Zoho');
    expect(out.projects[0].technologies).toBe('Python');
    expect(out.achievements[0]).toEqual({ title: 'Rank 1, inter-college datathon', description: '' });
  });

  it('migrates the pre-fix spellings rather than dropping them', () => {
    const out = normalizeResume({
      education: [{ degree: 'B.Com', years: '2019-2022' }],
      experience: [{ role: 'Analyst', company: 'Freshworks' }],
      achievements: ['Winner, hackathon'],
      leadership: ['Class representative'],
    });

    expect(out.education[0].year).toBe('2019-2022');
    expect(out.experience[0].organization).toBe('Freshworks');
    expect(out.achievements[0]).toEqual({ title: 'Winner, hackathon', description: '' });
    expect(out.leadership[0]).toEqual({ title: 'Class representative', description: '' });
  });

  it('prefers the current spelling when a payload carries both', () => {
    const out = normalizeResume({
      education: [{ year: '2025', years: '1999' }],
      experience: [{ organization: 'Real', company: 'Stale' }],
    });

    expect(out.education[0].year).toBe('2025');
    expect(out.experience[0].organization).toBe('Real');
  });

  it('drops the blank rows the form always renders, and trims and dedupes skills', () => {
    const out = normalizeResume({
      education: [{ degree: 'B.A.' }, { degree: '', institution: '', year: '', score: '' }],
      projects: [{ title: '', description: '' }],
      skills: ['  SQL  ', 'SQL', '', 'Python'],
    });

    expect(out.education).toHaveLength(1);
    expect(out.projects).toHaveLength(0);
    expect(out.skills).toEqual(['SQL', 'Python']);
  });

  it('never carries through a field the caller invented', () => {
    const out = normalizeResume({ user: 'someone-elses-id', _id: 'forged', isAdmin: true });

    expect(out.user).toBeUndefined();
    expect(out._id).toBeUndefined();
    expect(out.isAdmin).toBeUndefined();
  });

  it('survives an empty body', () => {
    expect(() => normalizeResume()).not.toThrow();
    expect(normalizeResume().skills).toEqual([]);
  });
});

describe('scoreResume', () => {
  it('scores a fully filled resume at 100 and ready', () => {
    const result = scoreResume(normalizeResume(complete()));

    expect(result.score).toBe(100);
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('scores an empty resume at 0 and lists every gap', () => {
    const result = scoreResume(normalizeResume({}));

    expect(result.score).toBe(0);
    expect(result.ready).toBe(false);
    expect(result.missing).toHaveLength(CHECKS.length);
  });

  it('names the specific gap, since that list is what the email tells them to fix', () => {
    const draft = complete();
    draft.skills = ['SQL'];
    const result = scoreResume(normalizeResume(draft));

    expect(result.missing).toEqual(['At least five skills']);
    expect(result.score).toBeLessThan(100);
  });

  it('does not accept a placeholder summary', () => {
    const draft = complete();
    draft.summary = 'TODO';

    expect(scoreResume(normalizeResume(draft)).missing).toContain(
      'A professional summary of at least 40 characters'
    );
  });

  it('requires a description on experience, not just a job title', () => {
    const draft = complete();
    draft.experience = [{ role: 'Intern', organization: 'Acme', duration: '2024', description: '' }];

    expect(scoreResume(normalizeResume(draft)).missing).toContain(
      'At least one experience entry with a description'
    );
  });

  it('holds ready at the 70 threshold the email subject line switches on', () => {
    // Weights total 100, so dropping the two lightest checks lands at exactly 88
    // and dropping experience (20) as well lands below the line.
    const draft = complete();
    draft.experience = [];
    draft.projects = [];

    const result = scoreResume(normalizeResume(draft));
    expect(result.score).toBeLessThan(70);
    expect(result.ready).toBe(false);
  });
});
