/**
 * PDF export import.
 *
 * Two things are being protected here.
 *
 * The first is the layout inversion: LinkedIn's PDF prints the company as the
 * block heading with the job title underneath, the opposite of the web page.
 * Get that wrong and every imported profile has the employer sitting in the
 * job-title field — which then fails every check that looks for role
 * terminology in experience, silently and plausibly.
 *
 * The second is the one that would actually harm someone: the export contains
 * no Recommendations, no Featured and no Projects, and only three skills. If
 * those are scored as empty, DATAD tells a student to go and get recommendations
 * they may already have. The rule under test is that a section we could not see
 * causes a check to be SKIPPED, never failed — and never at the cost of a check
 * that already passed on the evidence we do have.
 */

const { parseProfilePdf, extractPdfText, stripPdfNoise, PDF_UNKNOWN_SECTIONS } = require('../utils/linkedin/pdf');
const { scoreProfile } = require('../utils/linkedin/score');
const { analyzeKeywords } = require('../utils/linkedin/keywords');
const { exportPdf, realWorldPdf, nestedRolesPdf, emptyishPdf } = require('./fixtures/linkedinPdf');

const TARGET = { role: 'Product Analyst', industry: 'SaaS', seniority: 'entry' };
const score = (profile, options) => scoreProfile(profile, TARGET, analyzeKeywords(profile, TARGET), options);

describe('extractPdfText', () => {
  it('reads text out of a real PDF buffer', async () => {
    const { text, pages } = await extractPdfText(await exportPdf());
    expect(text).toContain('Asha Menon');
    expect(text).toContain('Experience');
    expect(pages).toBeGreaterThanOrEqual(1);
  });

  it('rejects a file that is not a PDF, whatever it claims to be', async () => {
    // multer trusts the browser's Content-Type, which comes from the file
    // extension — so the bytes are checked again here.
    await expect(extractPdfText(Buffer.from('PK\x03\x04 this is a zip')))
      .rejects.toThrow(/not a PDF/i);
  });

  it('rejects an empty buffer and anything absurdly large', async () => {
    await expect(extractPdfText(Buffer.alloc(0))).rejects.toThrow(/empty/i);
    const huge = Buffer.alloc(11 * 1024 * 1024);
    huge.write('%PDF-');
    await expect(extractPdfText(huge)).rejects.toThrow(/larger than 10 MB/i);
  });
});

describe('stripPdfNoise', () => {
  it('removes page furniture and the repeated profile-URL footer', () => {
    const out = stripPdfNoise('Real content\nPage 1 of 3\n-- 2 of 3 --\nwww.linkedin.com/in/asha-menon\n7\nMore content');
    expect(out).toBe('Real content\nMore content');
  });

  it('leaves a line that merely mentions a page alone', () => {
    expect(stripPdfNoise('Built a landing page for the fest')).toContain('Built a landing page');
  });
});

