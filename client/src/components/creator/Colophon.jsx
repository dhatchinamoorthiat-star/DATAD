import { Link } from 'react-router-dom';
// lucide dropped its brand glyphs at v1, so the social row uses AtSign for the
// handle rather than a mismatched third-party mark.
import { ArrowRight, AtSign, Heart, Mail, Phone } from 'lucide-react';
import CopyChip from './CopyChip';
import { IDENTITY, CREATOR } from './creatorTokens';
import { MAKER, makerCredit } from '../../utils/maker';

// The end of the page, set as a colophon rather than a conversion slab.
//
// The version this replaces ended with a 5xl centred headline, two gradient
// buttons and a line of emoji. That ending asks; a colophon closes. It is the
// oldest convention in printed matter for saying who made a thing and how, and
// it is the right register for a page whose whole argument has been that one
// person made this with their hands.
//
// Register does the same thing at the bottom of its form column — terms and
// privacy in 11px grey, quiet, present, not asking. This is that footer given
// the room it deserves.
//
// The contact rows are copyable rather than `mailto:`-only: see CopyChip.
// The two actions are both offered, but only one of them is a button — the
// page has spent a thousand words on why the product is not trying to convert
// anyone, and two competing gradient CTAs would take that back in one frame.
const NAME_LETTERS = ['Discover', 'Aspire', 'Transform', 'Achieve', 'Develop'];

export default function Colophon() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <div>
        <h2
          className="text-[30px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[38px]"
          style={{ color: IDENTITY.paper }}
        >
          Built by a student.
          <br />
          <span style={{ color: IDENTITY.blueSoft }}>For students.</span>
        </h2>
        <p
          className="mt-5 max-w-[46ch] text-[15px] leading-relaxed"
          style={{ color: IDENTITY.muted }}
        >
          If you are in a batch that is running its placement season across five
          apps, this was built for you, and it is free to start. If you just want
          to talk about how it was made — that is what the address below is for.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/register"
            className="creator-focus group inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3.5 text-[13.5px] font-semibold transition-colors duration-200"
            style={{ background: IDENTITY.blue, color: '#050810' }}
          >
            Start free
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/support"
            className="creator-focus inline-flex items-center justify-center gap-2 rounded-xl border px-6 py-3.5 text-[13.5px] font-medium transition-colors duration-200 hover:border-[#4D7CFF]"
            style={{ borderColor: IDENTITY.inkLine, color: IDENTITY.paper }}
          >
            <Heart className="h-4 w-4" style={{ color: CREATOR.ember }} aria-hidden="true" />
            Support the project
          </Link>
        </div>

        {/* The name, kept to two lines. The About page owns the full reading of
            the acronym and does it far better than a repeat here could — this
            is the footnote, not the exhibit. */}
        <div className="mt-12 border-t pt-6" style={{ borderColor: IDENTITY.inkLine }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#68717F' }}>
            The name
          </p>
          <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: IDENTITY.muted }}>
            {NAME_LETTERS.map((word, i) => (
              <span key={word}>
                <span style={{ color: IDENTITY.paper }}>{word[0]}</span>
                {word.slice(1)}
                {i < NAME_LETTERS.length - 1 ? ' · ' : '. '}
              </span>
            ))}
            The middle three are also the initials in my own name, which is either a
            coincidence or the reason it stuck.{' '}
            <Link
              to="/about"
              className="creator-focus underline-offset-2 hover:underline"
              style={{ color: IDENTITY.blueSoft }}
            >
              The longer version
            </Link>
            .
          </p>
        </div>
      </div>

      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#68717F' }}>
          Reach the maker
        </p>
        <div className="mt-2 border-t" style={{ borderColor: IDENTITY.inkLine }}>
          <CopyChip
            label="Email"
            value="digitaldoncodes@gmail.com"
            href="mailto:digitaldoncodes@gmail.com"
            icon={Mail}
          />
          <CopyChip
            label="Instagram"
            value="@technerdalert"
            href="https://instagram.com/technerdalert"
            icon={AtSign}
          />
          <CopyChip
            label="Phone"
            value="+91 93636 32214"
            href="tel:+919363632214"
            icon={Phone}
          />
        </div>

        {/* Formal register, deliberately. Everything above this line has been
            the community voice; the credit line is what an institution or a
            recruiter reads, and it gets the legal name and the real title.
            See MAKER_IDENTITY.md. */}
        <div
          className="mt-10 rounded-2xl border p-6"
          style={{ borderColor: IDENTITY.inkLine, background: CREATOR.plate }}
        >
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: '#68717F' }}>
            Colophon
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: IDENTITY.paper }}>
            {makerCredit()}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: IDENTITY.muted }}>
            {MAKER.studio} — {MAKER.studioLine}
            <br />
            {MAKER.place}
          </p>
          <p className="mt-4 border-t pt-4 text-[12px] leading-relaxed" style={{ borderColor: IDENTITY.inkLine, color: '#68717F' }}>
            Designed, engineered and shipped independently — React, Express, MongoDB,
            and the pipeline behind Dax. Community-backed. No ad network, and nothing
            about you sold to one.
          </p>
        </div>
      </div>
    </div>
  );
}
