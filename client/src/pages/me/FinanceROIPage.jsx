import { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { Page } from '../../components/common/motion';
import useDocumentTitle from '../../hooks/useDocumentTitle';

const fmt = (n) => isNaN(n) || !isFinite(n) ? '—' : '₹' + Math.round(n).toLocaleString('en-IN');
const yrs = (n) => isNaN(n) || !isFinite(n) || n <= 0 ? '—' : n < 1 ? `${Math.round(n * 12)} months` : `${n.toFixed(1)} years`;

function Inp({ label, value, onChange, prefix, suffix, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-sm text-gray-400">{prefix}</span>}
        <input
          type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border border-gray-300 bg-white py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${prefix ? 'pl-7' : 'px-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 text-sm text-gray-400">{suffix}</span>}
      </div>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-900/60 dark:bg-indigo-950/30' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
    </div>
  );
}

export default function FinanceROIPage() {
  useDocumentTitle('MBA ROI Calculator');

  const [mbaFees, setMbaFees]         = useState(2500000);
  const [livingCost, setLivingCost]   = useState(600000);
  const [preCTC, setPreCTC]           = useState(800000);
  const [postCTC, setPostCTC]         = useState(2000000);
  const [loanAmt, setLoanAmt]         = useState(2000000);
  const [interestRate, setInterestRate] = useState(9);
  const [tenureYrs, setTenureYrs]     = useState(7);

  const totalCost       = Number(mbaFees) + Number(livingCost);
  const opportunityCost = Number(preCTC) * 2;
  const totalInvestment = totalCost + opportunityCost;

  const monthlyRate = Number(interestRate) / 100 / 12;
  const n = Number(tenureYrs) * 12;
  const emi = loanAmt > 0 && monthlyRate > 0
    ? (Number(loanAmt) * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    : 0;
  const totalInterest = emi * n - Number(loanAmt);

  const salaryjump    = Number(postCTC) - Number(preCTC);
  const paybackYears  = salaryjump > 0 ? totalInvestment / salaryjump : Infinity;
  const net5yr        = salaryjump * 5 - totalInvestment - totalInterest;
  const net10yr       = salaryjump * 10 - totalInvestment - totalInterest;

  return (
    <Page overview={{
      pageKey: 'finance-roi',
      title: 'Is the degree worth it',
      blurb: 'Weighs total course cost and loan interest against the salary jump to give a payback period and 10-year net.',
      takeaway: 'Enter your real fee and a conservative salary figure — optimism here hides the payback year.',
    }}>
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <PageHeader
          title="MBA ROI Calculator"
          subtitle="Is the MBA worth it? Plug in your numbers and find out — payback period, EMI, and 10-year net gain."
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">MBA costs</h2>
            <Inp label="Total tuition fees" value={mbaFees} onChange={setMbaFees} prefix="₹" hint="Full 2-year fees" />
            <Inp label="Living & misc costs (2 yrs)" value={livingCost} onChange={setLivingCost} prefix="₹" />
            <Inp label="Pre-MBA annual CTC" value={preCTC} onChange={setPreCTC} prefix="₹" hint="Opportunity cost × 2 years" />
            <Inp label="Expected post-MBA annual CTC" value={postCTC} onChange={setPostCTC} prefix="₹" />
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Education loan</h2>
            <Inp label="Loan amount" value={loanAmt} onChange={setLoanAmt} prefix="₹" />
            <Inp label="Interest rate" value={interestRate} onChange={setInterestRate} suffix="%" />
            <Inp label="Repayment tenure" value={tenureYrs} onChange={setTenureYrs} suffix="yrs" />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Your ROI</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Total investment (fees + opp cost)" value={fmt(totalInvestment)} />
            <Stat label="Monthly EMI" value={fmt(emi)} />
            <Stat label="Total interest paid" value={fmt(totalInterest)} />
            <Stat label="Annual salary jump" value={fmt(salaryjump)} />
            <Stat label="Payback period" value={yrs(paybackYears)} highlight />
            <Stat label="Net gain over 5 years" value={fmt(net5yr)} highlight />
            <Stat label="Net gain over 10 years" value={fmt(net10yr)} highlight />
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 text-xs text-amber-800 dark:text-amber-300">
          <strong>Assumptions: </strong>Salary jump is consistent every year post-MBA. Opportunity cost = pre-MBA CTC × 2 (the 2 years you&rsquo;re not earning). Loan EMI starts immediately after graduation. All values are pre-tax approximations.
        </div>
      </div>
    </Page>
  );
}