describe('parseProfilePdf', () => {
  let parsed;
  beforeAll(async () => {
    parsed = await parseProfilePdf(await exportPdf());
  });

  it('reads identity from the main column, not from the Contact sidebar', async () => {
    // The sidebar is extracted first, so a naive "first line is the name"
    // would make this student's name their email address.
    expect(parsed.profile.name).toBe('Asha Menon');
    expect(parsed.profile.headline).toContain('Product Analyst');
    expect(parsed.profile.location).toContain('Chennai');
  });

  it('maps "Summary" onto About', () => {
    expect(parsed.profile.about).toContain('which of these changes actually moved anything');
  });

  it('puts the company in organization and the job title in role', async () => {
    const [first] = parsed.profile.experience;
    expect(first.organization).toBe('Zoho');
    expect(first.role).toBe('Data Analyst Intern');
    expect(first.description).toContain('Rebuilt the onboarding funnel report');
  });

  it('drops the computed duration span from the dates', () => {
    // "June 2024 - August 2024 (3 months)" — the span repeats what the dates
    // already say and would otherwise be scored as part of the entry.
    expect(parsed.profile.experience[0].duration).toBe('June 2024 - August 2024');
  });

  it('reads both experience entries', () => {
    expect(parsed.profile.experience).toHaveLength(2);
    expect(parsed.profile.experience[1].organization).toBe('Presidency College');
  });

  it('reads education, certifications, hyphenated Honors-Awards and languages', () => {
    expect(parsed.profile.education[0]).toMatchObject({ institution: 'Presidency College', degree: 'B.Sc Statistics' });
    expect(parsed.profile.certifications[0].title).toBe('Google Data Analytics');
    expect(parsed.profile.awards[0].title).toMatch(/datathon/);
    expect(parsed.profile.languages).toEqual(expect.arrayContaining(['English', 'Tamil']));
  });

  it('reads the top skills the export does carry', () => {
    expect(parsed.profile.skills.map((s) => s.name)).toEqual(expect.arrayContaining(['SQL', 'Product Analytics', 'A/B Testing']));
  });

  it('picks up the portfolio link from the Contact sidebar', () => {
    expect(parsed.profile.links.some((l) => l.kind === 'github')).toBe(true);
  });

  it('reports what the format could not carry', () => {
    expect(parsed.unknownSections).toEqual(expect.arrayContaining(['recommendations', 'featured', 'projects', 'skills']));
    // And leaves those sections empty rather than inventing them.
    expect(parsed.profile.recommendations).toEqual([]);
    expect(parsed.profile.featured).toEqual([]);
  });

  it('splits a promotion nested under one company heading', async () => {
    const nested = await parseProfilePdf(await nestedRolesPdf());
    const roles = nested.profile.experience;

    expect(roles.length).toBeGreaterThanOrEqual(2);
    expect(roles.every((r) => r.organization === 'Zoho')).toBe(true);
    expect(roles.map((r) => r.role)).toEqual(expect.arrayContaining(['Product Analyst', 'Data Analyst Intern']));
  });

  it('returns a valid empty-ish profile for a near-blank export', async () => {
    const thin = await parseProfilePdf(await emptyishPdf());
    expect(thin.profile.experience).toEqual([]);
    expect(thin.unknownSections).toEqual(PDF_UNKNOWN_SECTIONS);
  });
});

/**
 * Regressions from a real export.
 *
 * Every assertion here corresponds to something that was actually wrong when a
 * genuine LinkedIn PDF was imported through the UI — the tidy fixture above
 * passed 22 tests while the live import returned the student's location as
 * their name. These pin the difference.
 */
describe('a real export\'s quirks', () => {
  let parsed;
  beforeAll(async () => {
    parsed = await parseProfilePdf(await realWorldPdf());
  });

  it('reads the name, not the location, as the name', () => {
    expect(parsed.profile.name).toBe('Meera Krishnan');
  });

  it('recognises a metro-area location that contains no comma', () => {
    expect(parsed.profile.location).toBe('Greater Coimbatore Area');
  });

  it('keeps both lines of a headline that wrapped before its conjunction', () => {
    // The wrap lands before "&", so the join has to look at the start of the
    // next line, not the end of the previous one. Until it did, the second half
    // became the headline and the first half became the person's name.
    expect(parsed.profile.headline).toContain('MBA @ PSG Institute');
    expect(parsed.profile.headline).toContain('CABPIL');
    expect(parsed.profile.headline).toContain('Family Business');
    // The name is the name, not whichever fragment of the headline happened to
    // fall outside the window.
    expect(parsed.profile.name).toBe('Meera Krishnan');
  });

  it('reattaches a company acronym that wrapped onto its own line', () => {
    const entry = parsed.profile.experience.find((e) => /Operations Head/.test(e.role));
    expect(entry.organization).toBe('Coimbatore Amma Baby Products India Limited (CABPIL)');
  });

  it('rejoins a job title that wrapped mid-parenthesis', () => {
    const entry = parsed.profile.experience.find((e) => /Operations Head/.test(e.role));
    expect(entry).toBeDefined();
    expect(entry.role).toContain('promoted from Intern)');
    // And the employer is the employer, not the head of the title.
    expect(entry.organization).toContain('Coimbatore Amma Baby Products');
  });

  it('does not mistake LinkedIn\'s aggregate duration for an employer', () => {
    const orgs = parsed.profile.experience.map((e) => e.organization);
    expect(orgs).not.toContain('2 years 10 months');
    expect(orgs).toContain('Student Council');
  });

  it('splits education into separate schools with degree and dates apart', () => {
    expect(parsed.profile.education).toHaveLength(2);
    expect(parsed.profile.education[0]).toMatchObject({
      institution: 'PSG Institute of Management',
      degree: 'Master of Business Administration',
    });
    expect(parsed.profile.education[0].year).toBe('August 2026 - August 2028');
    expect(parsed.profile.education[1].institution).toBe('Kumaraguru College of Liberal Arts and Science');
  });

  it('rejoins a certification that wrapped between two capitalised words', () => {
    const titles = parsed.profile.certifications.map((c) => c.title);
    expect(titles).toContain('Postive Psychiatry and Mental Health');
    expect(titles).toContain('Economics and Policies of Climate Change');
    expect(titles).not.toContain('Health');
  });

  it('still keeps genuinely separate entries separate', () => {
    // The wrapping fix must not merge two real certifications into one.
    expect(parsed.profile.certifications.map((c) => c.title)).toContain('Psychology of Group Behaviours');
  });
});

