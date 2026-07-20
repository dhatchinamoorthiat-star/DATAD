import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Mail, ExternalLink, Code2, Sparkles,
  BookOpen, Users, Zap, Heart, Shield, Globe, CheckCircle,
  Trophy, TrendingUp, Lightbulb, Brain, Palette, Building2, Lock,
} from 'lucide-react';
import { Page } from '../components/common/motion';

function IntersectionReveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function CreatorPage() {
  const [hoveredStat, setHoveredStat] = useState(null);

  const stats = [
    { label: 'Lines of Code', value: '50K+', icon: Code2 },
    { label: 'Students Using', value: '500+', icon: Users },
    { label: 'Features Built', value: '25+', icon: Sparkles },
    { label: 'Years of Work', value: '3', icon: Trophy },
  ];

  const milestones = [
    {
      year: '2022',
      title: 'The Problem',
      desc: 'Noticed placement season chaos — students juggling tools across spreadsheets, WhatsApp, and sticky notes.',
      icon: Lightbulb,
      color: 'from-blue-500/20 to-cyan-500/20',
    },
    {
      year: '2023',
      title: 'First Code',
      desc: 'Started building alone with no framework. Just a laptop and belief that student tools should be different.',
      icon: Code2,
      color: 'from-purple-500/20 to-pink-500/20',
    },
    {
      year: '2024',
      title: 'First Users',
      desc: 'Notes and Planner shipped. Classmates started using it. Realized this was solving a real problem.',
      icon: BookOpen,
      color: 'from-amber-500/20 to-orange-500/20',
    },
    {
      year: '2025',
      title: 'Full Platform',
      desc: 'Finance, Resume, Career Hub, Community, and Dax AI. A complete Student Operating System.',
      icon: Globe,
      color: 'from-emerald-500/20 to-teal-500/20',
    },
  ];

  const pillars = [
    {
      icon: Brain,
      title: 'Psychology First',
      subtitle: 'Cognitive Design',
      desc: 'No infinite scrolls. No dark patterns. Built on principles of sustainable productivity and mental wellbeing.',
      color: 'text-purple-400 bg-purple-500/10',
      border: 'border-purple-500/30',
    },
    {
      icon: Code2,
      title: 'Full-Stack Built',
      subtitle: 'By One Person',
      desc: 'Express backend, React frontend, MongoDB database, AI pipeline. Every feature designed end-to-end.',
      color: 'text-cyan-400 bg-cyan-500/10',
      border: 'border-cyan-500/30',
    },
    {
      icon: Heart,
      title: 'Student-Centric',
      subtitle: 'Always',
      desc: 'Built by a student. For students. Every decision asks: does this actually help someone?',
      color: 'text-rose-400 bg-rose-500/10',
      border: 'border-rose-500/30',
    },
  ];

  const principles = [
    { icon: Shield, title: 'No Ads', desc: 'Ever. Your attention is yours.' },
    { icon: Lock, title: 'No Data Selling', desc: 'Your thoughts stay with you.' },
    { icon: Zap, title: 'No Dark Patterns', desc: 'Only genuine value.' },
  ];

  return (
    <Page bare className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black">
      {/* Background elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header/Nav */}
      <div className="relative z-10 border-b border-slate-800/50 backdrop-blur-md sticky top-0 w-full">
        <div className="px-6 sm:px-8 lg:px-12 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
            <ArrowRight className="w-4 h-4 rotate-180" /> Back to DATAD
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400">Still Building</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative z-10 w-full px-6 sm:px-8 lg:px-12 py-20 sm:py-32">
        <IntersectionReveal>
          <div className="text-center max-w-5xl mx-auto">
            {/* Avatar */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-2xl opacity-40 animate-pulse" />
                <div className="relative h-32 w-32 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-6xl font-black text-white shadow-2xl ring-4 ring-slate-900">
                  DD
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="mb-6 space-y-3">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400">
                T. A. Dhatchina Moorthi
              </p>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-tight">
                Builder.<br />
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Psychology-driven.
                </span>
                <br />
                Student-first.
              </h1>
            </div>

            {/* Tagline */}
            <p className="text-lg sm:text-xl text-slate-300 mb-8 leading-relaxed max-w-2xl mx-auto">
              A self-taught engineer who built <span className="font-bold text-white">DATAD</span> — a complete operating system for student life — because no tool existed that understood what students actually needed.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
              <Link
                to="/register"
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-2xl transition-all shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 flex items-center justify-center gap-2"
              >
                Join DATAD <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="mailto:digitaldoncodes@gmail.com"
                className="px-8 py-4 border-2 border-slate-700 hover:border-blue-500/50 text-slate-300 hover:text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" /> Get in Touch
              </a>
            </div>

            {/* Social Links */}
            <div className="flex gap-4 justify-center">
              <a href="https://instagram.com/technerdalert" target="_blank" rel="noreferrer" className="p-3 rounded-full bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 hover:text-blue-400 transition-all text-slate-400">
                <Globe className="w-5 h-5" />
              </a>
              <a href="mailto:digitaldoncodes@gmail.com" className="p-3 rounded-full bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 hover:text-blue-400 transition-all text-slate-400">
                <Mail className="w-5 h-5" />
              </a>
              <a href="tel:+919363632214" className="p-3 rounded-full bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 hover:text-blue-400 transition-all text-slate-400">
                <Zap className="w-5 h-5" />
              </a>
            </div>
          </div>
        </IntersectionReveal>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 w-full px-6 sm:px-8 lg:px-12 py-16 border-y border-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <IntersectionReveal>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {stats.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredStat(idx)}
                    onMouseLeave={() => setHoveredStat(null)}
                    className={`p-6 rounded-2xl border transition-all ${
                      hoveredStat === idx
                        ? 'bg-slate-800/50 border-blue-500/50 scale-105'
                        : 'bg-slate-900/30 border-slate-800'
                    }`}
                  >
                    <Icon className="w-6 h-6 text-blue-400 mb-3" />
                    <p className="text-2xl font-black text-white">{stat.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </IntersectionReveal>
        </div>
      </section>

      {/* The Story */}
      <section className="relative z-10 w-full px-6 sm:px-8 lg:px-12 py-20">
        <div className="max-w-7xl mx-auto">
          <IntersectionReveal>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/30 inline-block">
                  Origin Story
                </span>
                <h2 className="text-4xl font-black text-white mt-4 mb-6">
                  Why I started building
                </h2>
                <div className="space-y-4 text-slate-300 leading-relaxed">
                  <p>
                    I was a psychology student at KCLAS watching my batchmates juggle placement prep across five different apps. Every tool solved one problem — but student life isn't one-dimensional.
                  </p>
                  <p>
                    No one had built software that understood placement deadlines, finance tracking, career prep, and community all together. So I did.
                  </p>
                  <p>
                    Three years, 50K+ lines of code, and one person later — DATAD exists. Not as a startup. Not as a side project. As the tool students actually needed.
                  </p>
                </div>
              </div>
              <IntersectionReveal delay={200}>
                <div className="bg-gradient-to-br from-blue-500/10 via-slate-900 to-purple-500/10 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl" />
                  <div className="relative space-y-4">
                    <div className="text-sm font-mono text-blue-400">
                      <div>const DATAD = {'{' }</div>
                      <div className="ml-4">madeBy: 'one student',</div>
                      <div className="ml-4">forWho: 'all students',</div>
                      <div className="ml-4">hasAds: false,</div>
                      <div className="ml-4">sellingData: false,</div>
                      <div className="ml-4">philosophy: 'human first',</div>
                      <div>{'}' }</div>
                    </div>
                  </div>
                </div>
              </IntersectionReveal>
            </div>
          </IntersectionReveal>
        </div>
      </section>

      {/* Three Pillars */}
      <section className="relative z-10 w-full px-6 sm:px-8 lg:px-12 py-20">
        <div className="max-w-7xl mx-auto">
          <IntersectionReveal>
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400 bg-purple-500/10 px-4 py-2 rounded-full border border-purple-500/30 inline-block">
                Philosophy
              </span>
              <h2 className="text-4xl font-black text-white mt-4">What guides every decision</h2>
            </div>
          </IntersectionReveal>

          <div className="grid md:grid-cols-3 gap-6">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <IntersectionReveal key={idx} delay={idx * 100}>
                  <div className={`group p-8 rounded-3xl border ${pillar.border} ${pillar.color} backdrop-blur-md hover:border-blue-500/50 hover:scale-105 transition-all`}>
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 w-fit mb-4 group-hover:scale-110 transition-transform">
                      <Icon className={`w-6 h-6 ${pillar.color}`} />
                    </div>
                    <h3 className="text-lg font-black text-white mb-1">{pillar.title}</h3>
                    <p className="text-xs font-semibold text-slate-400 mb-3">{pillar.subtitle}</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{pillar.desc}</p>
                  </div>
                </IntersectionReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="relative z-10 w-full px-6 sm:px-8 lg:px-12 py-20">
        <div className="max-w-7xl mx-auto">
          <IntersectionReveal>
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/30 inline-block">
                Timeline
              </span>
              <h2 className="text-4xl font-black text-white mt-4">From hostel room to 500+ users</h2>
            </div>
          </IntersectionReveal>

          <div className="grid md:grid-cols-2 gap-6">
            {milestones.map((milestone, idx) => {
              const Icon = milestone.icon;
              return (
                <IntersectionReveal key={idx} delay={idx * 100}>
                  <div className={`p-6 rounded-2xl bg-gradient-to-br ${milestone.color} border border-slate-800 hover:border-blue-500/30 transition-all`}>
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 shrink-0 mt-1">
                        <Icon className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">{milestone.year}</p>
                        <h3 className="text-lg font-bold text-white mt-1 mb-2">{milestone.title}</h3>
                        <p className="text-sm text-slate-300 leading-relaxed">{milestone.desc}</p>
                      </div>
                    </div>
                  </div>
                </IntersectionReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="relative z-10 w-full px-6 sm:px-8 lg:px-12 py-20 border-y border-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <IntersectionReveal>
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-rose-400 bg-rose-500/10 px-4 py-2 rounded-full border border-rose-500/30 inline-block">
                Core Values
              </span>
              <h2 className="text-4xl font-black text-white mt-4">Lines I won't cross</h2>
            </div>
          </IntersectionReveal>

          <div className="grid sm:grid-cols-3 gap-6">
            {principles.map((principle, idx) => {
              const Icon = principle.icon;
              return (
                <IntersectionReveal key={idx} delay={idx * 100}>
                  <div className="text-center p-8 rounded-2xl bg-slate-900/30 border border-slate-800 hover:border-rose-500/30 transition-all">
                    <div className="inline-flex p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 mb-4">
                      <Icon className="w-6 h-6 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{principle.title}</h3>
                    <p className="text-sm text-slate-400">{principle.desc}</p>
                  </div>
                </IntersectionReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* What's Inside */}
      <section className="relative z-10 w-full px-6 sm:px-8 lg:px-12 py-20">
        <div className="max-w-7xl mx-auto">
          <IntersectionReveal>
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/30 inline-block">
                Features
              </span>
              <h2 className="text-4xl font-black text-white mt-4">Everything built from scratch</h2>
            </div>
          </IntersectionReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: BookOpen, title: 'Study Notes', desc: 'Rich text, tagging, search, and smart organization.' },
              { icon: Palette, title: 'Planner', desc: 'Weekly planning that understands semester rhythms.' },
              { icon: TrendingUp, title: 'Finance', desc: 'Expense tracking, budgets, and ROI calculators.' },
              { icon: Building2, title: 'Career Hub', desc: 'Company prep, placement drives, internship tracking.' },
              { icon: Users, title: 'Community', desc: 'Announcements, events, skill exchange, memories.' },
              { icon: Brain, title: 'Dax AI', desc: 'AI companion that adapts to your needs.' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <IntersectionReveal key={idx} delay={idx * 60}>
                  <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800 hover:border-emerald-500/30 hover:bg-slate-800/20 transition-all group">
                    <Icon className="w-6 h-6 text-emerald-400 mb-3 group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold text-white mb-2">{item.title}</h4>
                    <p className="text-sm text-slate-400">{item.desc}</p>
                  </div>
                </IntersectionReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* DATAD Name */}
      <section className="relative z-10 w-full px-6 sm:px-8 lg:px-12 py-20">
        <div className="max-w-3xl mx-auto">
          <IntersectionReveal>
            <div className="text-center p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/30 inline-block">
                The Name
              </span>
              <h2 className="text-3xl font-black text-white mt-5 mb-4">Why DATAD?</h2>
              <p className="text-slate-300 mb-4">
                <strong className="text-white">D</strong>iscov<strong className="text-blue-400">e</strong>r. <strong className="text-white">A</strong>spire. <strong className="text-white">T</strong>ransform. <strong className="text-white">A</strong>chieve. <strong className="text-white">D</strong>evelop.
              </p>
              <p className="text-slate-400 text-sm max-w-lg mx-auto">
                Plus the initials T.A.D of my name. The platform reflects the journey I wanted every student to take — and the person who built it.
              </p>
            </div>
          </IntersectionReveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 w-full px-6 sm:px-8 lg:px-12 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <IntersectionReveal>
            <div className="space-y-8">
              <div>
                <h2 className="text-5xl font-black text-white mb-4">
                  Built by a student.<br />
                  <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">For students.</span>
                </h2>
                <p className="text-lg text-slate-300 max-w-2xl mx-auto">
                  No ads. No tracking. No dark patterns. Just software that respects your time and your mind.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <Link
                  to="/register"
                  className="group px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-2xl transition-all shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 flex items-center justify-center gap-2"
                >
                  Join Free Today <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/support"
                  className="px-10 py-4 border-2 border-slate-700 hover:border-blue-500/50 text-slate-300 hover:text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4" /> Support the Project
                </Link>
              </div>

              <p className="text-xs text-slate-500 pt-8 border-t border-slate-800">
                Independent · Community-backed · Built with love · D² Labs 🚀
              </p>
            </div>
          </IntersectionReveal>
        </div>
      </section>
    </Page>
  );
}
