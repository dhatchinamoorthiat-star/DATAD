/**
 * Play Store *listing* graphics — the ones uploaded to the Console, as opposed
 * to the ones compiled into the binary by scripts/generate-app-assets.js.
 *
 * Run from client/:  node scripts/generate-store-assets.js
 *
 * Both outputs are flattened to full opacity on purpose. Play rejects a
 * transparent feature graphic outright, and a store icon with an alpha channel
 * renders over whatever the surrounding surface happens to be, which on the
 * dark-theme Play listing turns the icon's own dark background invisible and
 * leaves the blue disc floating.
 *
 * NOTE ON TYPE: the wordmark below renders in whatever sans the system
 * resolves, because Inter — the app's actual typeface — is loaded from Google
 * Fonts at runtime and is not installed on this machine. It is close enough to
 * pass at feature-graphic size but it is not the brand face. Install Inter and
 * re-run to get it exact, or replace the output with a designed graphic.
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRAND = '#080B14';
const ACCENT = '#4D7CFF';
const SRC = path.join(__dirname, '..', 'public', 'brand');
const OUT = path.join(__dirname, '..', 'assets', 'store');

const SANS = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // 1. Store icon — 512×512, no alpha. This is the icon shown in search results
  //    and on the listing page; it is uploaded separately from the launcher
  //    icon and is NOT taken from the binary.
  await sharp(path.join(SRC, 'datad-appicon-1024.png'))
    .resize(512, 512)
    .flatten({ background: BRAND })
    .png()
    .toFile(path.join(OUT, 'play-icon-512.png'));

  // 2. Feature graphic — 1024×500, the banner at the top of the listing.
  //    Composed rather than cropped from anything: Play also renders this
  //    behind the icon on some surfaces, so the left third is kept clear of
  //    anything that matters and the mark sits off-centre to survive that.
  const disc = await sharp(path.join(SRC, 'datad-mark-1024-blue.png'))
    .resize(200, 200)
    .toBuffer();

  const text = Buffer.from(`
    <svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
      <text x="360" y="230" font-family='${SANS}' font-size="86" font-weight="700" fill="#FFFFFF">DATAD</text>
      <text x="362" y="292" font-family='${SANS}' font-size="30" font-weight="500" fill="${ACCENT}" letter-spacing="1.5">Your entire student life, one calm place.</text>
      <text x="362" y="344" font-family='${SANS}' font-size="24" font-weight="400" fill="#8B93A7">Notes · Planner · Career · Money · Wellbeing</text>
    </svg>`);

  await sharp({ create: { width: 1024, height: 500, channels: 4, background: BRAND } })
    .composite([
      { input: disc, top: 150, left: 120 },
      { input: text, top: 0, left: 0 },
    ])
    // flatten() alone leaves a fully-opaque alpha channel behind, which still
    // reads as a 32-bit PNG to Play's validator. removeAlpha() drops it.
    .flatten({ background: BRAND })
    .removeAlpha()
    .png()
    .toFile(path.join(OUT, 'play-feature-graphic-1024x500.png'));

  console.log('Wrote', fs.readdirSync(OUT).sort().join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
