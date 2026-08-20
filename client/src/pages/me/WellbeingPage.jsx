import { useEffect, useRef, useState } from 'react';
import {
  Wind, Volume2, VolumeX,
} from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Page } from '../../components/common/motion';
import { createAmbience } from '../../utils/ambientAudio';

// ── Guided breathing ─────────────────────────────────────────────────────────
// Phases cycle continuously; the circle scales with a CSS transition matched
// to each phase's duration, so the animation itself paces the breath.
const PATTERNS = {
  box: {
    label: 'Box breathing',
    hint: 'Steadies nerves before a presentation or interview.',
    phases: [
      { name: 'Breathe in', secs: 4, scale: 1, kind: 'in' },
      { name: 'Hold', secs: 4, scale: 1, kind: 'hold' },
      { name: 'Breathe out', secs: 4, scale: 0.55, kind: 'out' },
      { name: 'Hold', secs: 4, scale: 0.55, kind: 'hold' },
    ],
  },
  relax: {
    label: '4-7-8 relax',
    hint: 'Winds the body down — useful before sleep or after a stressful day.',
    phases: [
      { name: 'Breathe in', secs: 4, scale: 1, kind: 'in' },
      { name: 'Hold', secs: 7, scale: 1, kind: 'hold' },
      { name: 'Breathe out slowly', secs: 8, scale: 0.55, kind: 'out' },
    ],
  },
  sigh: {
    label: 'Calming sigh',
    hint: 'The fastest reset — two short inhales, one long exhale.',
    phases: [
      { name: 'Breathe in', secs: 2, scale: 0.85, kind: 'in' },
      { name: 'Top-up breath', secs: 1, scale: 1, kind: 'in' },
      { name: 'Long exhale', secs: 6, scale: 0.55, kind: 'out' },
    ],
  },
};

// ── Sound preference ─────────────────────────────────────────────────────────
const PREFS_KEY = 'datad-wellbeing-ambience';
const PREFS_DEFAULT = { sound: false, volume: 0.6 };

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return PREFS_DEFAULT;
    const saved = JSON.parse(raw);
    return {
      sound: typeof saved.sound === 'boolean' ? saved.sound : PREFS_DEFAULT.sound,
      volume: Number.isFinite(saved.volume)
        ? Math.min(1, Math.max(0, saved.volume))
        : PREFS_DEFAULT.volume,
    };
  } catch { return PREFS_DEFAULT; }
}

function savePrefs(prefs) {
  // Storage disabled (private mode) or full: the preference is a convenience,
  // never worth breaking the exercise over.
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

function BreathingExercise() {
  const [patternKey, setPatternKey] = useState('box');
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [sound, setSound] = useState(() => loadPrefs().sound);
  const [volume, setVolume] = useState(() => loadPrefs().volume);
  const timerRef = useRef(null);
  const ambienceRef = useRef(null);

  const pattern = PATTERNS[patternKey];
  const phase = pattern.phases[phaseIdx];

  useEffect(() => {
    if (!running) return undefined;
    timerRef.current = setTimeout(
      () => setPhaseIdx((i) => (i + 1) % pattern.phases.length),
      phase.secs * 1000
    );
    return () => clearTimeout(timerRef.current);
  }, [running, phaseIdx, pattern, phase.secs]);

  // The ambience is generated, not loaded — see utils/ambientAudio.
  const ambience = () => {
    if (!ambienceRef.current) {
      ambienceRef.current = createAmbience();
      ambienceRef.current.setVolume(volume); // honour a restored preference
    }
    return ambienceRef.current;
  };

  useEffect(() => () => ambienceRef.current?.dispose(), []);

  // Sound plays only while a session is running, so the page is never noisy
  // on its own; the swell follows whichever phase is active.
  useEffect(() => {
    if (!sound) return;
    if (running) {
      ambience().start().then(() => ambience().cueBreath(phase.kind, phase.secs));
    } else {
      ambienceRef.current?.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound, running, phaseIdx, patternKey]);

  useEffect(() => { savePrefs({ sound, volume }); }, [sound, volume]);

  const toggleSound = () => {
    setSound((on) => {
      if (on) ambienceRef.current?.stop();
      return !on;
    });
  };

  const changeVolume = (next) => {
    setVolume(next);
    ambienceRef.current?.setVolume(next);
  };

  const start = () => { setPhaseIdx(0); setRunning(true); };
  const stop = () => { setRunning(false); setPhaseIdx(0); ambienceRef.current?.stop(); };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800/80 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Wind className="h-4 w-4 text-sky-500" /> Take a breath
        </h2>
        <div className="flex gap-1.5">
          {Object.entries(PATTERNS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => { setPatternKey(key); stop(); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                patternKey === key
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-6 text-center text-xs text-gray-500 dark:text-gray-400">{pattern.hint}</p>

      <div className="flex flex-col items-center">
        <div className="relative flex h-44 w-44 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full bg-sky-100 dark:bg-sky-900/30"
            style={{
              transform: `scale(${running ? phase.scale : 0.7})`,
              transition: `transform ${running ? phase.secs : 0.6}s ease-in-out`,
            }}
          />
          <p className="relative z-10 text-sm font-medium text-sky-700 dark:text-sky-300">
            {running ? phase.name : 'Ready when you are'}
          </p>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={toggleSound}
            aria-pressed={sound}
            title={sound ? 'Mute ambience' : 'Play calming ambience'}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              sound
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            Sound
          </button>
          {sound && (
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Ambience volume"
              className="h-1 w-28 cursor-pointer accent-sky-600"
            />
          )}
        </div>

        <button
          onClick={running ? stop : start}
          className={`mt-4 rounded-xl px-6 py-2 text-sm font-medium transition-colors ${
            running
              ? 'border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
              : 'bg-sky-600 text-white hover:bg-sky-700'
          }`}
        >
          {running ? 'Stop' : 'Start'}
        </button>
      </div>
    </div>
  );
}

export default function WellbeingPage() {
  useDocumentTitle('Wellbeing');
  return (
    <Page overview={{
      pageKey: 'wellbeing-hub',
      title: 'Keeping the engine running',
      blurb: 'Study technique, memory methods, daily routines and support resources for when the term gets heavy.',
      takeaway: 'Pick one routine to hold steady this week rather than fixing everything at once.',
    }}>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Breathing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The fastest reset — pick a pattern and follow the circle.
        </p>
      </div>
      <BreathingExercise />
    </Page>
  );
}
