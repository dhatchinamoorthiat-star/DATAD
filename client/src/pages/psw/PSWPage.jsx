import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { PSW_FEATURES, PSW_TRACTION, PSW_TIERS } from './pswData';
import FeatureCard from './components/FeatureCard';

// ── scroll-reveal (same pattern as AboutPage) ──
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = '' }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// PSW = Pitch. Sell. Win. — a single, self-contained showcase of the 6 core
// pillars for investor/demo use. Content lives in pswData.js as static,
// curated copy rather than live queries, so this page always renders the
// same clean story regardless of DB state, auth, or AI provider health.
export default function PSWPage() {
  useDocumentTitle('DATAD — Pitch, Sell, Win');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-25 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.35) 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[420px] bg-indigo-600/12 blur-[160px] pointer-events-none rounded-full" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
          <ArrowRight className="w-4 h-4 rotate-180" /> Back to DATAD
        </Link>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Pitch · Sell · Win
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-8 text-center">
        <Reveal>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            The Student Operating System —
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">six pillars, one advisor.</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-5 max-w-2xl mx-auto leading-relaxed">
            Deadlines. Career. Your daily briefing. Money. Campus. Wellbeing. All held together by Dax —
            an AI advisor that knows the whole picture, not just one conversation.
          </p>
          <p className="text-slate-600 text-xs mt-4">Tap a card to open it.</p>
        </Reveal>
      </section>

      {/* 6 pillars — flashcards straight into the real workspace */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 mt-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PSW_FEATURES.map((feature, idx) => (
            <Reveal key={feature.id} delay={idx * 60}>
              <FeatureCard feature={feature} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Traction */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 mt-24">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Current Traction</h2>
            <p className="text-slate-400 text-sm mt-2">Real usage from the current B-school cohort.</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          {PSW_TRACTION.map((t, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center backdrop-blur-md">
                <div className="text-2xl sm:text-3xl font-black text-indigo-400">{t.stat}</div>
                <div className="text-xs text-slate-400 mt-1.5 leading-snug">{t.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 mt-24">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Business Model</h2>
            <p className="text-slate-400 text-sm mt-2">Tier-based pricing — Dax is the value driver.</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-3 gap-5">
          {PSW_TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 80}>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center backdrop-blur-md h-full">
                <div className="text-sm font-bold text-white">{tier.name}</div>
                <div className="text-lg font-black text-indigo-400 mt-1">{tier.price}</div>
                <div className="text-[11px] text-purple-400 font-mono mt-2">{tier.model}</div>
                <div className="text-xs text-slate-500 mt-2">{tier.best}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <footer className="relative z-10 text-center mt-24 space-y-4">
        <Reveal>
          <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold rounded-2xl transition-all shadow-xl shadow-indigo-950/50">
            <span>Join DATAD</span><ArrowRight className="w-4 h-4" />
          </Link>
        </Reveal>
        <p className="text-[11px] text-slate-600">No ads · No tracking · Your data belongs to you</p>
      </footer>
    </div>
  );
}
