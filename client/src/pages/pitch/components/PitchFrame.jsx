import { useLayoutEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';

// The fake title bar. Fixed height, and the shot has to be sized around it —
// hence the arithmetic below rather than a plain CSS aspect-ratio box.
const CHROME_H = 36;

// A screenshot dressed as a browser window. The slow scale/pan is what makes a
// still read as footage rather than a slide — it restarts whenever the scene
// key changes, and is skipped entirely under prefers-reduced-motion.
export default function PitchFrame({ scene, playing, reduced }) {
  const [failed, setFailed] = useState(false);

  // Read the ratio off the file rather than hard-coding 16/10: the desktop
  // captures are 1440x900, but mobile.png is a 430x932 phone frame, and one
  // ratio for both is what forces either a crop or a pair of empty side bars.
  const [ratio, setRatio] = useState(16 / 10);

  const stageRef = useRef(null);
  const [box, setBox] = useState(null);

  // Reset the per-scene state during render rather than in an effect, so the
  // switch happens in the same commit as the scene change instead of a
  // follow-up render (see https://react.dev/learn/you-might-not-need-an-effect).
  const [prevSceneId, setPrevSceneId] = useState(scene.id);
  if (scene.id !== prevSceneId) {
    setPrevSceneId(scene.id);
    setFailed(false);
    setRatio(16 / 10);
  }

  // Fit the card to the stage in whichever direction runs out first.
  //
  // CSS alone cannot do this: aspect-ratio derives width from height, so it
  // fits a wide stage but leaves a tall dead strip under the shot on a phone,
  // and the reverse (max-w plus a ratio) made the card 676px tall in a 380px
  // slot — it bled up under the header and down through the narration copy,
  // which is the overlap this replaced. Measuring is the honest version.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      if (!w || !h) return;
      const width = Math.min(w, Math.max(0, h - CHROME_H) * ratio);
      setBox({ width, height: width / ratio + CHROME_H });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);

  const src = scene.shot ? `/pitch/${scene.shot}` : null;
  const animate = playing && !reduced;

  return (
    <div ref={stageRef} className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
      <div
        className="flex flex-col rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl shadow-black/60"
        style={box ? { width: `${box.width}px`, height: `${box.height}px` } : { visibility: 'hidden' }}
      >
        {/* window chrome */}
        <div className="shrink-0 flex items-center gap-2 px-4 bg-slate-900 border-b border-slate-800" style={{ height: CHROME_H }}>
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <div className="flex-1 flex justify-center">
            <span className="px-3 py-0.5 rounded-md bg-slate-950/80 text-[11px] text-slate-500 font-mono truncate max-w-[70%]">
              {scene.route || 'datad.online'}
            </span>
          </div>
        </div>

        <div className="relative flex-1 min-h-0 bg-slate-950 overflow-hidden">
          {src && !failed ? (
            <img
              key={scene.id}
              src={src}
              alt={scene.title}
              onError={() => setFailed(true)}
              onLoad={(e) => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                if (w && h) setRatio(w / h);
              }}
              className={`w-full h-full object-cover object-top ${animate ? 'pitch-kenburns' : ''}`}
              style={{ animationDuration: `${scene.seconds}s` }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-600">
              <Monitor className="w-8 h-8" />
              <div className="text-sm font-semibold text-slate-400">{scene.route || scene.title}</div>
              <div className="text-[11px] text-slate-600 font-mono">
                {scene.shot ? `public/pitch/${scene.shot}` : 'no capture for this scene'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
