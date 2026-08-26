/**
 * Build the source assets that `npx @capacitor/assets generate` expands into
 * every icon and splash size the two platforms want.
 *
 * Run from client/:  node scripts/generate-app-assets.js
 *
 * Everything is derived from public/brand/, so the brand mark stays the single
 * source of truth — regenerate rather than hand-editing anything in assets/.
 *
 * The one non-obvious input is the Android adaptive icon, which is not a
 * picture but two layers the launcher composites and then masks to whatever
 * shape the device uses (circle, squircle, teardrop). Two consequences:
 *
 *   1. Feeding it the finished app icon would double-round it — a rounded
 *      square with its own corners, masked again into a circle, loses the
 *      corners and reads as a dark disc with the real mark shrunk inside.
 *      So the foreground is the bare disc and the background is flat colour.
 *   2. The outer ~1/3 is reserved for parallax and mask overflow, so only the
 *      centre 66% is guaranteed visible — but @capacitor/assets already applies
 *      that inset itself when it writes ic_launcher.xml. The layers here are
 *      therefore full-bleed. Pre-shrinking them would compound with that inset
 *      and leave the disc at ~44% of the icon.
 *
 * datad-mark-1024-blue.png carries the stairs as *transparency*, not as dark
 * pixels. That is what makes this work: laid over the #080B14 background layer
 * the cutout reads as the dark stairs of the real icon, with no second asset.
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// client/package.json is "type": "module", so there is no __dirname.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRAND = '#080B14'; // theme-color; matches index.html and capacitor.config.json
const LIGHT = '#FFFFFF';

const SRC = path.join(__dirname, '..', 'public', 'brand');
const OUT = path.join(__dirname, '..', 'assets');

// The foreground is built FULL-BLEED — the disc fills the canvas — because
// @capacitor/assets writes an ic_launcher.xml that wraps both layers in
// `<inset android:inset="16.7%">`, which is itself the 66% safe zone. Applying
// the safe zone here as well would compound: 0.66 × 0.666 ≈ 0.44, a disc at
// under half the icon, adrift in a field of background colour. Verified by
// compositing the generated mipmaps with that inset — see the script's docs.
//
// 0.98 rather than 1.0 leaves a pixel of margin so the disc's antialiased edge
// is never clipped by the resize.
const DISC_FILL = 0.98;
const DISC_RATIO = 0.801; // the disc's share of the 1024 source canvas

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // iOS icon. Square, fully opaque, no rounding of our own — the OS applies
  // the squircle mask, and an alpha channel is an App Store validation error.
  await sharp(path.join(SRC, 'datad-appicon-1024.png'))
    .flatten({ background: BRAND })
    .toFile(path.join(OUT, 'icon.png'));

  // Android adaptive: foreground layer.
  const discPx = Math.round(1024 * (DISC_FILL / DISC_RATIO));
  const disc = await sharp(path.join(SRC, 'datad-mark-1024-blue.png'))
    .resize(discPx, discPx)
    .toBuffer();

  // Extracted rather than composited: the scaled disc is wider than the 1024
  // canvas, and sharp refuses to composite an input larger than its base.
  const off = Math.round((discPx - 1024) / 2);
  await sharp(disc)
    .extract({ left: off, top: off, width: 1024, height: 1024 })
    .png()
    .toFile(path.join(OUT, 'icon-foreground.png'));

  // Android adaptive: background layer. Flat by design — anything with detail
  // shifts under the launcher's parallax and draws the eye off the mark.
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: BRAND },
  })
    .png()
    .toFile(path.join(OUT, 'icon-background.png'));

  // Splashes. 2732² is the square both platforms crop from, so the mark has to
  // survive being cut to any aspect ratio — hence small and dead centre.
  const splashDisc = await sharp(path.join(SRC, 'datad-mark-1024-blue.png'))
    .resize(560, 560)
    .toBuffer();

  for (const [file, bg] of [['splash.png', LIGHT], ['splash-dark.png', BRAND]]) {
    await sharp({ create: { width: 2732, height: 2732, channels: 4, background: bg } })
      .composite([{ input: splashDisc, gravity: 'centre' }])
      .png()
      .toFile(path.join(OUT, file));
  }

  console.log('Wrote', fs.readdirSync(OUT).sort().join(', '), '\nNext: npx @capacitor/assets generate');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
