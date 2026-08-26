import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { PITCH_SCENES, PITCH_RUNTIME, PITCH_SITE } from './pitchScenes';
import PitchFrame from './components/PitchFrame';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// /pitch — the walkthrough reel that stands in for a demo video.
//
// It is a player, not a scrolling page: scenes advance on their own timer, the
// chapter bar doubles as a scrubber, and the whole thing runs the length of the
// pitch itself. Deliberately public and auth-free, so a judge can open the link
// on their own phone without an account.
export default function PitchPage() {
  useDocumentTitle('DATAD — Walkthrough');

  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0); // seconds inside the current scene
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  const scene = PITCH_SCENES[index];
  const last = index === PITCH_SCENES.length - 1;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const goto = useCallback((i) => {
    const clamped = Math.max(0, Math.min(PITCH_SCENES.length - 1, i));
    setIndex(clamped);
    setElapsed(0);
  }, []);

  // Scene clock. rAF rather than an interval so the progress bar tracks the
  // crossfade smoothly and pauses cleanly with the tab.
  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    let prev = performance.now();
    const tick = (now) => {
      const dt = (now - prev) / 1000;
      prev = now;
      setElapsed((e) => {
        const next = e + dt;
        if (next >= scene.seconds) {
          if (last) { setPlaying(false); return scene.seconds; }
          setIndex((i) => i + 1);
          return 0;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, scene.seconds, last]);

  useEffect(() => {
    const onKey = (e) => {
      // Space also activates whatever transport button was last clicked, which
      // would toggle playback twice. Let the button own the key in that case.
      const onControl = e.target instanceof Element && e.target.closest('button, a');
      if (e.key === ' ' && !onControl) { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === 'ArrowRight') goto(index + 1);
      if (e.key === 'ArrowLeft') goto(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goto]);

  const restart = () => { goto(0); setPlaying(true); };

  const before = PITCH_SCENES.slice(0, index).reduce((s, x) => s + x.seconds, 0);
  const position = before + elapsed;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes pitchKenburns {
          from { transform: scale(1.02) translate3d(0,0,0); }
          to   { transform: scale(1.10) translate3d(0,-2.5%,0); }
        }
        .pitch-kenburns { animation-name: pitchKenburns; animation-timing-function: linear; animation-fill-mode: forwards; }
        @keyframes pitchFade { from { opacity: 0; } to { opacity: 1; } }
        .pitch-fade { animation: pitchFade 700ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .pitch-kenburns { animation: none; }
          .pitch-fade { animation: none; }
        }
      `}</style>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-indigo-600/10 blur-[170px] pointer-events-none rounded-full" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-4 shrink-0">
        <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> DATAD
        </Link>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Product walkthrough · {fmt(PITCH_RUNTIME)}
        </div>
      </header>

      {/* Stage */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col">
        <div className="relative flex-1 min-h-[42vh]">
          {scene.kind === 'title' ? (
            <div key={scene.id} className="pitch-fade absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <div className="text-xs font-semibold tracking-[0.3em] text-indigo-400 uppercase">{scene.chapter}</div>
              <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white max-w-3xl">
                {scene.title}
              </h1>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {scene.points.map((p) => (
                  <span key={p} className="px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-400">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div key={scene.id} className="pitch-fade absolute inset-0">
              <PitchFrame scene={scene} playing={playing} reduced={reduced} />
            </div>
          )}
        </div>

        {/* Narration */}
        <div className="relative z-10 px-5 sm:px-8 pb-2 shrink-0">
          <div key={`${scene.id}-copy`} className="pitch-fade max-w-4xl mx-auto text-center sm:text-left">
            <div className="text-[11px] font-semibold tracking-[0.2em] text-indigo-400 uppercase">{scene.chapter}</div>
            {scene.kind !== 'title' && (
              <h2 className="text-lg sm:text-2xl font-bold text-white mt-1.5 tracking-tight">{scene.title}</h2>
            )}
            <p className="text-slate-400 text-sm sm:text-[15px] leading-relaxed mt-2">{scene.narration}</p>
            {scene.kind !== 'title' && (
              <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
                {scene.points.map((p) => (
                  <span key={p} className="px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-800 text-[11px] text-slate-500">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Transport */}
      <footer className="relative z-10 px-5 sm:px-8 py-4 border-t border-slate-900 bg-slate-950/90 backdrop-blur shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* chapter bar — each segment is proportional to its scene length */}
          <div className="flex gap-1" role="group" aria-label="Chapters">
            {PITCH_SCENES.map((s, i) => {
              const fill = i < index ? 1 : i > index ? 0 : Math.min(1, elapsed / s.seconds);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goto(i)}
                  title={`${s.chapter} — ${s.title}`}
                  aria-label={`${s.chapter}: ${s.title}`}
                  className="h-1.5 rounded-full bg-slate-800 overflow-hidden hover:bg-slate-700 transition-colors"
                  style={{ flexGrow: s.seconds }}
                >
                  <span
                    className="block h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    style={{ width: `${fill * 100}%` }}
                  />
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? 'Pause' : 'Play'}
                className="w-10 h-10 rounded-full bg-white text-slate-950 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button type="button" onClick={() => goto(index - 1)} aria-label="Previous scene"
                className="w-9 h-9 rounded-full border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => goto(index + 1)} aria-label="Next scene"
                className="w-9 h-9 rounded-full border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 flex items-center justify-center transition-colors">
                <ArrowRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={restart} aria-label="Restart"
                className="hidden sm:flex w-9 h-9 rounded-full border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 flex items-center justify-center transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
              <span className="ml-2 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap">
                {fmt(position)} / {fmt(PITCH_RUNTIME)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[11px] text-slate-700">space · ← →</span>
              <Link
                to="/register"
                className="px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all whitespace-nowrap"
              >
                Try DATAD
              </Link>
            </div>
          </div>

          <p className="text-[11px] text-slate-700 mt-3 text-center sm:text-left">{PITCH_SITE} · No ads · No tracking</p>
        </div>
      </footer>
    </div>
  );
}
