/**
 * Event handler registration.
 *
 * Called by the worker process (worker.js) to register all event handlers.
 * Each handler is a function: async (event) => void
 * Registered by event type prefix, so "profile." matches "profile.refresh-needed".
 */
const events = require('../index');
const profileHandler = require('./profile');
const { registerAll: registerNotificationBridge } = require('../bindNotifications');

function registerHandlers() {
  events.on('profile.', profileHandler);

  // Bridge domain events → in-app notifications
  registerNotificationBridge(events);

  // Future handlers:
  // events.on('recommendation.', require('./recommendation'));
  // events.on('feedback.', require('./feedback'));
  // events.on('placement.', require('./placement'));

  // Catch-all: log every event for observability
  events.onAny((event) => {
    // In production this would write to a metrics stream
    if (process.env.NODE_ENV === 'development') {
      // console.debug(`[events] ${event.type} (${event.userId})`);
    }
  });
}

module.exports = { registerHandlers };
