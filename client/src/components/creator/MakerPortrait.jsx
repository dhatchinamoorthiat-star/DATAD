import { useState } from 'react';
import { IDENTITY, CREATOR } from './creatorTokens';
import { MAKER } from '../../utils/maker';

// The one photograph on the page.
//
// Everything else here is type and vector, which is why a face is worth the
// space: it is the only material on the canvas that is not drawn, and the
// page's whole argument is that a person made this.
//
// ── Why it is not a circle ────────────────────────────────────────────────
// A circular avatar with a glow is the grammar of a social profile, and the
// version of this page that existed before opened with exactly that — 128px,
// blue-to-purple-to-pink, blurred halo. It made a claim the page then had to
// earn back. A rectangular plate with a hairline border is the grammar of a
// printed portrait, which is the register the rest of this page is written in.
//
// ── Why it is duotone ─────────────────────────────────────────────────────
// A full-colour snapshot dropped onto a near-black canvas built from two blues
// and a violet reads as a foreign object, no matter how good the photograph is.
// So the image is desaturated and tinted into the brand's own hues — and then
// resolves to its real colour on hover or keyboard focus. The person comes into
// colour when you look at them. It costs one CSS transition and it is the
// detail most likely to make someone stop scrolling.
//
// The treatment lives in index.css (`.creator-portrait*`), because it needs
// `mix-blend-mode` on a pseudo-layer and an isolated stacking context, neither
// of which belongs in a style attribute.
//
// ── Three variants, three jobs ────────────────────────────────────────────
//   hero   The record photograph. Sits at the end of the hero beside the spec
//          sheet, at roughly the scale of a photo on an identity document,
//          because that is what the spec sheet is. No caption — the six rows
//          next to it already say every word a caption would.
//   plate  The feature portrait, in the chapter where the page starts saying
//          "I". Larger, captioned, and it sticks beside the story.
//   chip   A 44px identity mark in the rail. UI, not photography.
//
// Three appearances of one face is a lot for a page this restrained, and it
// only holds together because the three are at genuinely different scales
// doing genuinely different work — the way a magazine runs a contributor
// thumbnail up front and a full portrait inside the feature. If it ever reads
// as repetition, `plate` is the one to drop: the hero and the rail are load-
// bearing, and the Origin chapter still has the convergence figure.
//
// ── The source ────────────────────────────────────────────────────────────
// The photograph lives on Cloudinary rather than in public/, which is a better
// fit than a static file for one specific reason: every frame on this page
// wants a different crop, and the CDN can cut them. The hero and the feature
// plate are 4:5; the rail chip is square. Serving one square file into a 4:5
// frame would have meant `object-fit: cover` slicing ~22% off each side of an
// already face-gravity crop.
//
// So the transform string is per-variant and the asset id is named once.
// `g_face` keeps the subject centred through each cut, `f_auto` serves WebP or
// AVIF where the browser takes it, and `q_auto` picks the quality. Retina gets
// a 2× candidate and the browser chooses; nothing here ships more bytes than
// the frame it lands in.
//
// Two things that were true of the old public/ path and are not true now, both
// in this page's favour: an external host is already how the rest of the
// product loads cover images (see the helmet config — CSP is deliberately off
// for exactly this), and public/sw.js never intercepts cross-origin requests,
// so a missing asset comes back as a real error rather than as the app shell
// with a 200 on it.
//
// ── When it cannot be fetched ─────────────────────────────────────────────
// A remote image is one network away from not being there — an offline reader,
// a blocked third-party host, a deleted asset. That must not render a broken
// image glyph on a brand page: the hero and the feature plate fall back to the
// maker's initials set in the same plate language, and the rail chip removes
// itself, because a 44px monogram beside a name that is already spelled out is
// noise where a marked plate in a 176px frame is a deliberate-looking mark.
const CLOUDINARY = 'https://res.cloudinary.com/di0xf2sin/image/upload';
const ASSET = 'v1786729267/ddd_xss5nd.png';

const cut = (transform) => `${CLOUDINARY}/${transform},f_auto,q_auto/${ASSET}`;

// [1×, 2×] per frame shape.
const SOURCES = {
  portrait: [cut('w_640,h_800,c_fill,g_face'), cut('w_1280,h_1600,c_fill,g_face')],
  square: [cut('w_176,h_176,c_fill,g_face'), cut('w_352,h_352,c_fill,g_face')],
};

