import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { Plus, Trash2, Wallet, TrendingUp, Download } from 'lucide-react';
import { listExpenses, createExpense, deleteExpense } from '../../api/finance';
import { formatDate } from '../../utils/dateUtils';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import DateInput from '../../components/common/DateInput';
import { Page } from '../../components/common/motion';

const CATEGORIES = ['Food', 'Travel', 'Rent', 'Books & Courses', 'Entertainment', 'Shopping', 'Other'];
const SOURCES    = ['Allowance', 'Stipend', 'Salary', 'Freelance', 'Scholarship', 'Gift', 'Other'];
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

export default function FinanceTrackerPage() {
  const [month, setMonth]           = useState(currentMonth());
  const [expenses, setExpenses]     = useState(null);
  const [entryModal, setEntryModal] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const expenseForm = useForm({ defaultValues: { category: 'Food', source: 'Allowance' } });

  const load = useCallback(() => {
    listExpenses(month)
      .then((r) => setExpenses(r.data))
      // An empty month renders the same as a failed one here, which beats the
      // <Loader/> spinning forever with no way to retry but a page reload.
      .catch(() => {
        setExpenses([]);
        toast.error('Could not load this month — try again');
      });
  }, [month]);
  useEffect(load, [load]);

  const onAddEntry = async (data) => {
    try {
      await createExpense({ ...data, kind: entryModal });
      toast.success(entryModal === 'income' ? 'Income added' : 'Expense added');
      expenseForm.reset({ category: data.category, source: data.source });
      setEntryModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const onDelete = async (id) => {
    await deleteExpense(id);
    setConfirmDeleteId(null);
    load();
  };

  return (
    <Page>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Tracker</h1>
        <p className="mt-0.5 text-xs text-gray-400">All your income and expenses, month by month.</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month" value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <div className="ml-auto flex gap-2">
            <button onClick={() => setEntryModal('income')}
              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
              <TrendingUp className="h-4 w-4" /> Add income
            </button>
            <button onClick={() => setEntryModal('expense')}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Add expense
            </button>
            <button onClick={() => exportCSV(expenses || [], month)} disabled={!expenses?.length}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-800">
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>

        {!expenses ? <Loader /> : (
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            {expenses.length === 0 ? (
              <EmptyState icon={Wallet} title="Nothing this month" subtitle="Add income or an expense to start tracking" />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {expenses.map((exp) => (
                  <li key={exp._id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {exp.note || (exp.kind === 'income' ? exp.source : exp.category)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {exp.kind === 'income' ? `Income · ${exp.source}` : exp.category} · {formatDate(exp.date)}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${exp.kind === 'income' ? 'text-green-700 dark:text-green-400' : ''}`}>
                      {exp.kind === 'income' ? '+' : '−'}{formatINR(exp.amount)}
                    </span>
                    <button onClick={() => setConfirmDeleteId(exp._id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => onDelete(confirmDeleteId)}
        title="Delete entry"
        message="This transaction will be permanently deleted."
        danger
        confirmLabel="Delete"
      />

      <Modal open={Boolean(entryModal)} onClose={() => setEntryModal(null)} title={entryModal === 'income' ? 'Add income' : 'Add expense'}>
        <form onSubmit={expenseForm.handleSubmit(onAddEntry)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="finance-tracker-amount" className="mb-1 block text-sm font-medium">Amount (₹)</label>
              <input id="finance-tracker-amount" type="number" step="0.01" min="0" {...expenseForm.register('amount', { required: true, min: 0.01 })} className="input" />
            </div>
            {entryModal === 'income' ? (
              <div>
                <label htmlFor="finance-tracker-source" className="mb-1 block text-sm font-medium">Source</label>
                <select id="finance-tracker-source" {...expenseForm.register('source')} className="input">
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="finance-tracker-category" className="mb-1 block text-sm font-medium">Category</label>
                <select id="finance-tracker-category" {...expenseForm.register('category')} className="input">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="finance-tracker-note" className="mb-1 block text-sm font-medium">Note <span className="text-gray-400">(optional)</span></label>
            <input id="finance-tracker-note" {...expenseForm.register('note')} placeholder={entryModal === 'income' ? 'e.g. Monthly allowance' : 'e.g. Mess bill'} className="input" />
          </div>
          <div>
            <label htmlFor="finance-tracker-date" className="mb-1 block text-sm font-medium">Date</label>
            <DateInput id="finance-tracker-date" defaultValue={new Date().toISOString().slice(0, 10)} {...expenseForm.register('date')} />
          </div>
          <button type="submit" disabled={expenseForm.formState.isSubmitting}
            className={`w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50 ${entryModal === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {entryModal === 'income' ? 'Add income' : 'Add expense'}
          </button>
        </form>
      </Modal>
    </Page>
  );
}
