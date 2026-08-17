/**
 * A synthetic LinkedIn PDF export, rendered with pdfkit.
 *
 * Generated rather than committed as a binary so the fixture is readable and
 * reviewable — you can see exactly what layout the parser is being held to,
 * which a checked-in PDF would hide.
 *
 * It reproduces the properties of the real export that the parser actually
 * depends on:
 *
 *   • the sidebar (Contact, Top Skills, Languages, Certifications) is emitted
 *     BEFORE the main column, so the name is not the first text on the page;
 *   • "Summary" rather than "About";
 *   • experience blocks lead with the COMPANY, with the job title beneath —
 *     the reverse of the web page;
 *   • dates carry a computed span, "June 2024 - August 2024 (3 months)";
 *   • "Honors-Awards" is hyphenated;
 *   • page furniture ("Page 1 of 2") repeats;
 *   • Recommendations, Featured and Projects are absent entirely.
 *
 * It is a stand-in until a real export is available to pin against; the
 * structural assumptions above are what the tests assert on.
 */

const PDFDocument = require('pdfkit');

function render(lines) {
  return new Promise((resolve, reject) => {
    // compress: false keeps the text stream readable if a test ever needs to
    // inspect the raw bytes, matching utils/resumePdf.js's test affordance.
    const doc = new PDFDocument({ compress: false, margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(10);
    for (const line of lines) {
      if (line === '\f') { doc.addPage(); continue; }
      doc.text(line, { lineGap: 1 });
    }
    doc.end();
  });
}

/** The layout LinkedIn's "Save to PDF" produces. */
const EXPORT_LINES = [
  // ── Sidebar, extracted first ──────────────────────────────────────────
  'Contact',
  'asha.menon@example.com',
  'www.linkedin.com/in/asha-menon',
  'https://github.com/ashamenon',
  '',
  'Top Skills',
  'SQL',
  'Product Analytics',
  'A/B Testing',
  '',
  'Languages',
  'English',
  'Tamil',
  '',
  'Certifications',
  'Google Data Analytics',
  '',
  'Honors-Awards',
  'Rank 1, inter-college datathon 2024',
  '',
  'Page 1 of 2',
  '\f',
  // ── Main column ───────────────────────────────────────────────────────
  'Asha Menon',
  'Product Analyst | SQL, Product Analytics & A/B Testing',
  'Chennai, Tamil Nadu, India',
  '',
  'Summary',
  'I work on the question most product teams answer with a guess: which of these changes actually moved anything. At Zoho I rebuilt the onboarding funnel report in SQL and GA4, which surfaced a drop-off at the email verification step that had been invisible in the old dashboard. The team shipped a fix and activation improved by 12%. I am looking for entry-level Product Analyst roles at SaaS companies.',
  '',
  'Experience',
  '',
  'Zoho',
  'Data Analyst Intern',
  'June 2024 - August 2024 (3 months)',
  'Chennai, Tamil Nadu, India',
  'Rebuilt the onboarding funnel report in SQL and GA4, identifying a verification drop-off that improved activation by 12% once fixed.',
  'Automated a weekly retention cohort report that had taken 4 hours of manual work.',
  '',
  'Presidency College',
  'Research Assistant',
  'January 2023 - May 2024 (1 year 5 months)',
  'Analysed survey responses from 1,200 students using Python and Pandas.',
  '',
  'Education',
  '',
  'Presidency College',
  'B.Sc Statistics',
  '2022 - 2025',
  '',
  'Page 2 of 2',
];

/** A promotion nested under one company heading — two roles, one employer. */
const NESTED_ROLES_LINES = [
  'Asha Menon',
  'Product Analyst',
  'Chennai, India',
  '',
  'Summary',
  'Analytics work across two roles at the same company.',
  '',
  'Experience',
  '',
  'Zoho',
  'Product Analyst',
  'January 2025 - Present (8 months)',
  'Own the activation metrics for the onboarding team.',
  'Data Analyst Intern',
  'June 2024 - December 2024 (7 months)',
  'Rebuilt the onboarding funnel report in SQL.',
  '',
  'Education',
  '',
  'Presidency College',
  'B.Sc Statistics',
  '2022 - 2025',
];

/**
 * The quirks a REAL export turned out to have, which the tidy fixture above
 * does not — every one of these was observed breaking a live import, not
 * imagined:
 *
 *   • the headline wraps onto a second line;
 *   • the location is a metro area with no comma in it ("Greater Coimbatore
 *     Area"), so a comma-based location test misses it and the identity block
 *     slides by one — returning the location as the person's name;
 *   • a job title wraps mid-parenthesis, so its tail looks like the title and
 *     its head looks like the employer;
 *   • LinkedIn prints an aggregate "2 years 10 months" under a company where
 *     several roles were held, which reads as an employer name;
 *   • education arrives as "Degree · (dates)" on one line;
 *   • sidebar certifications wrap between two capitalised words, splitting one
 *     certification into two.
 */
const REAL_WORLD_LINES = [
  'Contact',
  'someone@example.com',
  'www.linkedin.com/in/example',
  '',
  'Top Skills',
  'Tally ERP',
  'Microsoft Excel',
  '',
  'Certifications',
  'Psychology of Group Behaviours',
  'Postive Psychiatry and Mental',
  'Health',
  'Economics and Policies of Climate',
  'Change',
  '',
  'Page 1 of 3',
  '\f',
  'Meera Krishnan',
  // A headline wrapped across THREE lines, breaking in two different places:
  // once straight after an "@", and once before a conjunction so that the
  // continuation begins with "&". Neither break is visible from the end of the
  // previous line alone.
  'MBA @ PSG Institute of Management \u201928 | Ex-Operations Head @',
  'CABPIL | B.Sc. Psychology | Bridging Behavioural Science, Finance',
  '& Systems | Building Toward Finance, IT & Family Business',
  'Greater Coimbatore Area',
  '',
  'Summary',
  'I fix the systems nobody has touched in years, then fix the processes sitting on top of them.',
  '',
  'Experience',
  '',
  // A company whose bracketed acronym wrapped onto its own line.
  'Coimbatore Amma Baby Products India Limited',
  '(CABPIL)',
  'Operations Head & Communications Lead (promoted from Operations',
  'Manager, promoted from Intern)',
  'September 2025 - April 2026 (8 months)',
  'Coimbatore, Tamil Nadu, India',
  'Rebuilt the internal reporting process end to end.',
  '',
  'Student Council',
  '2 years 10 months',
  'President',
  'June 2024 - April 2026 (1 year 11 months)',
  'Led a council of 40 across four committees.',
  '',
  'Education',
  '',
  'PSG Institute of Management',
  'Master of Business Administration · (August 2026 - August 2028)',
  'Kumaraguru College of Liberal Arts and Science',
  'Bachelor of Science - Psychology · (2022 - 2025)',
  '',
  'Page 3 of 3',
];

const exportPdf = () => render(EXPORT_LINES);
const realWorldPdf = () => render(REAL_WORLD_LINES);
const nestedRolesPdf = () => render(NESTED_ROLES_LINES);
const emptyishPdf = () => render(['Contact', 'someone@example.com', 'Page 1 of 1']);

module.exports = { exportPdf, realWorldPdf, nestedRolesPdf, emptyishPdf, render, EXPORT_LINES, REAL_WORLD_LINES };