// "T. A. Dhatchina Moorthi" → "TAD". The initials the product is partly named
// after, which is why they are the right fallback rather than a generic glyph.
const INITIALS = MAKER.legalName
  .split(/\s+/)
  .map((part) => part.replace(/[^A-Za-z]/g, '')[0])
  .filter(Boolean)
  .join('')
  .slice(0, 3)
  .toUpperCase();

export default function MakerPortrait({ variant = 'plate', className = '' }) {
  const [failed, setFailed] = useState(false);
  const isChip = variant === 'chip';
  const isHero = variant === 'hero';
  const [src1x, src2x] = isChip ? SOURCES.square : SOURCES.portrait;

  if (isChip && failed) return null;

  const frame = (
    <div
      className={`creator-portrait relative overflow-hidden ${
        isChip ? 'h-11 w-11 shrink-0 rounded-xl' : 'w-full rounded-2xl'
      }`}
      style={{
        border: `1px solid ${IDENTITY.inkLine}`,
        background: CREATOR.plate,
        aspectRatio: isChip ? '1 / 1' : '4 / 5',
      }}
    >
      {failed ? (
        <span
          className={`flex h-full w-full items-center justify-center font-semibold tracking-[0.14em] ${
            isHero ? 'text-[26px]' : 'text-[34px]'
          }`}
          style={{ color: IDENTITY.inkLine }}
          aria-hidden="true"
        >
          {INITIALS}
        </span>
      ) : (
        <>
          <img
            src={src1x}
            srcSet={`${src1x} 1x, ${src2x} 2x`}
            alt={`${MAKER.legalName}, who builds as ${MAKER.handle}`}
            onError={() => setFailed(true)}
            // Belt as well as braces. `onError` covers the ordinary failures
            // now that the host is cross-origin and the service worker stays
            // out of the way — but a captive portal or an interception proxy
            // can still answer a 200 with something that is not an image, and
            // that decodes to zero width instead of firing `error`. A load with
            // no pixels in it is a failure.
            onLoad={(event) => {
              if (!event.currentTarget.naturalWidth) setFailed(true);
            }}
            // The rail chip and the hero photograph are both above the fold;
            // the feature plate is most of a page down and can wait.
            loading={isChip || isHero ? 'eager' : 'lazy'}
            decoding="async"
            className="creator-portrait-img h-full w-full object-cover"
          />
          <span className="creator-portrait-tint" aria-hidden="true" />
          {!isChip && (
            // Seats the photograph in the canvas. Two layers, and both earn it:
            // a radial that pulls the edges down so a portrait shot against a
            // bright wall stops ending at a hard luminous rectangle, and a
            // bottom fade so the frame dissolves into the page instead of
            // meeting the caption's hairline at full brightness.
            //
            // This is the treatment doing the work the source photograph
            // cannot be asked to do. It holds for a light background or a dark
            // one, which matters because the image is a CDN URL that somebody
            // will eventually swap for a different shot.
            <span
              className="pointer-events-none absolute inset-0"
              style={{
                background: [
                  `linear-gradient(to top, ${IDENTITY.ink} 0%, rgba(8,11,20,0) 44%)`,
                  'radial-gradient(115% 95% at 50% 32%, rgba(8,11,20,0) 38%, rgba(8,11,20,0.66) 100%)',
                ].join(', '),
              }}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </div>
  );

  // The hero and the chip are frames, not figures: neither has a caption, so
  // neither earns a <figure>.
  if (isChip || isHero) return <div className={className}>{frame}</div>;

  return (
    <figure className={className}>
      {frame}
      <figcaption
        className="mt-3.5 flex items-baseline gap-2 border-t pt-3 text-[11.5px] leading-relaxed"
        style={{ borderColor: IDENTITY.inkLine, color: IDENTITY.muted }}
      >
        <span style={{ color: IDENTITY.paper }}>{MAKER.shortName}</span>
        <span aria-hidden="true">·</span>
        <span>
          builds as <span style={{ color: IDENTITY.blueSoft }}>{MAKER.handle}</span>
        </span>
      </figcaption>
    </figure>
  );
}
