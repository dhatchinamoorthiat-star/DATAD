const formatINR = (n) => '₹' + n.toLocaleString('en-IN');

// Single-series magnitude comparison: one hue, thin bars with rounded data-ends,
// direct value labels in ink tokens (identity carried by row labels, not color).
// `data` defaults to [] so a missing/renamed prop degrades to the empty state
// instead of throwing on `undefined.length` and taking the whole page down.
export default function CategoryChart({ data = [] }) {
  if (!data.length) {
    return <p className="py-6 text-center text-sm text-gray-400">No expenses this month yet</p>;
  }
  const max = Math.max(...data.map((d) => d.total));
  return (
    <div className="space-y-2" role="img" aria-label="Spending by category">
      {data.map((d) => (
        <div key={d.category} className="group flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-right text-xs text-gray-500 dark:text-gray-400">
            {d.category}
          </span>
          <div className="relative h-4 flex-1">
            <div
              className="h-4 rounded-r bg-primary-600 transition-all group-hover:bg-primary-500 dark:bg-primary-400 dark:group-hover:bg-primary-300"
              style={{ width: `${Math.max((d.total / max) * 100, 2)}%` }}
              title={`${d.category}: ${formatINR(d.total)}`}
            />
          </div>
          <span className="w-20 shrink-0 text-xs tabular-nums text-gray-600 dark:text-gray-300">
            {formatINR(d.total)}
          </span>
        </div>
      ))}
    </div>
  );
}
