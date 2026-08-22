# The maker's name — three registers

DATAD is built by one person who goes by two names. This document exists so
that stays an asset rather than a liability.

The short version:

> **"Digital Don" is a handle, not a title.**

A handle is professional the same way a stage name or a GitHub handle is: as an
alias attached to a real person, used where aliases belong. It stops being
professional in exactly two situations, and both were present in this codebase
before this document existed:

1. **Used as a role.** "Digital Don, Founder" reads as a title someone gave
   themselves. "Dhatchina Moorthi, who builds as Digital Don" reads as a person
   with a handle. Same information, entirely different impression.
2. **Used as claimed status.** The old Dax origin answer said *"widely
   recognized as Digital Don"*. Recognition is something other people confer;
   claiming it about yourself invites the reader to check, and they will not
   find anything. That line did far more damage to the professional read than
   the word "Don" ever did.

Neither problem is the name. Both are framing.

## Source of truth

| Side | File | Use |
|---|---|---|
| Frontend | `client/src/utils/maker.js` | `MAKER`, `makerCredit()`, `makerStudioCredit()`, `MAKER_ORIGIN_ANSWER` |
| Backend | `server/ai/maker.js` | `MAKER`, `MAKER_ORIGIN_FACT`, `MAKER_ORIGIN_ANSWER` |

Two copies for the same reason `dax.js` has two — the browser cannot read a
CommonJS module in `server/`, and prompts cannot import from `client/`. Keep
them in step. Never hardcode the maker's name in a component or a prompt.

## The three registers

**Formal — `T. A. Dhatchina Moorthi · Founder & Systems Architect`**

Legal pages, footers, and anything an institution, recruiter, investor, or
university partner reads. The full legal name, a real job title, no handle.
Already correct on the About page and `LegalLayout`.

**Studio — `D² Labs`**

Product chrome and maker marks. This is the interesting one, and it was already
in the codebase before this document — `AboutPage.jsx` quietly introduced it.

D² Labs reads as a studio to anyone formal, and it is the maker's own initials
twice over. It carries "Digital Don" without ever having to say "Don" in a room
where that word does work you did not intend. The swagger is still there; it
simply is not announcing itself in a footer.

**Community — `Digital Don`**

The creator page, social links, `digitaldoncodes@gmail.com`, and Dax's answer
when a student asks directly who built it. Always beside the real name, never
as the job title.

## Which register, where

| Surface | Register |
|---|---|
| Legal pages, privacy policy, terms | Formal |
| App footer, About page founder card | Formal |
| Product chrome, maker mark, colophon | Studio |
| Creator page, social, contact | Community |
| Dax answering "who made you?" | Community, framed by `MAKER_ORIGIN_ANSWER` |

## What Dax may not say

Dax's origin answer is generated from the constants above, so these are already
enforced — but if you write a new prompt, keep them:

- Not **"visionary"**, not **"genius"**, not **"widely recognized"**. Praise
  in the creator's own product is worth nothing to the reader and costs
  credibility. State the facts and let them carry it.
- Not **"my boss"**, **"my creator"** as an authority, or **"he is who I answer
  to"**. Dax works *with* the student. A chain-of-command line sits especially
  badly next to a handle like "Don" — it turns a playful alias into an
  organisational chart, which is the one reading to avoid.
- No self-comparison to other AI products, and no naming the model providers
  as the creator. See `DAX_NAMING.md`.

## The test

Read the sentence as if you are a recruiter opening the platform for the first
time, then again as a student in the batch. If it works for both, it ships. The
formal register is there so the first reader stays; the community register is
there so the second one connects. Trying to make one sentence do both jobs is
what produced "widely recognized as Digital Don".
