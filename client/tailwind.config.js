/** @type {import('tailwindcss').Config} */

// ── DATAD design tokens ──────────────────────────────────────────────
// White-dominant, light-first surface. The gray scale is shared by both
// themes so light/dark feel like the same product:
//   gray-50   #F7F8FA  secondary background (light)
//   gray-200  #E4E7EC  soft borders (light)
//   gray-900  #181C22  primary text (light) / raised surface (dark)
//   gray-950  #0B0D10  app background (dark)
// Accents are Google-ecosystem inspired and carry meaning only — used as
// accents, never as large backgrounds:
//   primary = action / links / AI / progress   (blue)
//   success = completed / goals / productivity (green)
//   warn    = highlights / achievements        (yellow — text needs 700+ for contrast)
//   danger  = deadlines / warnings / errors     (red)
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
        primary: {
          50: '#E8F0FE',
          100: '#D2E3FC',
          200: '#AECBFA',
          300: '#8AB4F8',
          400: '#669DF6',
          500: '#4285F4',
          600: '#1A73E8',
          700: '#1967D2',
          800: '#185ABC',
          900: '#103D7A',
          950: '#0B2A56',
        },
        success: {
          50: '#E6F4EA',
          100: '#CEEAD6',
          200: '#A8DAB5',
          300: '#81C995',
          400: '#5BB974',
          500: '#34A853',
          600: '#1E8E3E',
          700: '#188038',
          800: '#137333',
          900: '#0D652D',
          950: '#073819',
        },
        warn: {
          50: '#FEF7E0',
          100: '#FEEFC3',
          200: '#FDE293',
          300: '#FDD663',
          400: '#FCC934',
          500: '#FBBC04',
          600: '#F9AB00',
          700: '#EA8600',
          800: '#B06000',
          900: '#7A4100',
          950: '#4D2900',
        },
        danger: {
          50: '#FCE8E6',
          100: '#FAD2CF',
          200: '#F6AEA9',
          300: '#F28B82',
          400: '#EE675C',
          500: '#EA4335',
          600: '#D93025',
          700: '#C5221F',
          800: '#A50E0E',
          900: '#7A0C0C',
          950: '#4D0808',
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
