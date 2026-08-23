/**
 * A learned per-student adjustment to one recommendation generator's weight.
 *
 * The learning loop watches which generators a student dismisses and which they
 * act on, and nudges the weights accordingly. Until now those adjustments lived
 * in a process-local Map, so every restart and every deploy threw away
 * everything Dax had learned about what this student finds useful — the student
 * had to dismiss the same generator three more times to get back to where they
 * were.
 *
 * One document per (user, generator). `adjustment` is the delta applied to the
 * caller's default weight, not the weight itself: defaults live in code and can
 * be re-tuned without rewriting what was learned about each student.
 */
const mongoose = require('mongoose');

const generatorWeightSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Matches the `name` of an entry in recommendation-engine/index.js GENERATORS
    // (and a Recommendation's `type`), e.g. 'weak-topic-alert'.
    generator: { type: String, required: true },
    // Clamped by learningLoop to MIN_WEIGHT-1.0 … MAX_WEIGHT-1.0.
    adjustment: { type: Number, required: true },
  },
  { timestamps: true }
);

generatorWeightSchema.index({ user: 1, generator: 1 }, { unique: true });

module.exports =
  mongoose.models.GeneratorWeight
  || mongoose.model('GeneratorWeight', generatorWeightSchema);
