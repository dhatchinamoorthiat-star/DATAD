/**
 * Live completeness meter for the resume builder.
 *
 * Deliberately mirrors server/utils/resumeQuality.js — the server score is the
 * one that goes in the confirmation email, this one just lets the meter move
 * while the student is still typing rather than only after a round trip. Keep
 * the weights and thresholds in the two files in step.
 */

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const filled = (items) => arr(items).filter((it) => Object.values(it || {}).some((v) => str(v)));

const CHECKS = [
  { label: 'Your full name', weight: 8, met: (r) => Boolean(str(r.personal?.fullName)) },
  {
    label: 'An email and a phone number',
    weight: 10,
    met: (r) => Boolean(str(r.personal?.email) && str(r.personal?.phone)),
  },
  {
    label: 'A LinkedIn or portfolio link',
    weight: 6,
    met: (r) => Boolean(str(r.personal?.linkedin) || str(r.personal?.website)),
  },
  { label: 'A professional summary of at least 40 characters', weight: 12, met: (r) => str(r.summary).length >= 40 },
  { label: 'At least one education entry', weight: 12, met: (r) => filled(r.education).length > 0 },
  {
    label: 'At least one experience entry with a description',
    weight: 20,
    met: (r) => filled(r.experience).some((e) => str(e.role) && str(e.description)),
  },
  {
    label: 'At least two projects',
    weight: 16,
    met: (r) => filled(r.projects).filter((p) => str(p.title) && str(p.description)).length >= 2,
  },
  { label: 'At least five skills', weight: 10, met: (r) => arr(r.skills).filter(Boolean).length >= 5 },
  {
    label: 'A certification or an achievement',
    weight: 6,
    met: (r) => filled(r.certifications).length > 0 || filled(r.achievements).length > 0,
  },
];

export default function resumeCompleteness(resume = {}) {
  const missing = [];
  let earned = 0;
  let total = 0;

  for (const check of CHECKS) {
    total += check.weight;
    if (check.met(resume)) earned += check.weight;
    else missing.push(check.label);
  }

  const score = Math.round((earned / total) * 100);
  return { score, missing, ready: score >= 70 };
}