describe('scoring a PDF-sourced profile', () => {
  let profile;
  beforeAll(async () => {
    profile = (await parseProfilePdf(await exportPdf())).profile;
  });

  it('skips the checks whose evidence the export cannot contain', () => {
    const scored = score(profile, { unknownSections: PDF_UNKNOWN_SECTIONS });
    const status = (key) => scored.checks.find((c) => c.key === key).status;

    expect(status('social_proof')).toBe('skipped');     // no Recommendations section
    expect(status('featured_proof')).toBe('skipped');   // no Featured section
    expect(status('skills_populated')).toBe('skipped'); // only the top three
  });

  it('says the skip was caused by the file, not by an unanswered question', () => {
    const scored = score(profile, { unknownSections: PDF_UNKNOWN_SECTIONS });
    const social = scored.checks.find((c) => c.key === 'social_proof');
    const photo = scored.checks.find((c) => c.key === 'has_photo');

    expect(social.skippedBecause).toEqual(['recommendations']);
    // The photo question was simply never asked — a different kind of unknown.
    expect(photo.skippedBecause).toBeNull();
  });

  it('scores a PDF import above the same profile scored as if those sections were empty', () => {
    const honest = score(profile, { unknownSections: PDF_UNKNOWN_SECTIONS }).score;
    const naive = score(profile).score;

    // The whole point: without this, a student importing by PDF is punished
    // for choosing the PDF.
    expect(honest).toBeGreaterThan(naive);
  });

  it('never turns a passing check into a skip', () => {
    // Unknown sections may only supply missing evidence. A check that cleared
    // on what we can see must stay cleared, or "unknown" would start costing
    // points in a different direction.
    const withUnknowns = score(profile, { unknownSections: PDF_UNKNOWN_SECTIONS });
    const without = score(profile);

    for (const check of without.checks) {
      if (check.status === 'pass') {
        expect(withUnknowns.checks.find((c) => c.key === check.key).status).toBe('pass');
      }
    }
  });

  it('still fails a check whose evidence was fully visible', () => {
    // Unknown sections must not become a blanket excuse: the About and
    // experience content was right there in the file.
    const scored = score({ ...profile, about: '' }, { unknownSections: PDF_UNKNOWN_SECTIONS });
    expect(scored.checks.find((c) => c.key === 'has_about').status).toBe('fail');
  });

  it('keeps the score inside 0–100 with every dimension inside its maximum', () => {
    const scored = score(profile, { unknownSections: PDF_UNKNOWN_SECTIONS });
    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(100);
    for (const dim of Object.values(scored.dimensions)) {
      expect(dim.score).toBeLessThanOrEqual(dim.max);
    }
  });
});
