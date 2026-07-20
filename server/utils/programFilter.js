/**
 * Program Personalization Filtering Utilities
 * Used across controllers to add program-based filtering to queries
 */

/**
 * Get program filter object for database queries
 * @param {Object} user - req.user object containing program info
 * @returns {Object} MongoDB filter object or empty object if no program
 */
function getProgramFilter(user) {
  if (!user?.program?.id) return {};
  return { program: user.program.id };
}

/**
 * Add program field to creation objects
 * @param {Object} user - req.user object containing program info
 * @returns {Object} Object with program field
 */
function getProgramCreateField(user) {
  return { program: user?.program?.id || null };
}

/**
 * Merge program filter with existing filter
 * @param {Object} user - req.user object
 * @param {Object} existingFilter - Existing MongoDB query filter
 * @returns {Object} Merged filter
 */
function mergeWithProgramFilter(user, existingFilter = {}) {
  const programFilter = getProgramFilter(user);
  if (Object.keys(programFilter).length === 0) return existingFilter;
  return { ...existingFilter, ...programFilter };
}

module.exports = {
  getProgramFilter,
  getProgramCreateField,
  mergeWithProgramFilter,
};
