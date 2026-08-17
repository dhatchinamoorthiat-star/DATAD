import { useEffect, useState } from 'react';
import {
  BrainCircuit, CheckCircle2, Flame, ChevronDown, Loader2,
  BookOpen, Target, Lightbulb, Clock,
} from 'lucide-react';
import { getTodayCase, solveCase } from '../../api/dailyCase';
import AIBadge from '../common/AIBadge';

const CATEGORY_LABEL = {
  strategy: 'Strategy',
  marketing: 'Marketing',
  operations: 'Operations',
  finance: 'Finance',
  hr: 'HR',
  guesstimate: 'Guesstimate',
  other: 'Case',
};

const CATEGORY_COLOR = {
  strategy: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  marketing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  operations: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  finance: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  hr: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  guesstimate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const THINK_TIPS = {
  strategy: ['Map the value chain', 'Identify competitive moat', 'Use Porter\'s Five Forces'],
  marketing: ['Segment → Target → Position', 'Consider 4 P\'s', 'Think customer lifetime value'],
  finance: ['Check cash flow first', 'Consider NPV / IRR', 'Look at debt-equity ratio'],
  operations: ['Identify the bottleneck', 'Think throughput, not efficiency', 'Apply TOC or Lean'],
  hr: ['Consider culture fit vs. skill', 'Look at retention drivers', 'Think incentive design'],
  guesstimate: ['Structure top-down', 'Sanity check with a proxy', 'Estimate then validate'],
  other: ['Break the problem into parts', 'State your assumptions', 'Think about trade-offs'],
};

export default function DailyCaseCard() {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [framework, setFramework] = useState('');
  const [solving, setSolving] = useState(false);
  const [thinkRevealed, setThinkRevealed] = useState(false);

  useEffect(() => {
    getTodayCase()
      .then((res) => {
        setData(res.data);
        setFramework(res.data.case?.framework || '');
      })
      .catch(() => {});
  }, []);

  if (!data?.case) return null;
  const { case: c, solved, streak } = data;
  const tips = THINK_TIPS[c.category] || THINK_TIPS.other;

  const handleSolve = async () => {
    if (solving) return;
    setSolving(true);
    try {
      const res = await solveCase(c._id);
      setFramework(res.data.framework);
      setData((d) => ({ ...d, solved: true, streak: res.data.streak }));
    } catch {
      /* keep the card usable even if the call fails */
    } finally {
      setSolving(false);
    }
  };

  return (
    <div id="daily-case" className="scroll-mt-20 rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(60,64,67,0.06),0_1px_3px_rgba(60,64,67,0.08)] dark:border-gray-800/80 dark:bg-gray-900 dark:shadow-none overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 px-5 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-sm">
          <BrainCircuit className="h-4 w-4 text-primary-500" /> Daily Case
        </h2>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-900/40 dark:text-orange-300">
              <Flame className="h-3 w-3" /> {streak}-day streak
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLOR[c.category] || CATEGORY_COLOR.other}`}>
            {CATEGORY_LABEL[c.category] || 'Case'}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <Clock className="h-3 w-3" /> ~5 min
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* How to use this section */}
        <div className="rounded-xl bg-primary-50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900/40 p-3 flex items-start gap-2.5">
          <BookOpen className="h-4 w-4 text-primary-500 mt-0.5 shrink-0" />
          <div className="text-xs text-primary-700 dark:text-primary-300 space-y-0.5">
            <p className="font-semibold">How to use this case</p>
            <p className="text-primary-600/80 dark:text-primary-400">Read the scenario → form your answer → then reveal the expert framework. Don&rsquo;t skip ahead — the learning is in the thinking.</p>
          </div>
        </div>

        {/* Case scenario */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Scenario</p>
          <p className="font-semibold text-sm">{c.title}</p>
          <p className={`mt-1.5 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300 ${expanded ? '' : 'line-clamp-4'}`}>
            {c.scenario}
          </p>
          {!expanded && c.scenario.length > 220 && (
            <button onClick={() => setExpanded(true)} className="mt-1 flex items-center gap-0.5 text-xs font-medium text-primary-600 dark:text-primary-400">
              Read full case <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Question */}
        <div className="rounded-xl bg-warn-50 dark:bg-warn-950/30 border border-warn-100 dark:border-warn-900/40 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-3.5 w-3.5 text-warn-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-warn-800 dark:text-warn-400">Your challenge</span>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{c.question}</p>
        </div>

        {/* Think hints */}
        {!solved && (
          <div>
            <button
              onClick={() => setThinkRevealed((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {thinkRevealed ? 'Hide thinking hints' : 'Need a nudge? Show thinking hints'}
            </button>
            {thinkRevealed && (
              <ul className="mt-2 space-y-1 pl-1">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Solve / solved */}
        {solved ? (
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-success-600 dark:text-success-400">
              <CheckCircle2 className="h-4 w-4" /> Solved — nice thinking!
            </p>
            {framework && (
              <div className="mt-2 rounded-xl border border-success-200 bg-success-50 p-4 text-sm dark:border-success-800/60 dark:bg-success-900/20">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-success-600 dark:text-success-400">
                    Expert framework
                  </p>
                  <AIBadge />
                </div>
                <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-200 leading-relaxed">{framework}</p>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleSolve}
            disabled={solving}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-primary-600 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md disabled:opacity-70"
          >
            {solving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Revealing framework…</>
            ) : (
              "I've thought it through — reveal the framework"
            )}
          </button>
        )}
      </div>
    </div>
  );
}