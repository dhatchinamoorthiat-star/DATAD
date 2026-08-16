/**
 * Profile event handler — rebuilds the student's intelligence profile
 * asynchronously when triggered by a profile.refresh-needed event.
 *
 * Before the event bus, this ran synchronously on every AI request.
 * Now it can run in the background, and the AI request reads the last
 * cached profile (or triggers a refresh if stale).
 */
const intelligenceLayer = require('../../ai/intelligence-layer');

/**
 * Handle a profile.refresh-needed event.
 * Rebuilds the student's intelligence profile and stores it in the
 * intelligence layer's cache.
 */
async function handleProfileRefresh(event) {
  const { userId } = event;

  if (!userId) {
    throw new Error('profile.refresh-needed requires a userId');
  }

  const profile = await intelligenceLayer.buildStudentProfile(userId);
  if (!profile) {
    throw new Error(`Failed to build profile for user ${userId}`);
  }

  // The profile is now cached in the intelligence layer.
  // Subsequent AI requests will read the fresh profile.
  // Event: emit profile.refreshed so downstream consumers can react.
  const events = require('../index');
  await events.emit('profile.refreshed', userId, {
    readinessScore: profile.scores?.readinessScore ?? null,
    intelligenceScore: profile.scores?.intelligenceScore ?? null,
  }).catch(() => {});
}

module.exports = handleProfileRefresh;
