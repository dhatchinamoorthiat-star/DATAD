import BinaryRainBackground from '../components/common/BinaryRainBackground';

// The two dressings of the sign-in screen.
//
// `standard` is the default and the one the product is judged on: the same
// language as registration and the rest of the app — theme-aware card on the
// global texture, plain labels, primary button. `terminal` is the original
// binary-rain skin, kept because it is the screen a lot of people first met
// DATAD through, and moved behind an opt-in switch rather than deleted.
//
// Everything that differs between the two lives here as data, so LoginPage
// holds exactly one copy of the form and one copy of the auth logic. Adding a
// field means touching one place, not two.

export const SKIN_STORAGE_KEY = 'datad:login-skin';
export const DEFAULT_SKIN = 'standard';

export const SKINS = {
  standard: {
    id: 'standard',
    // Nothing of its own: the app's ambient texture already sits behind this
    // route, and the card is theme-aware, so the screen follows light/dark
    // like every other page.
    background: null,
    shell: {},
    subtitle: 'Sign in to continue',
    input:
      'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-600',
    label: 'mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400',
    link: 'text-xs font-medium text-primary-600 hover:underline dark:text-primary-400',
    submitClass: '',
    notice: 'rounded-lg border border-warn-600/30 bg-warn-50 p-3 text-center dark:bg-warn-950/30',
    noticeText: 'text-xs text-warn-800 dark:text-warn-300',
    noticeAction:
      'mt-2 text-xs font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-700 disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline dark:text-primary-400',
    footerText: 'text-center text-sm text-gray-500 dark:text-gray-400',
    footerLink: 'font-semibold text-primary-600 hover:underline dark:text-primary-400',
    copy: {
      email: 'Email',
      password: 'Password',
      forgot: 'Forgot password?',
      submit: 'Sign in',
      submitting: 'Signing in…',
      consentSubtitle: 'One thing before you continue',
      unconfirmed: 'This account has not been confirmed yet.',
      linkSent: 'Confirmation link sent — check your inbox and spam folder.',
      resend: 'Resend confirmation email',
      resendAgain: 'Send another link',
      resending: 'Sending…',
      newHere: 'New to DATAD?',
      create: 'Create an account',
    },
    consent: {
      heading: 'text-sm font-semibold text-gray-900 dark:text-gray-100',
      headingText: 'One more thing',
      lead: 'mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400',
      email: 'font-medium text-gray-800 dark:text-gray-200',
      panel: 'overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800',
      panelHeader:
        'border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400',
      body:
        'max-h-52 space-y-3 overflow-y-auto bg-white px-3 py-3 text-[11.5px] leading-relaxed text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/40 dark:bg-gray-950 dark:text-gray-300',
      blockHeading: 'mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400',
      footnote: 'border-t border-gray-200 pt-2 text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500',
      link: 'text-primary-600 underline underline-offset-2 dark:text-primary-400',
      status: 'border-t px-3 py-1.5 text-[10px]',
      statusRead:
        'border-gray-200 bg-success-50 text-success-700 dark:border-gray-800 dark:bg-success-950/30 dark:text-success-400',
      statusUnread:
        'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400',
      clauseOn: 'border-primary-500/50 bg-primary-50 dark:bg-primary-950/30',
      clauseOff: 'border-gray-200 dark:border-gray-800',
      checkbox:
        'mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500/40 dark:border-gray-600 dark:bg-gray-950',
      clauseLabel: 'block text-[12px] text-gray-700 dark:text-gray-200',
      clauseLink: 'mt-0.5 inline-block text-[10.5px] text-primary-600 underline underline-offset-2 dark:text-primary-400',
      button:
        'w-full rounded-full bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-40',
      buttonText: 'Accept and continue',
      buttonBusy: 'Recording your acceptance…',
      disclaimer: 'text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500',
    },
  },

  terminal: {
    id: 'terminal',
    background: <BinaryRainBackground />,
    shell: {
      // The rain is dark in both themes, so the mark is pinned to light here
      // rather than following the theme.
      logoClassName: 'text-gray-100',
      cardClassName:
        'rounded-2xl border border-emerald-500/20 bg-gray-950/90 p-6 shadow-[0_0_40px_-12px_rgba(16,185,129,0.3)] backdrop-blur-sm',
      subtitleClassName: 'mt-2 font-mono text-sm text-emerald-400/80',
      footerClassName: 'mt-5 text-center font-mono text-[11px] text-gray-500',
    },
    subtitle: 'authenticate --user',
    input:
      'w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2.5 font-mono text-sm text-emerald-300 placeholder:text-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
    label: 'mb-1 block font-mono text-xs text-emerald-400/80',
    link: 'font-mono text-xs text-emerald-400/70 hover:text-emerald-300 hover:underline',
    submitClass: '!bg-emerald-600 !font-mono hover:!bg-emerald-500',
    notice: 'rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center',
    noticeText: 'font-mono text-xs text-amber-300/90',
    noticeAction:
      'mt-2 font-mono text-xs font-medium text-emerald-400 underline underline-offset-2 hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-gray-600 disabled:no-underline',
    footerText: 'text-center font-mono text-sm text-gray-500',
    footerLink: 'font-medium text-emerald-400 hover:underline',
    copy: {
      email: '$ email',
      password: '$ password',
      forgot: 'forgot?',
      submit: 'run login()',
      submitting: 'authenticating…',
      consentSubtitle: 'consent --review',
      unconfirmed: '> this account is not confirmed yet',
      linkSent: '> confirmation link sent — check inbox and spam',
      resend: 'resend confirmation email',
      resendAgain: 'send another link',
      resending: 'sending…',
      newHere: 'new here?',
      create: 'create_account()',
    },
    consent: {
      heading: 'font-mono text-xs text-emerald-400/80',
      headingText: '> consent --required',
      lead: 'mt-1 font-mono text-xs leading-relaxed text-gray-400',
      email: 'text-emerald-300',
      panel: 'overflow-hidden rounded-lg border border-emerald-500/20',
      panelHeader:
        'border-b border-emerald-500/20 bg-black/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-emerald-400/70',
      body:
        'max-h-52 space-y-3 overflow-y-auto bg-black/20 px-3 py-3 text-[11.5px] leading-relaxed text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40',
      blockHeading: 'mb-1 font-mono text-[10px] uppercase tracking-wide text-emerald-400/80',
      footnote: 'border-t border-emerald-500/15 pt-2 text-[11px] text-gray-400',
      link: 'text-emerald-400 underline underline-offset-2',
      status: 'border-t border-emerald-500/20 px-3 py-1.5 font-mono text-[10px]',
      statusRead: 'bg-emerald-500/10 text-emerald-300',
      statusUnread: 'bg-black/40 text-gray-500',
      clauseOn: 'border-emerald-500/40 bg-emerald-500/5',
      clauseOff: 'border-gray-700',
      checkbox:
        'mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-600 bg-black/40 text-emerald-500 focus:ring-emerald-500/40',
      clauseLabel: 'block text-[12px] text-gray-200',
      clauseLink: 'mt-0.5 inline-block font-mono text-[10.5px] text-emerald-400/80 underline underline-offset-2',
      button:
        'w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 font-mono text-sm text-emerald-300 transition-colors hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40',
      buttonText: 'accept() && continue',
      buttonBusy: 'recording acceptance…',
      disclaimer: 'font-mono text-[10.5px] leading-relaxed text-gray-500',
    },
  },
};

/** The stored preference, falling back to the professional skin. */
export function readSkin() {
  try {
    const saved = localStorage.getItem(SKIN_STORAGE_KEY);
    return saved && SKINS[saved] ? saved : DEFAULT_SKIN;
  } catch {
    // Private-mode Safari throws on localStorage access rather than returning
    // null. A theme preference is not worth a blank screen.
    return DEFAULT_SKIN;
  }
}

export function writeSkin(id) {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, id);
  } catch {
    /* preference simply does not persist */
  }
}
