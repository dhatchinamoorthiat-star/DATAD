import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Compass, Target, Zap, Trophy, TrendingUp,
  ShieldCheck, Cpu, Brain, Heart, ArrowRight, Database,
  BarChart2, Eye, Lightbulb, Globe,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MAKER } from '../utils/maker';

/* ── scroll-reveal hook ── */
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

/* ── DATA story facts ── */
const dataFacts = [
  { icon: Database, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30', stat: '2.5 Quintillion', label: 'bytes created every day', desc: 'Every photo you take, every message you send, every step counted — the world never stops generating data.' },
  { icon: BarChart2, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', stat: '90%', label: 'of all data was created in the last 2 years', desc: 'The information age is accelerating. What you learn today is already being reshaped by tomorrow\'s data.' },
  { icon: Eye, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', stat: '1 in 3', label: 'career decisions are data-driven', desc: 'Companies that hire you, the roles they offer, the salaries they quote — all shaped by patterns in data.' },
  { icon: Lightbulb, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', stat: '₹8–30L', label: 'salary premium for data-literate professionals', desc: 'Reading, understanding, and communicating data is the single biggest skill premium in the modern workforce.' },
  { icon: Globe, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', stat: '100%', label: 'of your decisions are data', desc: 'Every choice you make — what to study, who to network with, which company to target — is a decision that improves with better data.' },
];

/* ── DATAD acronym ── */
const letters = [
  { char: 'D', color: 'text-cyan-400', shadow: 'drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]', topNode: { id: 'discover', title: 'D — Discover', subtitle: 'Uncover Insight', desc: 'Explore knowledge, opportunities, and yourself.', icon: Compass, border: 'border-cyan-500/50', bg: 'bg-cyan-500/10 text-cyan-400' } },
  { char: 'A', color: 'text-cyan-300', shadow: 'drop-shadow-[0_0_12px_rgba(103,232,249,0.5)]', bottomNode: { id: 'aspire', title: 'A — Aspire', subtitle: 'Set Purpose', desc: 'Dream bigger and set meaningful goals.', icon: Target, border: 'border-blue-500/50', bg: 'bg-blue-500/10 text-blue-400' } },
  { char: 'T', color: 'text-purple-400', shadow: 'drop-shadow-[0_0_14px_rgba(192,132,252,0.6)]', topNode: { id: 'transform', title: 'T — Transform', subtitle: 'Apply Knowledge', desc: 'Convert learning into practical skills.', icon: Zap, border: 'border-purple-500/50', bg: 'bg-purple-500/10 text-purple-400' } },
  { char: 'A', color: 'text-amber-300', shadow: 'drop-shadow-[0_0_12px_rgba(252,211,77,0.5)]', bottomNode: { id: 'achieve', title: 'A — Achieve', subtitle: 'Realise Success', desc: 'Reach academic and career milestones.', icon: Trophy, border: 'border-amber-500/50', bg: 'bg-amber-500/10 text-amber-400' } },
  { char: 'D', color: 'text-amber-400', shadow: 'drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]', topNode: { id: 'develop', title: 'D — Develop', subtitle: 'Continuous Growth', desc: 'Keep growing — personally and professionally.', icon: TrendingUp, border: 'border-rose-500/50', bg: 'bg-rose-500/10 text-rose-400' } },
];

const pillars = [
  { icon: Cpu, title: 'Engineered for Clarity', tagline: 'Architecture Meets Intuition', description: 'DATAD is designed as an external digital brain. Real-time data, fluid UX, and structured milestone tracking turn goal-setting into daily action — without adding noise.', gradient: 'from-cyan-500/10 via-slate-900 to-slate-900', border: 'border-cyan-500/30' },
  { icon: Brain, title: 'Psychologically Balanced', tagline: 'Cognitive Recovery by Design', description: 'Sustainable achievement requires mental restoration. DATAD embeds reflection, nostalgia, and recovery tools alongside productivity systems — because burnout is not a feature.', gradient: 'from-purple-500/10 via-slate-900 to-slate-900', border: 'border-purple-500/30' },
  { icon: ShieldCheck, title: 'Your Data Stays Yours', tagline: 'Personal Data Sovereignty', description: 'No ads. No tracking. No third parties. Your notes, goals, finances, and reflections belong entirely to you. DATAD does not monetise your personal growth.', gradient: 'from-amber-500/10 via-slate-900 to-slate-900', border: 'border-amber-500/30' },
];

const milestones = [
  { when: 'Late 2024', label: 'Notes & Planner', detail: 'The first tools — a shared note system and personal planner to bring peers together academically.' },
  { when: 'Early 2025', label: 'Finance & Resume', detail: 'Expense tracking, budget visualisation, and an ATS-ready resume builder built around placement season.' },
  { when: 'Mid 2025', label: 'Career Hub & Intelligence', detail: 'Company prep, placement readiness score, daily case studies, and a live market + news briefing.' },
  { when: 'Mid 2025', label: 'Community & Journal', detail: 'Discussions, announcements, nostalgia archive, and a private daily journal for reflection.' },
  { when: 'Now', label: 'v1.0 — Public Launch', detail: 'A complete student operating system: study, career, community, and personal tools in one place.' },
];

export default function AboutPage() {
  const [activeNode, setActiveNode] = useState(null);
  const [columnStages, setColumnStages] = useState([0, 0, 0, 0, 0]);

  const startReveal = () => {
    setColumnStages([0, 0, 0, 0, 0]);
    letters.forEach((_, i) => {
      const base = i * 400;
      setTimeout(() => setColumnStages((p) => { const n = [...p]; n[i] = 1; return n; }), base + 80);
      setTimeout(() => setColumnStages((p) => { const n = [...p]; n[i] = 2; return n; }), base + 240);
      setTimeout(() => setColumnStages((p) => { const n = [...p]; n[i] = 3; return n; }), base + 400);
    });
  };

  // Kicks off a one-shot timed reveal animation on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { startReveal(); }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 relative overflow-hidden">

      {/* Dot matrix background */}
      <div className="absolute inset-0 z-0 opacity-25 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(168,85,247,0.4) 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-purple-600/12 blur-[160px] pointer-events-none rounded-full" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
          <ArrowRight className="w-4 h-4 rotate-180" /> Back to DATAD
        </Link>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> The Story Behind DATAD
        </div>
        <button onClick={startReveal} title="Replay" className="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 text-slate-400 hover:text-white transition-all flex items-center justify-center">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        </button>
      </header>

      {/* ── DATAD Matrix ── */}
      <main className="relative z-10 max-w-6xl mx-auto w-full min-h-[560px] flex flex-col items-center justify-center px-4 my-4">
        <div className="w-full grid grid-cols-5 gap-2 sm:gap-4 mb-6 z-20">
          {letters.map((item, idx) => {
            const revealed = columnStages[idx] >= 3;
            return (
              <div key={`top-${idx}`} className="flex justify-center">
                {item.topNode ? (
                  <button type="button" onClick={() => revealed && setActiveNode(activeNode?.id === item.topNode.id ? null : item.topNode)} className={`p-3 sm:p-4 rounded-2xl bg-slate-900/90 border ${item.topNode.border} backdrop-blur-md shadow-xl cursor-pointer hover:scale-105 transition-all duration-500 w-full max-w-[190px] ${revealed ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1.5 rounded-lg ${item.topNode.bg}`}><item.topNode.icon className="w-3.5 h-3.5" /></div>
                      <span className="text-[11px] font-bold text-white truncate">{item.topNode.title}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2">{item.topNode.desc}</p>
                  </button>
                ) : <div className="h-12" />}
              </div>
            );
          })}
        </div>

        <div className="relative w-full py-8 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {[
              { x: '10%', dir: 'up', color: 'rgba(34,211,238,0.9)', idx: 0 },
              { x: '30%', dir: 'down', color: 'rgba(103,232,249,0.9)', idx: 1 },
              { x: '50%', dir: 'up', color: 'rgba(192,132,252,1)', idx: 2 },
              { x: '70%', dir: 'down', color: 'rgba(252,211,77,0.9)', idx: 3 },
              { x: '90%', dir: 'up', color: 'rgba(251,191,36,0.9)', idx: 4 },
            ].map(({ x, dir, color, idx }) => (
              <line key={idx} x1={x} y1="50%" x2={x} y2={dir === 'up' ? '0%' : '100%' } stroke={color} strokeWidth="3" strokeDasharray="4 10" strokeLinecap="round"
                style={{ strokeDashoffset: columnStages[idx] >= 2 ? '0' : '200', opacity: columnStages[idx] >= 2 ? 1 : 0, transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1), opacity 0.3s' }} />
            ))}
          </svg>

          <div className="relative z-10 grid grid-cols-5 gap-2 sm:gap-4 w-full text-center">
            {letters.map((item, idx) => {
              const visible = columnStages[idx] >= 1;
              return (
                <div key={idx} className="flex flex-col items-center justify-center">
                  {item.topNode ? <div className={`w-2.5 h-2.5 rounded-full bg-purple-400 mb-2 transition-all duration-300 ${columnStages[idx] >= 2 ? 'scale-100 opacity-100 animate-ping' : 'scale-0 opacity-0'}`} /> : <div className="h-4" />}
                  <div className={`p-4 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-2xl transition-all duration-500 ${visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-4'}`}>
                    <span className={`text-4xl sm:text-7xl font-black ${item.color} ${item.shadow}`}>{item.char}</span>
                  </div>
                  {item.bottomNode ? <div className={`w-2.5 h-2.5 rounded-full bg-purple-400 mt-2 transition-all duration-300 ${columnStages[idx] >= 2 ? 'scale-100 opacity-100 animate-ping' : 'scale-0 opacity-0'}`} /> : <div className="h-4" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full grid grid-cols-5 gap-2 sm:gap-4 mt-6 z-20">
          {letters.map((item, idx) => {
            const revealed = columnStages[idx] >= 3;
            return (
              <div key={`bottom-${idx}`} className="flex justify-center">
                {item.bottomNode ? (
                  <button type="button" onClick={() => revealed && setActiveNode(activeNode?.id === item.bottomNode.id ? null : item.bottomNode)} className={`p-3 sm:p-4 rounded-2xl bg-slate-900/90 border ${item.bottomNode.border} backdrop-blur-md shadow-xl cursor-pointer hover:scale-105 transition-all duration-500 w-full max-w-[190px] ${revealed ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={"p-1.5 rounded-lg " + item.bottomNode.bg}><item.bottomNode.icon className="w-3.5 h-3.5" /></div>
                      <span className="text-[11px] font-bold text-white truncate">{item.bottomNode.title}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2">{item.bottomNode.desc}</p>
                  </button>
                ) : <div className="h-12" />}
              </div>
            );
          })}
        </div>
      </main>

      {activeNode && (
        <div className="relative z-30 max-w-xl mx-auto px-6 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900/95 border border-purple-500/40 p-5 rounded-2xl backdrop-blur-xl shadow-2xl flex justify-between items-start gap-4">
            <div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{activeNode.subtitle}</span>
              <h3 className="text-base font-bold text-white mt-0.5">{activeNode.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed mt-1.5">{activeNode.desc}</p>
            </div>
            <button onClick={() => setActiveNode(null)} className="text-[11px] text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 shrink-0">Close</button>
          </div>
        </div>
      )}

      {/* ── The Story of DATA ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 mt-24">
        <Reveal>
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-4">
              <Database className="w-3.5 h-3.5" /> Why Data Changes Everything
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              The most powerful resource <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">in the world is DATA.</span>
            </h2>
            <p className="text-slate-400 text-sm mt-4 max-w-2xl mx-auto leading-relaxed">
              Before we tell you about the platform — let us tell you about the word that starts it all. Because the name DATAD begins with data, and that&rsquo;s not an accident.
            </p>
          </div>
        </Reveal>

        {/* Opening hook */}
        <Reveal delay={100}>
          <div className="bg-gradient-to-br from-cyan-500/8 via-slate-900 to-purple-500/8 border border-cyan-500/20 rounded-3xl p-8 sm:p-12 mb-10 text-center">
            <p className="text-lg sm:text-2xl text-slate-200 leading-relaxed font-light italic">
              &ldquo;Every great decision in history — in business, in medicine, in your career —<br className="hidden sm:block" />
              was made by someone who had <strong className="text-cyan-300 not-italic font-bold">better data</strong> than everyone else.&ldquo;
            </p>
          </div>
        </Reveal>

        {/* Data facts grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {dataFacts.map((fact, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className={"bg-slate-900/80 border " + fact.bg + " rounded-2xl p-6 backdrop-blur-md hover:-translate-y-1 transition-all duration-300"}>
                <div className="p-2.5 rounded-xl bg-slate-950/60 w-fit mb-4">
                  <fact.icon className={"w-5 h-5 " + fact.color} />
                </div>
                <div className={"text-2xl sm:text-3xl font-black " + fact.color + " mb-1"}>{fact.stat}</div>
                <div className="text-xs font-semibold text-slate-300 mb-2">{fact.label}</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{fact.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* The turning point */}
        <Reveal delay={200}>
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 sm:p-10 space-y-5">
            <h3 className="text-lg sm:text-xl font-bold text-white">Your journey is your first dataset.</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Think about it. Two years. Hundreds of decisions — which electives to take, which companies to target, which skills to build, how to spend your weekend, who to network with. Each one of those is a data point. And if you don&rsquo;t track them, they disappear.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Students who keep track of their placements, their learning, their finances, and their goals are not just more prepared — they are more confident. They walk into an interview knowing their story, because they&rsquo;ve been writing it in data all along.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              That&rsquo;s what DATAD was built to do. Not to replace your instinct — but to give your instinct something real to work with.
            </p>
            <div className="pt-2 border-t border-slate-800">
              <p className="text-xs text-cyan-400 italic">
                &ldquo;Data doesn&rsquo;t make decisions for you. It gives you the clarity to make better ones yourself.&rdquo;
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── The Name Behind the Platform (T.A.D story) ── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 mt-24">
        <Reveal>
          <div className="bg-gradient-to-br from-purple-500/8 to-slate-900 border border-purple-500/20 rounded-3xl p-8 sm:p-12">
            <span className="text-[10px] font-bold tracking-widest text-purple-400 uppercase">The Name Behind the Platform</span>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-3 mb-5">T · A · D</h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              The letters <strong className="text-white">T, A, D</strong> appear at the heart of <strong className="text-white">DA<span className="text-purple-300">T</span>AD</strong> — and they are the initials of the person who built it: <strong className="text-white">{MAKER.legalName}</strong>.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              DATAD was not named for a logo or a marketing brief. It was named for a student who believed the best tools are built by the people who most need them. The acronym — Discover, Aspire, Transform, Achieve, Develop — is the journey that student wanted every student to take.
            </p>
            <p className="text-sm text-slate-500 leading-relaxed italic">
              &ldquo;Not a tool someone made for students. A tool a student made — with them, for them.&rdquo;
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── Core Pillars ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 mt-24 space-y-10">
        <Reveal>
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">What DATAD Is Built On</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">Three principles that inform every feature decision.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map((p, idx) => (
            <Reveal key={idx} delay={idx * 120}>
              <div className={"bg-gradient-to-b " + p.gradient + " border " + p.border + " p-6 sm:p-8 rounded-3xl backdrop-blur-md shadow-xl hover:-translate-y-1 transition-all duration-300 h-full"}>
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 w-fit text-purple-400 shadow-md mb-4"><p.icon className="w-5 h-5" /></div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400">{p.tagline}</span>
                <h3 className="text-base font-bold text-white mt-1 mb-3">{p.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{p.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Real Milestones (animated timeline) ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 mt-24 space-y-10">
        <Reveal>
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">How We Got Here</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">Built incrementally — each phase responding to what the batch actually needed.</p>
          </div>
        </Reveal>
        <div className="space-y-5 relative before:absolute before:inset-0 before:left-6 sm:before:left-1/2 before:-translate-x-px before:w-0.5 before:bg-gradient-to-b before:from-purple-500/50 before:via-cyan-500/50 before:to-transparent">
          {milestones.map((m, idx) => (
            <Reveal key={idx} delay={idx * 100}>
              <div className={"relative flex items-center gap-6 sm:gap-12 " + (idx % 2 === 0 ? 'sm:flex-row-reverse' : '')}>
                <div className="absolute left-6 sm:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-950 border-2 border-purple-400 z-10 shadow-[0_0_10px_rgba(192,132,252,0.8)]" />
                <div className="ml-12 sm:ml-0 sm:w-1/2 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md hover:border-purple-500/40 transition-all shadow-lg">
                  <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">{m.when}</span>
                  <h4 className="text-sm font-bold text-white mt-3">{m.label}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{m.detail}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Founder Statement ── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 mt-24 text-center">
        <Reveal>
          <div className="bg-slate-900/80 border border-slate-800 p-8 sm:p-12 rounded-3xl backdrop-blur-xl shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-slate-800 pointer-events-none"><Heart className="w-32 h-32 opacity-10" /></div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
              <Heart className="w-3.5 h-3.5" /> Crafted with purpose
            </div>
            <blockquote className="text-sm sm:text-base text-slate-200 leading-relaxed italic">
              &ldquo;DATAD was created out of a desire for a unified digital sanctuary — a place where raw analytical data meets human craftsmanship, and where productivity and deliberate rest coexist seamlessly.&rdquo;
            </blockquote>
            <div className="pt-2">
              {/* Formal register: full name, real title, studio mark. The
                  handle lives one click away on /creator, where it belongs.
                  See MAKER_IDENTITY.md. */}
              <h4 className="text-sm font-bold text-white">{MAKER.legalName}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{MAKER.role}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                <Link to="/creator" className="text-indigo-400 hover:underline">{MAKER.studio}</Link>{' '}· {MAKER.studioLine}
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer CTA */}
      <footer className="relative z-10 text-center mt-16 space-y-4">
        <Reveal>
          <Link to="/" className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold rounded-2xl transition-all shadow-xl shadow-purple-950/50">
            <span>Enter DATAD</span><ArrowRight className="w-4 h-4" />
          </Link>
        </Reveal>
        <p className="text-[11px] text-slate-600">No tracking · No ads · Your data belongs to you</p>
      </footer>
    </div>
  );
}