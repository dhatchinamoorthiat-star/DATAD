/**
 * Program personalization query helpers.
 *
 * Two shapes exist and they are not interchangeable:
 *
 *   `program`  (string)  — user-generated content that belongs to exactly one
 *                          program: posts, notes, events, tasks, listings.
 *   `programs` (array)   — curated catalogue rows that can serve several
 *                          programs at once: companies, resources, news.
 *
 * The array shape also has a meaningful empty state. A row tagged with no
 * programs is shared material, not orphaned material, so it stays visible to
 * everyone — that is what keeps a newly-created program from opening onto a
 * completely empty catalogue.
 */

// ── Single-program content (`program: 'mba'`) ───────────────────────────────

function getProgramFilter(user) {
  if (!user?.program?.id) return {};
  return { program: user.program.id };
}

function getProgramCreateField(user) {
  return { program: user?.program?.id || null };
}

function mergeWithProgramFilter(user, existingFilter = {}) {
  const programFilter = getProgramFilter(user);
  if (Object.keys(programFilter).length === 0) return existingFilter;
  return { ...existingFilter, ...programFilter };
}

// ── Multi-program catalogue (`programs: ['mba', 'btech-cs']`) ───────────────

/**
 * Rows tagged for this program, plus untagged rows that are shared with
 * everyone. Returns {} when the user has no program so nothing is hidden from
 * accounts that predate personalization.
 */
function getProgramsFilter(user) {
  const id = user?.program?.id;
  if (!id) return {};
  return {
    $or: [
      { programs: id },
      { programs: { $size: 0 } },
      // Rows written before the field existed have no `programs` key at all.
      { programs: { $exists: false } },
    ],
  };
}

/**
 * Merge into an existing filter. Uses $and rather than a spread because the
 * caller may already own `$or` (a text search, say) — spreading would silently
 * drop one of the two conditions and widen the query.
 */
function mergeWithProgramsFilter(user, existingFilter = {}) {
  const programsFilter = getProgramsFilter(user);
  if (!programsFilter.$or) return existingFilter;
  if (!Object.keys(existingFilter).length) return programsFilter;
  return { $and: [existingFilter, programsFilter] };
}

module.exports = {
  getProgramFilter,
  getProgramCreateField,
  mergeWithProgramFilter,
  getProgramsFilter,
  mergeWithProgramsFilter,
};
