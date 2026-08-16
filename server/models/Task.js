const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: ['case-study', 'deadline', 'interview-prep', 'exam', 'other'],
      default: 'other',
    },
    subject: { type: String, trim: true, maxlength: 60 },
    dueDate: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 2000 },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'done'],
      default: 'pending',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // ⭐ Program Personalization
    program: { type: String, default: null },     // Program ID task belongs to
  },
  { timestamps: true }
);

taskSchema.index({ createdBy: 1, dueDate: 1 });
taskSchema.index({ assignee: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
