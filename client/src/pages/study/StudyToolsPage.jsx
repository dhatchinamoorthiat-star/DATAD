import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import toast from '../../utils/toast';
import {
  Timer, CheckSquare, Flame, BarChart2, Play, Pause, RotateCcw,
  Coffee, Zap, Brain, BookOpen, ChevronDown, ChevronUp, Music2, Target,
  Shuffle, Smartphone, PenLine, Repeat, Moon,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { getTodayLog, updateLog, getStreak, getWeekStats } from '../../api/studyTools';
import { RowSkeleton } from '../../components/common/Skeleton';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Page } from '../../components/common/motion';
import { rotatedPages } from '../../utils/rotation';

const MODES = [
  { key: 'focus', label: 'Focus', mins: 25, color: 'bg-primary-600 text-white', ring: 'text-primary-500' },
  { key: 'short', label: 'Short break', mins: 5, color: 'bg-success-600 text-white', ring: 'text-success-500' },
  { key: 'long', label: 'Long break', mins: 15, color: 'bg-warn-600 text-white', ring: 'text-warn-500' },
];

function PomodoroTimer({ onComplete }) {
  const [modeIdx, setModeIdx] = useState(0);
  const [seconds, setSeconds] = useState(MODES[0].mins * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);
  const mode = MODES[modeIdx];

  const changeMode = (i) => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setModeIdx(i);
    setSeconds(MODES[i].mins * 60);
  };

  const start = useCallback(() => {
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          onComplete(modeIdx === 0);
          return MODES[modeIdx].mins * 60;
        }
        return s - 1;
      });
    }, 1000);
  }, [onComplete, modeIdx]);

  const pause = () => { clearInterval(intervalRef.current); setRunning(false); };
  const reset = () => { clearInterval(intervalRef.current); setRunning(false); setSeconds(mode.mins * 60); };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const totalSecs = mode.mins * 60;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pct = ((totalSecs - seconds) / totalSecs) * 100;
  const circum = 2 * Math.PI * 45;

  return (
    <div className="flex flex-col items-center gap-5 p-6">
      {/* Mode switcher */}
      <div className="flex gap-1 rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
        {MODES.map((m, i) => (
          <button key={m.key} onClick={() => changeMode(i)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${modeIdx === i ? m.color : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Circle timer */}
      <div className="relative flex h-44 w-44 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6"
            strokeDasharray={`${(pct / 100) * circum} ${circum}`}
            className={mode.ring + ' transition-all duration-1000'} />
        </svg>
        <div className="text-center">
          <div className="text-3xl font-bold tabular-nums">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{mode.label}</div>
        </div>
      </div>

      <div className="flex gap-3">
        {running ? (
          <button onClick={pause} className="flex items-center gap-2 rounded-full bg-warn-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-warn-600 hover:shadow-md transition-all">
            <Pause className="h-4 w-4" /> Pause
          </button>
        ) : (
          <button onClick={start} className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow-sm hover:shadow-md transition-all ${mode.color} opacity-90 hover:opacity-100`}>
            <Play className="h-4 w-4" /> {seconds === totalSecs ? 'Start' : 'Resume'}
          </button>
        )}
        <button onClick={reset} className="flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function HeatDot({ minutes }) {
  const level = minutes === 0 ? 0 : minutes < 60 ? 1 : minutes < 120 ? 2 : 3;
  const colors = ['bg-gray-200 dark:bg-gray-700', 'bg-primary-200 dark:bg-primary-800', 'bg-primary-400', 'bg-primary-600'];
  return <div className={`h-8 w-8 rounded-lg ${colors[level]}`} title={`${minutes}m`} />;
}

const POMODORO_STEPS = [
  { icon: BookOpen, color: 'text-primary-500 bg-primary-50 dark:bg-primary-950/40', n: '1', label: 'Pick a task', desc: 'Choose ONE thing to work on — write it down if it helps.' },
  { icon: Timer, color: 'text-primary-500 bg-primary-50 dark:bg-primary-950/40', n: '2', label: 'Set 25 minutes', desc: 'Work with full focus for exactly 25 minutes. No multitasking.' },
  { icon: Coffee, color: 'text-success-500 bg-success-50 dark:bg-success-950/40', n: '3', label: '5-min break', desc: 'Step away, breathe, stretch. Your brain consolidates learning here.' },
  { icon: Zap, color: 'text-warn-600 bg-warn-50 dark:bg-warn-950/40', n: '4', label: 'Repeat × 4', desc: 'After 4 rounds, take a longer 15–30 min break before the next set.' },
];

// Two of these show at a time, rotating daily — the full set filled the card
// with advice nobody was going to act on in one sitting, on a page whose actual
// job is the timer. The rest are a tap away via the shuffle control below.
const FOCUS_TIPS = [
  { icon: Brain, title: 'One tab rule', tip: 'Close everything except what you need for this session. Notifications off.' },
  { icon: Music2, title: 'Background audio', tip: 'Lo-fi, brown noise, or rain sounds help many people enter flow. Try it.' },
  { icon: Target, title: 'Define "done"', tip: 'Before starting, write one sentence: "This session is successful if I ___."' },
  { icon: Coffee, title: 'Breaks are mandatory', tip: 'Skipping breaks doesn\'t help — it depletes working memory faster.' },
  { icon: Smartphone, title: 'Phone in another room', tip: 'Face-down on the desk still costs attention. Distance beats willpower.' },
  { icon: PenLine, title: 'Park the stray thought', tip: 'Mid-session ideas go on a scrap list, not into a new tab. Deal with them after.' },
  { icon: Repeat, title: 'Start absurdly small', tip: 'Stuck? Commit to two minutes. Starting is the hard part, not continuing.' },
  { icon: Moon, title: 'Protect the last hour', tip: 'Sleep is when today\'s studying gets filed. A late cram trades away what you learnt.' },
];

// How many tips are on screen at once. Two fits the two-column grid and keeps
// the card shorter than the timer above it, which is the point.
const TIPS_PER_PAGE = 2;

// Tips card with a manual stepper. The daily rotation decides where the deck
// starts (so the card still changes on its own for someone who never touches
// it), and this control walks forward through the same deck without reloading
// the page. Page state is intentionally not persisted — it's a browsing gesture
// for the current sitting, not a preference.
function FocusTips() {
  const pages = useMemo(() => rotatedPages(FOCUS_TIPS, TIPS_PER_PAGE, 'study-focus-tips'), []);
  const [page, setPage] = useState(0);
  const tips = pages[page] || [];

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-semibold flex items-center gap-2"><Brain className="h-4 w-4 text-primary-500" /> Focus Tips</p>
        {pages.length > 1 && (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              {pages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  aria-label={`Show tips ${i + 1} of ${pages.length}`}
                  aria-current={i === page}
                  className={`h-1.5 rounded-full transition-all ${i === page ? 'w-4 bg-primary-500' : 'w-1.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
                />
              ))}
            </div>
            <button
              onClick={() => setPage((p) => (p + 1) % pages.length)}
              className="flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-primary-200 hover:text-primary-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-primary-800 dark:hover:text-primary-400"
            >
              <Shuffle className="h-3 w-3" /> Another two
            </button>
          </div>
        )}
      </div>
      {/* Keyed on the page so the swap re-runs the fade instead of snapping. */}
      <div key={page} className="animate-in grid sm:grid-cols-2 gap-3">
        {tips.map((tip) => (
          <div key={tip.title} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
            <div className="rounded-full bg-primary-50 p-2 dark:bg-primary-950/40"><tip.icon className="h-4 w-4 text-primary-500" /></div>
            <div>
              <p className="text-xs font-semibold">{tip.title}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{tip.tip}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudyToolsPage() {
  useDocumentTitle('Focus');
  const [log, setLog] = useState(null);
  const [streak, setStreak] = useState(null);
  const [weekStats, setWeekStats] = useState(null);
  const [showPomoInfo, setShowPomoInfo] = useState(false);

  useEffect(() => {
    Promise.allSettled([getTodayLog(), getStreak(), getWeekStats()])
      .then(([l, s, w]) => {
        if (l.status === 'fulfilled') setLog(l.value.data);
        if (s.status === 'fulfilled') setStreak(s.value.data.streak);
        if (w.status === 'fulfilled') setWeekStats(w.value.data.days);
      })
      // Stats are decoration here — the timer works without them. Swallow, but
      // deliberately, so a malformed payload cannot take the page down.
      .catch(() => {});
  }, []);

  const onPomodoroComplete = async (isFocus) => {
    if (isFocus) {
      toast.success('Focus session complete — take your break.');
      try {
        const newCount = (log?.pomodoroCount || 0) + 1;
        const newMins = (log?.studyMinutes || 0) + 25;
        const res = await updateLog({ pomodoroCount: newCount, studyMinutes: newMins });
        setLog(res.data);
      } catch { /* non-critical */ }
    } else {
      toast('Break over — back to focus.');
    }
  };

  const toggleHabit = async (idx) => {
    if (!log) return;
    const habits = log.habits.map((h, i) => i === idx ? { ...h, done: !h.done } : h);
    setLog((prev) => ({ ...prev, habits }));
    try { await updateLog({ habits }); }
    catch { toast.error('Failed to save'); }
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!log) return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-3"><RowSkeleton /><RowSkeleton /><RowSkeleton /></div>
  );

  return (
    <Page className="space-y-5" overview={{
      pageKey: 'study-focus',
      title: 'Deep work, timed',
      blurb: 'Pomodoro timers, session tracking and streaks that measure focused hours instead of hours at the desk.',
      takeaway: 'Start one timed session now — the streak only counts finished sessions.',
    }}>
      <PageHeader icon={Timer} title="Focus" subtitle="Deep work tools that build streaks, not stress" />

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.06),0_1px_3px_rgba(60,64,67,0.08)] dark:border-gray-800/80 dark:bg-gray-900 dark:shadow-none">
          <div className="flex items-center gap-2 mb-1"><Flame className="h-4 w-4 text-warn-600" /><p className="text-xs font-semibold text-gray-500">Study Streak</p></div>
          <p className="text-3xl font-bold text-warn-600">{streak ?? 0}<span className="ml-1 text-sm font-normal text-gray-400">days</span></p>
          <p className="mt-1 text-[11px] text-gray-400">{(streak ?? 0) >= 5 ? 'Going strong — keep it up' : 'Study daily to grow'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.06),0_1px_3px_rgba(60,64,67,0.08)] dark:border-gray-800/80 dark:bg-gray-900 dark:shadow-none">
          <div className="flex items-center gap-2 mb-1"><Timer className="h-4 w-4 text-primary-500" /><p className="text-xs font-semibold text-gray-500">Today&rsquo;s Pomodoros</p></div>
          <p className="text-3xl font-bold text-primary-600">{log.pomodoroCount}</p>
          <p className="mt-1 text-[11px] text-gray-400">{log.studyMinutes}m studied today</p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.06),0_1px_3px_rgba(60,64,67,0.08)] dark:border-gray-800/80 dark:bg-gray-900 dark:shadow-none">
          <div className="flex items-center gap-2 mb-1"><CheckSquare className="h-4 w-4 text-success-500" /><p className="text-xs font-semibold text-gray-500">Today&rsquo;s Habits</p></div>
          <p className="text-3xl font-bold text-success-600">{log.habits.filter((h) => h.done).length}<span className="text-sm font-normal text-gray-400">/{log.habits.length}</span></p>
          <p className="mt-1 text-[11px] text-gray-400">habits completed</p>
        </div>
      </div>

      {/* Pomodoro Timer */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800/80 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800 flex items-center justify-between">
          <p className="font-semibold flex items-center gap-2"><Timer className="h-4 w-4 text-primary-500" /> Pomodoro Timer</p>
          <button onClick={() => setShowPomoInfo((v) => !v)} className="flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400">
            What is Pomodoro? {showPomoInfo ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
        <PomodoroTimer onComplete={onPomodoroComplete} />
      </div>

      {/* Pomodoro explainer */}
      {showPomoInfo && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-5 dark:border-primary-800/40 dark:bg-primary-950/30 space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-primary-800 dark:text-primary-200">The Pomodoro Technique</h3>
            <p className="text-xs text-primary-600/80 dark:text-primary-300/80 mt-1 leading-relaxed">
              Developed by Francesco Cirillo in the late 1980s, the Pomodoro Technique is a time management method that uses focused 25-minute work blocks with short breaks in between. It&rsquo;s one of the most researched productivity techniques for students.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {POMODORO_STEPS.map((s) => (
              <div key={s.n} className="flex items-start gap-3 rounded-xl bg-white/60 dark:bg-slate-900/40 p-3">
                <div className={`rounded-full p-2 ${s.color}`}><s.icon className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs font-semibold">Step {s.n}: {s.label}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-primary-500/70 dark:text-primary-400/70 italic">
            &ldquo;The next pomodoro will go better.&rdquo; — Francesco Cirillo
          </p>
        </div>
      )}

      {/* Today's Habits */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        <p className="mb-3 font-semibold flex items-center gap-2"><CheckSquare className="h-4 w-4 text-success-500" /> Today&rsquo;s Habits</p>
        <div className="space-y-2">
          {log.habits.map((h, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={h.done} onChange={() => toggleHabit(i)}
                className="h-4 w-4 rounded border-gray-300 text-success-600 focus:ring-success-500" />
              <span className={`text-sm ${h.done ? 'line-through text-gray-400' : ''}`}>{h.name}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">{log.habits.filter((h) => h.done).length}/{log.habits.length} completed today</p>
      </div>

      {/* Focus Tips */}
      <FocusTips />

      {/* Week Heatmap */}
      {weekStats && (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
          <p className="mb-3 font-semibold flex items-center gap-2"><BarChart2 className="h-4 w-4 text-primary-500" /> This Week</p>
          <div className="flex gap-2 items-end">
            {weekStats.map((d, i) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <HeatDot minutes={d.studyMinutes} />
                <span className="text-[10px] text-gray-400">{weekDays[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-200 dark:bg-gray-700 inline-block" /> 0m</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary-200 inline-block" /> &lt;1h</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary-400 inline-block" /> 1-2h</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary-600 inline-block" /> 2h+</span>
          </div>
        </div>
      )}
    </Page>
  );
}
