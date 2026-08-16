/**
 * BusEvent — the atomic unit of change in DATAD's event-driven architecture.
 *
 * Every meaningful state change produces a BusEvent. Consumers (workers)
 * pick up events asynchronously and react: updating the intelligence layer,
 * sending notifications, triggering recomputation, etc.
 *
 * Event types (taxonomy from the implementation blueprint):
 *
 *   intelligence:
 *     profile.{refresh-needed, refreshed, corrected-by-student}
 *     collector.{completed, failed}
 *
 *   recommendation:
 *     recommendation.{seen, dismissed, acted-on, completed}
 *     generator.{reweight, disable, enable}
 *
 *   learning:
 *     feedback.{recorded, threshold-met}
 *     outcome.{recorded, analyzed}
 *
 *   career:
 *     placement.{applied, shortlisted, offered, rejected}
 *     outcome.{recorded, verified}
 */
const mongoose = require('mongoose');

const busEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      match: /^[a-z]+\.[a-z]+(-[a-z]+)*$/,  // e.g. "profile.refresh-needed" or "planner.task-due-soon"
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    processedAt: Date,
    error: String,
    retryCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// TTL index: clean up processed events after 7 days
busEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Worker polling: find oldest unprocessed events first
busEventSchema.index({ status: 1, createdAt: 1 });

// Lookup by type for metrics and debugging
busEventSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('BusEvent', busEventSchema);
