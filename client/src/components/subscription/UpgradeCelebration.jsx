import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Crown, Zap, Sparkles, Check, ArrowUpRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TIER_LABEL, normalizeTier } from '../../utils/tiers';
import { computeUnlocks } from '../../utils/pricing';

// Raw accent values, not Tailwind classes: the wash and the glow are gradients
// and box-shadows built at runtime, which class names cannot express.
const ACCENT = {
  free:      { base: '#6b7280', glow: 'rgba(107,114,128,0.45)', ring: '#9ca3af' },
  trial:     { base: '#6366f1', glow: 'rgba(99,102,241,0.45)',  ring: '#818cf8' },
  pro:       { base: '#f59e0b', glow: 'rgba(245,158,11,0.45)',  ring: '#fbbf24' },
  placement: { base: '#a855f7', glow: 'rgba(168,85,247,0.45)',  ring: '#c084fc' },
};

const TierPill = ({ tier, muted = false }) => {
  const t = normalizeTier(tier);
  const accent = ACCENT[t] ?? ACCENT.free;
  const Icon = t === 'placement' ? Crown : t === 'pro' ? Zap : Sparkles;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold uppercase tracking-widest text-white"
      style={{
        background: muted ? '#374151' : accent.base,
        boxShadow: muted ? 'none' : `0 0 32px ${accent.glow}`,
      }}
    >
      <Icon className="h-4 w-4" />
      {TIER_LABEL[t] ?? t}
    </span>
  );
};

/**
 * The moment after a verified payment: the page itself takes on the new tier's
 * colour, the old tier badge becomes the new one, and only then does the list
 * of what was unlocked appear.
 *
 * `fromTier` is the tier the student held when they opened checkout — read
 * before the status refresh, or the diff comes out empty and the dialog claims
 * they unlocked nothing.
 */
export default function UpgradeCelebration({ fromTier, toTier, planLabel, onDismiss }) {
  const reduceMotion = useReducedMotion();
  // Reduced motion gets the substance without the theatre: the dialog is the
  // part that carries information, the wash and the morph are decoration.
  const [phase, setPhase] = useState(reduceMotion ? 'dialog' : 'wash');
  const tier = normalizeTier(toTier);
  const accent = ACCENT[tier] ?? ACCENT.pro;
  const { unlocked, upgraded } = computeUnlocks(fromTier, tier);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const toMorph = setTimeout(() => setPhase('morph'), 900);
    const toDialog = setTimeout(() => setPhase('dialog'), 2300);
    return () => {
      clearTimeout(toMorph);
      clearTimeout(toDialog);
    };
  }, [reduceMotion]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden" role="dialog" aria-modal="true" aria-label={`${TIER_LABEL[tier]} activated`}>
      {/* The wash — the whole surface takes the tier's colour. */}
      <motion.div
        initial={reduceMotion ? { opacity: 1 } : { clipPath: 'circle(0% at 50% 50%)' }}
        animate={reduceMotion ? { opacity: 1 } : { clipPath: 'circle(150% at 50% 50%)' }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${accent.base} 0%, #0b0b12 60%, #06060a 100%)`,
        }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'dialog' ? 0.55 : 0.25 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 bg-black"
      />

      {/* Expanding rings, tied to the morph beat. */}
      {!reduceMotion && phase !== 'wash' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {[0, 0.35, 0.7].map((delay) => (
            <motion.span
              key={delay}
              initial={{ scale: 0.2, opacity: 0.5 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 1.8, delay, ease: 'easeOut' }}
              className="absolute h-64 w-64 rounded-full border"
              style={{ borderColor: accent.ring }}
            />
          ))}
        </div>
      )}

      <div className="relative flex h-full flex-col items-center justify-center px-5">
        {/* Sync, not "wait": with mode="wait" the dialog mounts behind the
            morph's exit and its enter transition never fires, leaving the card
            stuck at opacity 0 — the whole payload of this screen, invisible.
            The two phases cross-fade instead, and the morph is absolutely
            positioned so it does not push the dialog off-centre while both are
            briefly mounted. */}
        <AnimatePresence>
          {phase === 'morph' && (
            <motion.div
              key="morph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              className="absolute flex flex-col items-center gap-6 text-center"
            >
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ opacity: 1, scale: 1 }}
                  animate={{ opacity: 0, scale: 0.8, filter: 'blur(6px)' }}
                  transition={{ duration: 0.7, delay: 0.25 }}
                >
                  <TierPill tier={fromTier} muted />
                </motion.div>
                <motion.div
                  initial={{ scale: 0.5, opacity: 0, rotateX: 90 }}
                  animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                  transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <TierPill tier={tier} />
                </motion.div>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-2xl font-bold tracking-tight text-white"
              >
                Welcome to {planLabel || TIER_LABEL[tier]}
              </motion.p>
            </motion.div>
          )}

          {phase === 'dialog' && (
            <motion.div
              key="dialog"
              initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl"
              style={{ boxShadow: `0 25px 80px -20px ${accent.glow}` }}
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
                <div className="flex flex-col items-start gap-2.5">
                  <TierPill tier={tier} />
                  <p className="text-xs text-gray-400">
                    Your payment went through and {planLabel || TIER_LABEL[tier]} is active right now.
                  </p>
                </div>
                <button
                  onClick={onDismiss}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[46vh] space-y-5 overflow-y-auto px-6 py-5">
                {upgraded.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {upgraded.map((row, i) => (
                      <motion.div
                        key={row.label}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.08 }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                      >
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">{row.label}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-white">
                          <span className="text-gray-500 line-through">{row.from}</span>
                          <ArrowUpRight className="h-3.5 w-3.5" style={{ color: accent.ring }} />
                          <span>{row.to}</span>
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}

                {unlocked.length > 0 && (
                  <div>
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
                      Unlocked for you
                    </p>
                    <ul className="space-y-1.5">
                      {unlocked.map((label, i) => (
                        <motion.li
                          key={label}
                          initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.25 + i * 0.05 }}
                          className="flex items-center gap-2.5 text-sm text-gray-200"
                        >
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                            style={{ background: accent.base }}
                          >
                            <Check className="h-3 w-3 text-white" />
                          </span>
                          {label}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}

                {unlocked.length === 0 && upgraded.length === 0 && (
                  <p className="text-sm text-gray-300">
                    Your plan is active. Everything you had stays exactly where it was.
                  </p>
                )}
              </div>

              <div className="flex gap-2 border-t border-white/10 px-6 py-4">
                <button
                  onClick={onDismiss}
                  className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/10"
                >
                  Stay here
                </button>
                <Link
                  to="/"
                  className="flex-1 rounded-xl py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: accent.base }}
                >
                  Start using it
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
