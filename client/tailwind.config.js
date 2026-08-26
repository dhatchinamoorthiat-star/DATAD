/** @type {import('tailwindcss').Config} */

// ── DATAD design tokens ──────────────────────────────────────────────
// White-dominant, light-first surface. The gray scale is shared by both
// themes so light/dark feel like the same product:
//   gray-50   #F7F8FA  secondary background (light)
//   gray-200  #E4E7EC  soft borders (light)
//   gray-900  #181C22  primary text (light) / raised surface (dark)
//   gray-950  #0B0D10  app background (dark)
// Accents carry meaning only — used as accents, never as large backgrounds:
//   primary = action / links / AI / progress   (blue)
//   success = completed / goals / productivity (green)
//   warn    = highlights / achievements        (amber — text needs 700+ for contrast)
//   danger  = deadlines / warnings / errors    (red)
//
// `primary` is DATAD's own "intelligent blue" (#4D7CFF, the Terrace brand value
// in components/common/Logo.jsx) with a ramp built around it, so the app, the
// logo and the registration canvas are finally the same blue. The three
// semantic ramps are the stock Tailwind green/amber/red (MIT). Both replace an
// earlier set that reproduced Google's four brand hexes — #4285F4 / #34A853 /
// #FBBC04 / #EA4335 — verbatim. Colour values are not themselves protectable,
// but that specific four-colour signature is Google's trade dress, and a
// student product has no reason to wear it.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#F7F8FA',
          100: '#F4F6F9',
          200: '#E4E7EC',
          300: '#C4CBD4',
          400: '#9AA4B2',
          500: '#67717F',
          600: '#4E5866',
          700: '#39404B',
          800: '#242830',
          900: '#181C22',
          950: '#0B0D10',
        },
        surface: '#13161B',
        // Brand blue. 500 is the Terrace value #4D7CFF exactly; 600 is the
        // action tone (buttons, links) and is darkened to #3563E9 so white text
        // on it clears AA, which #4D7CFF alone does not.
        primary: {
          50: '#EEF3FF',
          100: '#DCE6FF',
          200: '#BFD0FF',
          300: '#9AB4FF',
          400: '#7396FF',
          500: '#4D7CFF',
          600: '#3563E9',
          700: '#2A4EC4',
          800: '#23409C',
          900: '#1E357B',
          950: '#14224B',
        },
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
        warn: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#450A0A',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Brand wordmark only ("DATAD" in the Terrace lockup) — never body copy.
        brand: ['Syne', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
