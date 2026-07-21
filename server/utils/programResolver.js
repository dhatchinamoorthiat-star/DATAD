const CONFIG = require('../config/programs.json');

const CURATED_IDS = new Set(CONFIG.programs.map((p) => p.id));

// (course, specialization) → curated program id.
//
// Only combinations we have real tagging rules for live here; everything else
// gets its own slug and is treated as uncurated (type 'custom'), which routes
// it through admin approval. Mapping a course onto a curated id also merges its
// feed and community with that program's — so a pairing has to be one students
// would genuinely want to share a space with, not just a loose thematic match.
const CURATED_COMBOS = {
  'mba|*': 'mba',
  'b.tech|cse': 'btech-cs',
  'b.tech|it': 'btech-cs',
  'b.tech|mechanical': 'beng-mechanical',
  'm.sc|cs': 'msc-cs',
  'm.sc|computer science': 'msc-cs',
  'ba|economics': 'ba-economics',
  'ba|psychology': 'bsc-psychology',
  'b.sc|psychology': 'bsc-psychology',
  'law|*': 'llb',
};

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Derive a program from the course/specialization the registration form
 * already collects. There is deliberately no separate program picker: asking
 * a student their degree twice, once for the profile and once for the feed,
 * is how the two drift apart.
 *
 * Never throws — an unrecognised or blank course yields the 'general' program
 * rather than blocking signup.
 */
function resolveProgramFromCourse({ course, specialization, graduationYear, college } = {}) {
  const rawCourse = String(course || '').trim();
  const rawSpec = String(specialization || '').trim();

  const base = {
    specialization: rawSpec || null,
    cohort: graduationYear ? Number(graduationYear) : null,
    institution: college || null,
  };

  if (!rawCourse) {
    // Signup must survive a skipped academic step. 'general' is the existing
    // discipline-agnostic default and is curated, so it counts as preset —
    // telling someone their degree needs admin review when they simply didn't
    // pick one would be nonsense.
    return { id: 'general', label: 'General', type: 'preset', customName: null, category: null, ...base };
  }

  const key = `${rawCourse.toLowerCase()}|${rawSpec.toLowerCase()}`;
  const wildcard = `${rawCourse.toLowerCase()}|*`;
  const curatedId = CURATED_COMBOS[key] || CURATED_COMBOS[wildcard];

  if (curatedId && CURATED_IDS.has(curatedId)) {
    const preset = CONFIG.programs.find((p) => p.id === curatedId);
    return {
      id: preset.id,
      // The student's own wording wins over the config's generic label when
      // they picked a specialization — "BTech Computer Science (CSE)".
      label: rawSpec ? `${preset.label} (${rawSpec})` : preset.label,
      type: 'preset',
      customName: null,
      category: preset.category || null,
      ...base,
    };
  }

  // Uncurated: the student's own words become their program.
  const id = rawSpec ? slugify(`${rawCourse}-${rawSpec}`) : slugify(rawCourse);
  return {
    id: id || 'general',
    label: rawSpec ? `${rawCourse} (${rawSpec})` : rawCourse,
    type: 'custom',
    customName: rawCourse,
    category: null,
    ...base,
  };
}

module.exports = { resolveProgramFromCourse, slugify, CURATED_COMBOS };
