const mongoose = require('mongoose');

// A ledger entry: money out (expense, categorized) or money in (income, with source).
const expenseSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['expense', 'income'], default: 'expense' },
    amount: { type: Number, required: true, min: 0, max: 1e9 },
    category: {
      type: String,
      enum: ['Food', 'Travel', 'Rent', 'Books & Courses', 'Entertainment', 'Shopping', 'Other'],
      default: 'Other',
    },
    source: {
      type: String,
      enum: ['Allowance', 'Stipend', 'Salary', 'Freelance', 'Scholarship', 'Gift', 'Other'],
    },
    note: { type: String, trim: true, maxlength: 200 },
    date: { type: Date, required: true, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

expenseSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
