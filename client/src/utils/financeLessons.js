import {
  Umbrella, PiggyBank, Sprout, TrendingUp, LineChart, Landmark, Receipt,
  ShieldCheck, CreditCard, Wallet, Building2, Scale, AlertTriangle, Banknote,
  Calculator, HeartPulse, KeyRound, Percent, Briefcase, Users, Target,
} from 'lucide-react';

// Money explainers for someone at or just before their first salary.
//
// The pool is intentionally long. One lesson is featured per day (see
// utils/rotation.js), so the length is how many days pass before a reader sees
// a repeat — at 21 items that is three weeks. Shorter pools read as a reshuffle
// rather than something new, which defeats the point. Add to the end when you
// write more; order is preserved and only the starting point rotates.
//
// House rules for anything added here: explain a concept, never name a product,
// a fund, or a stock. Amounts in ₹, sized for a student. Education, not advice.
export const LESSONS = [
  { icon: Umbrella, title: 'The emergency fund comes first', body: 'Before any investing: 3–6 months of living costs in a savings account or liquid fund. It is not for returns — it is so a broken laptop or a gap between offers never becomes a crisis. Build it slowly; even ₹500/month counts.' },
  { icon: PiggyBank, title: 'The 50/30/20 rule', body: 'Of whatever money comes in: about 50% for needs (rent, food, fees), 30% for wants (trips, eating out — guilt-free), 20% saved or invested. On a student budget the exact split matters less than having one at all.' },
  { icon: Sprout, title: 'The power of compounding', body: 'Money grows on its own growth. ₹5,000/month at 12% becomes ~₹11.6 lakh in 10 years — but ~₹1.76 crore in 30. The last decade earns more than the first two combined. Starting at 25 instead of 35 roughly triples the outcome. Time matters more than amount.' },
  { icon: TrendingUp, title: 'SIPs: investing on autopilot', body: 'A SIP (Systematic Investment Plan) invests a fixed amount into a mutual fund every month, automatically. You buy more units when markets are down, fewer when up — no timing, no willpower needed. It is the single best habit to start with your first salary.' },
  { icon: LineChart, title: 'Mutual funds vs. picking stocks', body: 'A mutual fund pools money from many people and spreads it across dozens of companies — one bad company cannot sink you. Low-cost index funds (following Nifty 50) beat most professionals over long periods. Picking individual stocks is a hobby; funds are a plan.' },
  { icon: Landmark, title: 'Long-term wealth is boring', body: 'The reliable formula: earn, keep fixed costs low, automate a monthly SIP, ignore market noise, let decades do the work. Nobody gets rich from tips and trading apps; plenty do from thirty years of unglamorous consistency.' },

  { icon: Receipt, title: 'Read your first payslip properly', body: 'Your CTC is not your salary. Subtract the employer PF contribution, gratuity and any insurance loading, then take-home is what actually arrives — often 25–30% below the number in the offer letter. Work out that figure before you sign a rent agreement based on the headline.' },
  { icon: Percent, title: 'How tax slabs actually work', body: 'A common fear: "a raise will push me into a higher slab and I will take home less." It cannot. Slabs are marginal — only the rupees above each threshold are taxed at the higher rate. Every raise leaves you better off. Always take the raise.' },
  { icon: Calculator, title: 'Old regime vs. new regime', body: 'The new regime has lower rates but almost no deductions; the old one has higher rates you can reduce with 80C, HRA and the rest. If you claim little — no home loan, small rent — the new regime usually wins. Compute both once a year; the choice is not permanent.' },
  { icon: ShieldCheck, title: 'Insurance is not an investment', body: 'Their jobs are opposite: insurance replaces income if something goes wrong, investing grows income when nothing does. Products that promise both — ULIPs, endowment, money-back plans — do each badly. Buy pure term cover, invest the rest separately.' },
  { icon: HeartPulse, title: 'Health cover before wealth', body: 'One hospital stay can erase years of saving. Employer cover ends the day the job does, so hold a personal policy too — it is cheapest to buy while you are young and healthy, and pre-existing conditions get excluded if you wait until you need it.' },
  { icon: CreditCard, title: 'Credit cards: the 45-day trick', body: 'Pay the full statement balance every month and a card is a free 45-day loan plus rewards. Pay the "minimum due" and you are borrowing at 36–48% a year — worse than almost any loan you could take. The minimum-due line is a trap, not an option.' },
  { icon: KeyRound, title: 'Your credit score starts now', body: 'A CIBIL score is built from years of on-time repayment, so it cannot be produced on demand when you want a home loan. One modest card, paid in full, quietly builds it. Keep usage under about 30% of the limit and never miss a due date.' },
  { icon: Wallet, title: 'Lifestyle creep is the real enemy', body: 'Most people do not fail to get raises; they fail to keep them. Spending rises to meet income within a month or two of every increment. The fix is one rule: when income rises, raise the automatic SIP first, and live on what is left.' },
  { icon: Banknote, title: 'Inflation is a silent deduction', body: 'At 6% inflation, money in a savings account paying 3% loses about 3% of its buying power a year — ₹1 lakh idle for a decade buys roughly what ₹55,000 does today. "Safe" is not the same as "no loss". Cash beyond the emergency fund is quietly shrinking.' },
  { icon: Scale, title: 'Risk and return are one decision', body: 'There is no investment that is high-return, safe and liquid at once. Anything advertised that way is hiding one of the three. Choose which you need for this particular money — the emergency fund needs liquidity and safety, retirement money can afford risk.' },
  { icon: Building2, title: 'Rent vs. buy is not obvious', body: 'A home is three things at once: a place to live, a leveraged bet, and a 20-year commitment to one city. Early career, mobility is usually worth more than equity. Buy when your job and your city are both settled, not because rent "feels wasted".' },
  { icon: Target, title: 'Match the money to the horizon', body: 'Money needed within three years does not belong in equity — a bad year can arrive exactly when you need it. Short goals: debt funds or deposits. Long goals: equity, because time smooths out the bad years. Horizon picks the instrument, not returns.' },
  { icon: Briefcase, title: 'The EPF you keep forgetting', body: 'Around 12% of basic pay goes into EPF each month, matched by the employer, compounding tax-free. Transfer it when you change jobs rather than withdrawing — withdrawal restarts the compounding at zero and is the most common way people erase a decade of saving.' },
  { icon: AlertTriangle, title: 'If it is guaranteed and high, walk', body: 'Guaranteed 2% a month, a friend who "has a broker", crypto doubling schemes, anything urgent. Real returns are never both large and certain, and urgency exists to stop you checking. The universal test: can you explain where the return comes from?' },
  { icon: Users, title: 'Lending to friends and family', body: 'A loan to someone close is really a gift with an awkward conversation attached. Decide up front which one you are making. If you can afford to give it, give it and stay friends; if you cannot afford to lose it, say no early — that is kinder than resenting it later.' },
];
