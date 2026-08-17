const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const StockQuote = require('../models/StockQuote');
const { refreshStocksIfStale } = require('../services/stockFetcher');
const { getStockInsight } = require('../services/stockInsightService');
const { notify } = require('./notificationController');
const events = require('../events/domainEvents');

const monthRange = (month) => {
  // month is 'YYYY-MM'; defaults to current month
  const [y, m] = month
    ? month.split('-').map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1];
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
};

exports.listExpenses = async (req, res, next) => {
  try {
    const { start, end } = monthRange(req.query.month);
    const expenses = await Expense.find({
      user: req.user.userId,
      date: { $gte: start, $lt: end },
    }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
};

exports.createExpense = async (req, res, next) => {
  try {
    const { kind, amount, category, source, note, date } = req.body;
    if (amount === undefined || Number(amount) <= 0) {
      return res.status(400).json({ message: 'A positive amount is required' });
    }
    const entry = await Expense.create({
      kind: kind === 'income' ? 'income' : 'expense',
      amount,
      category: kind === 'income' ? undefined : category,
      source: kind === 'income' ? source || 'Other' : undefined,
      note,
      date: date || Date.now(),
      user: req.user.userId,
    });
    events.finance.expenseAdded(req.user.userId, { amount, category, kind, entryId: entry._id }).catch(() => {});
    // Budget exceeded alert — only on expenses, only on first crossing
    if (entry.kind === 'expense') {
      const { start, end } = monthRange();
      const [totalAgg, budget] = await Promise.all([
        Expense.aggregate([
          { $match: { user: new mongoose.Types.ObjectId(req.user.userId), kind: 'expense', date: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Budget.findOne({ user: req.user.userId }),
      ]);
      if (budget) {
        const total = totalAgg[0]?.total || 0;
        const prev = total - Number(amount);
        if (total >= budget.monthlyAmount && prev < budget.monthlyAmount) {
          notify({ user: req.user.userId, type: 'general', title: 'Monthly budget exceeded', body: `Spent ₹${total.toLocaleString('en-IN')} of ₹${budget.monthlyAmount.toLocaleString('en-IN')} budget`, link: '/finance' }).catch(() => {});
          events.finance.budgetExceeded(req.user.userId, { spent: total, budget: budget.monthlyAmount }).catch(() => {});
        }
      }
    }
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
};

exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user.userId });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    await expense.deleteOne();
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    next(err);
  }
};

exports.getSummary = async (req, res, next) => {
  try {
    const { start, end } = monthRange(req.query.month);
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const inMonth = { user: userId, date: { $gte: start, $lt: end } };
    const [byCategory, incomeAgg, budget] = await Promise.all([
      Expense.aggregate([
        { $match: { ...inMonth, kind: 'expense' } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
      Expense.aggregate([
        { $match: { ...inMonth, kind: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Budget.findOne({ user: req.user.userId }),
    ]);
    const total = byCategory.reduce((sum, c) => sum + c.total, 0);
    const income = incomeAgg[0]?.total || 0;
    res.json({
      total,
      income,
      balance: income - total,
      byCategory: byCategory.map((c) => ({ category: c._id, total: c.total })),
      budget: budget ? budget.monthlyAmount : null,
    });
  } catch (err) {
    next(err);
  }
};

exports.listStockQuotes = async (req, res, next) => {
  try {
    // Refresh on read when what we hold has gone stale, rather than trusting
    // the 1am cron — on a free instance that cron often never fires (see
    // services/stockFetcher.js). An empty collection blocks on the fetch so a
    // cold start still renders something; otherwise we serve the cached quotes
    // immediately and let the refresh land in the next poll, so the page never
    // waits on Yahoo.
    const count = await StockQuote.estimatedDocumentCount();
    if (count === 0) {
      await refreshStocksIfStale();
    } else {
      refreshStocksIfStale().catch(() => {});
    }

    const filter = {};
    if (req.query.sector) filter.sector = req.query.sector;
    const quotes = await StockQuote.find(filter).sort({ symbol: 1 }).lean();
    res.json(quotes);
  } catch (err) {
    next(err);
  }
};

exports.getStockInsight = async (req, res, next) => {
  try {
    const insight = await getStockInsight(req.params.symbol);
    if (!insight) return res.status(404).json({ message: 'Stock not tracked' });
    res.json(insight);
  } catch (err) {
    // A rejected or failed generation must not read as a broken page — the
    // quote itself is still perfectly good without Dax's commentary on it.
    console.error('Stock insight failed:', err.message);
    res.status(503).json({ message: "Dax couldn't explain this one right now." });
  }
};

exports.setBudget = async (req, res, next) => {
  try {
    const { monthlyAmount } = req.body;
    if (monthlyAmount === undefined || Number(monthlyAmount) < 0) {
      return res.status(400).json({ message: 'A valid monthly amount is required' });
    }
    const budget = await Budget.findOneAndUpdate(
      { user: req.user.userId },
      { monthlyAmount },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(budget);
  } catch (err) {
    next(err);
  }
};
