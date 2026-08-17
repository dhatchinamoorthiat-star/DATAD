import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import toast from '../../utils/toast';
import {
  TrendingUp, TrendingDown, Pencil, Plus, Download, 
  List, Calculator, BookOpen, LineChart,
} from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { listExpenses, createExpense, getSummary, setBudget } from '../../api/finance';
import Modal from '../../components/common/Modal';
import DateInput from '../../components/common/DateInput';
import Button from '../../components/common/Button';
import BudgetBar from '../../components/finance/BudgetBar';
import CategoryChart from '../../components/finance/CategoryChart';
import { Page } from '../../components/common/motion';
import { Skeleton } from '../../components/common/Skeleton';

const CATEGORIES = ['Food', 'Travel', 'Rent', 'Books & Courses', 'Entertainment', 'Shopping', 'Other'];
const formatINR  = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const currentMonth = () => new Date().toISOString().slice(0, 7);

const exportCSV = (expenses, month) => {
  const rows = [['Date', 'Type', 'Category / Source', 'Note', 'Amount (INR)']];
  expenses.forEach((e) => {
    rows.push([
      e.date ? e.date.slice(0, 10) : '',
      e.kind === 'income' ? 'Income' : 'Expense',
      e.kind === 'income' ? (e.source || '') : (e.category || ''),
      e.note || '',
      e.kind === 'income' ? e.amount : -e.amount,
    ]);
  });
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `finance-${month}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

const QUICK_LINKS = [
  { to: '/finance/tracker',    icon: List,       label: 'All transactions' },
  { to: '/finance/calculator', icon: Calculator,  label: 'Calculators' },
  { to: '/finance/stocks',     icon: LineChart,   label: 'Stocks' },
  { to: '/finance/learn',      icon: BookOpen,    label: 'Learn' },
  { to: '/finance/roi',        icon: TrendingUp,  label: 'ROI' },
];

export default function FinanceHubPage() {
  useDocumentTitle('Finance');

  const [expenses, setExpenses] = useState([]);
  // Fetched for the hub's income/expense strip, which is not rendered yet.
  const [, setSummary] = useState({ income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [showModal, setShowModal] = useState(false);
  const [budgetEdit, setBudgetEdit] = useState(false);
  const [budget, setBudgetState] = useState(null);

  const { register, handleSubmit, reset } = useForm();

  const fetchData = useCallback(async (m) => {
    setLoading(true);
    try {
      const [expRes, sumRes] = await Promise.all([listExpenses(m), getSummary(m)]);
      setExpenses(expRes.data?.data || expRes.data || []);
      setSummary(sumRes.data || { income: 0, expense: 0 });
    } catch { toast.error('Could not load finances'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Scheduled, not called inline: the loader flips loading state
    // synchronously, which cascades an extra render from the effect body.
    queueMicrotask(() => fetchData(month));
  }, [month, fetchData]);

  const onSubmit = async (data) => {
    try {
      await createExpense({ ...data, month });
      toast.success(data.kind === 'income' ? 'Income added' : 'Expense added');
      setShowModal(false);
      reset({ kind: 'expense', category: '', source: '', amount: '', note: '', date: new Date().toISOString().slice(0, 10) });
      fetchData(month);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not save'); }
  };

  const saveBudget = async () => {
    try {
      const b = await setBudget({ amount: budget, month });
      setBudgetState(b.data?.budget || b.data || b);
      toast.success('Budget updated');
      setBudgetEdit(false);
    } catch { toast.error('Could not update budget'); }
  };

  const totalIncome = expenses.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = expenses.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;

  // CategoryChart takes [{ category, total }], not the raw expense list.
  // Roll spending up by category, largest first.
  const byCategory = Object.entries(
    expenses
      .filter((e) => e.kind === 'expense')
      .reduce((acc, e) => {
        const key = e.category || 'Other';
        acc[key] = (acc[key] || 0) + e.amount;
        return acc;
      }, {})
  )
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  return (
    <Page className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Finance</h1>
          <p className="text-sm text-gray-500">Track your money</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={Download} onClick={() => exportCSV(expenses, month)}>CSV</Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={() => { reset({ kind: 'expense', category: '', source: '', amount: '', note: '', date: new Date().toISOString().slice(0, 10) }); setShowModal(true); }}>Add</Button>
        </div>
      </div>


      <div className="mb-6">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800" />
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard icon={TrendingUp} label="Income" value={formatINR(totalIncome)} color="text-success-600" />
            <StatCard icon={TrendingDown} label="Expenses" value={formatINR(totalExpense)} color="text-danger-600" />
            <StatCard icon={Pencil} label="Balance" value={formatINR(balance)} color={balance >= 0 ? 'text-primary-600' : 'text-danger-600'} />
          </div>

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Budget</h2>
              <button onClick={() => setBudgetEdit((s) => !s)} className="text-xs font-medium text-primary-600 hover:text-primary-500">
                {budgetEdit ? 'Cancel' : 'Set budget'}
              </button>
            </div>
            {budgetEdit ? (
              <div className="flex items-center gap-2">
                <input type="number" value={budget ?? ''} onChange={(e) => setBudgetState(Number(e.target.value))} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" placeholder="Monthly budget" />
                <Button variant="primary" size="sm" onClick={saveBudget}>Save</Button>
              </div>
            ) : (
              <BudgetBar spent={totalExpense} budget={budget} />
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Spending by category</h2>
            <CategoryChart data={byCategory} />
          </div>

          {expenses.length > 0 ? (
            <div className="space-y-2">
              {expenses.slice(0, 20).map((e) => (
                <div key={e._id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{e.note || (e.kind === 'income' ? e.source : e.category)}</p>
                    <p className="text-[11px] text-gray-400">{e.date?.slice(0, 10)} {e.category && `· ${e.category}`}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${e.kind === 'income' ? 'text-success-600' : 'text-danger-600'}`}>
                    {e.kind === 'income' ? '+' : '-'}{formatINR(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No transactions yet. Add your first income or expense.</p>
          )}

          <div className="mt-6 grid grid-cols-5 gap-3">
            {QUICK_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-100 py-3 text-xs font-medium text-gray-500 hover:border-primary-200 hover:text-primary-600 dark:border-gray-800 dark:hover:border-primary-800/60">
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            ))}
          </div>
        </>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add transaction">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="radio" value="expense" {...register('kind')} defaultChecked /> Expense</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" value="income" {...register('kind')} /> Income</label>
          </div>
          <div>
            <label htmlFor="finance-hub-category-source" className="block text-xs font-medium text-gray-600 mb-1">Category / Source</label>
            <select id="finance-hub-category-source" {...register('category')} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="finance-hub-amount" className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
            <input id="finance-hub-amount" type="number" step="0.01" {...register('amount', { required: true })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          </div>
          <div>
            <label htmlFor="finance-hub-note" className="block text-xs font-medium text-gray-600 mb-1">Note</label>
            <input id="finance-hub-note" {...register('note')} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          </div>
          <div>
            <label htmlFor="finance-hub-date" className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <DateInput id="finance-hub-date" {...register('date')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Add</Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
