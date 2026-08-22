// Palette for the registration ("identity") experience.
//
// These are the Terrace brand values from components/common/Logo.jsx, plus one
// violet that exists only here. The register screen is the one surface that
// runs a permanently dark canvas next to a theme-aware panel, so it needs the
// brand hexes as literals rather than as Tailwind gray/primary tokens — those
// are tuned for a white-dominant product surface and go muddy on near-black.
//
// Contrast against `ink`, measured in-page: paper 16.34:1, blueSoft 9.19:1,
// muted 7.79:1, blue 5.28:1. All four clear WCAG AA for normal text (4.5:1),
// and every one except `blue` clears AAA (7:1).
//
// `blue` is nonetheless reserved for chrome — icons, hairlines, the glow — and
// `blueSoft` carries any blue that has to be *read*. 5.28:1 is a pass, but it
// is the one value here with no headroom left, and small blue-on-black text is
// where a future palette tweak would quietly drop below the line.
export const IDENTITY = {
  ink: '#080B14',       // brand near-black — the canvas
  inkRaised: '#0E1320', // raised surface on the canvas
  inkLine: '#1C2333',   // hairline borders on the canvas
  blue: '#4D7CFF',      // brand "intelligent blue" — accents, chrome, glow
  blueSoft: '#8FB0FF',  // legible blue for small text on the canvas
  violet: '#7C6CFF',    // psychology/insight highlight, used sparingly
  paper: '#E8EAF0',     // primary text on the canvas
  muted: '#9AA4B2',     // secondary text on the canvas
};
