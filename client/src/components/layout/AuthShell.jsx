import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Logo from '../common/Logo';

// Calm, focused auth screen: one card, one purpose, no decoration by default.
// `background` lets a specific page (login, register) render its own
// full-bleed layer behind the card; `maxWidth` widens the card itself for
// forms with more fields than a single email/password pair.
export default function AuthShell({
  subtitle,
  children,
  background,
  maxWidth = 'max-w-sm',
  // The wordmark is drawn in `currentColor`, so it takes the colour of whatever
  // it sits on. That is right for a card whose surface follows the theme, and
  // wrong for a page that pins its own dark backdrop regardless of theme (see
  // login): there the mark has to be told it is on dark, or it renders near
  // black on near black in light mode.
  logoClassName = 'text-gray-900 dark:text-gray-100',
  cardClassName = 'rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800/80 dark:bg-gray-900',
  subtitleClassName = 'mt-2 text-sm text-gray-500 dark:text-gray-400',
  footerClassName = 'mt-5 text-center text-[11px] text-gray-400 dark:text-gray-500',
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {background}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`relative z-10 w-full ${maxWidth}`}
      >
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo size="lg" showTagline className={logoClassName} />
          <p className={subtitleClassName}>{subtitle}</p>
        </div>
        <div className={cardClassName}>{children}</div>
        <p className={footerClassName}>
          {/* "Confirms you still accept", not "by continuing you agree". Nobody
              reaches a signed-in session without an explicit, recorded
              acceptance — taken at signup, or at the one-time gate on this very
              screen for accounts that predate it. So this line is a reminder of
              a decision already on file, which it can honestly claim, rather
              than a click-wrap standing in for consent that was never given. */}
          Signing in confirms you still accept our{' '}
          <Link to="/terms" className="hover:underline">Terms</Link>
          {' '}and{' '}
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>.
          No tracking. No ads. Your data belongs to you.
        </p>
      </motion.div>
    </div>
  );
}
