/**
 * The gate between AI output and a mass email.
 *
 * `ai/untrusted.js` reduces the chance the model is manipulated. This assumes
 * it happened anyway.
 *
 * That assumption is not pessimism, it is the lesson of the H4 reproduction: a
 * prompt-injected post title produced a newsletter whose entire body was
 * "PWNED-NEWSLETTER-5150 — All students must reset their password at
 * http://phish.example/reset immediately", and every layer between that string
 * and the outbox waved it through, because no layer was looking. Delivery went
 * out over a verified Brevo sender, so SPF and DKIM passed and the mail arrived
 * brand-authenticated.
 *
 * So this checks the artefact rather than the process. Three families:
 *
 *   shape     the fields exist, are strings, and are newsletter-sized. A body
 *             ten times longer than any newsletter is not a newsletter.
 *   markup    no HTML, no javascript:, no data: — the mail template escapes
 *             now, but a validator that only works when the layer below it is
 *             correct is not a second layer.
 *   intent    no off-domain links, and no credential-harvesting language.
 *
 * The intent family is the one that catches an attack the other two miss, and
 * it is deliberately blunt. A weekly digest of campus discussions has no reason
 * to tell anyone to reset a password or verify an account, so a false positive
 * costs an admin one click on a draft that was going to need review anyway. A
 * false negative costs every student an inbox phish from a verified sender.
 * The asymmetry is not close.
 */

const { primaryClientUrl } = require('../../utils/clientUrl');

/** Newsletter-shaped bounds. Generous; they exist to catch absurdity. */
const FIELD_LIMITS = {
  subject: 140,
  preheader: 200,
  headline: 200,
  intro: 1200,
  closingNote: 400,
  section: 2000,
};

const MAX_SECTIONS = 12;

const MARKUP_PATTERNS = [
  { re: /<\s*script/i, label: 'script tag' },
  { re: /<\s*(?:iframe|object|embed|form|input|style|meta|link|svg)\b/i, label: 'active HTML element' },
  { re: /<\s*a\b[^>]*href/i, label: 'anchor tag' },
  { re: /javascript\s*:/i, label: 'javascript: URI' },
  { re: /data\s*:\s*text\/html/i, label: 'data: HTML URI' },
  { re: /\bon(?:error|load|click|mouseover)\s*=/i, label: 'inline event handler' },
];

/**
 * Language a legitimate weekly digest never uses, and a phish always does.
 *
 * Split by what the phrase is actually asking the reader to do, because that is
 * what an admin reading the violation report needs to know.
 */
const INTENT_PATTERNS = [
  { re: /\breset (?:your |the )?password\b/i, label: 'password reset instruction' },
  { re: /\bchange (?:your )?password (?:immediately|now|urgently)\b/i, label: 'urgent password change' },
  { re: /\bverify (?:your )?(?:account|identity|email|login|credentials)\b/i, label: 'account verification demand' },
  { re: /\bconfirm (?:your )?(?:password|payment|card|bank|billing|identity)\b/i, label: 'credential confirmation demand' },
  { re: /\b(?:account|access) (?:will be |is )?(?:suspended|deactivated|terminated|locked)\b/i, label: 'account suspension threat' },
  { re: /\b(?:enter|provide|submit|share|send)(?: us| me)? your\b[^.]{0,40}\b(?:password|otp|pin|cvv|card|credentials|token|api key)\b/i, label: 'credential harvesting' },
  { re: /\bone[- ]?time (?:password|code|pin)\b|\bOTP\b/i, label: 'OTP language' },
  { re: /\b(?:wire|transfer|send) (?:money|funds|payment)\b/i, label: 'payment instruction' },
  { re: /\b(?:click|tap) here\b[^.]{0,30}\b(?:log ?in|sign ?in|verify|reset|confirm|secure)\b/i, label: 'urgent action link language' },
  { re: /\b(?:log|sign) ?in (?:immediately|now|urgently|within \d+)\b/i, label: 'urgent sign-in demand' },
  { re: /\bsecurity (?:alert|notice|warning)\b/i, label: 'security-notice framing' },
];

/** Matches a bare or schemed URL, plus the naked-domain form phishes prefer. */
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+|\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|edu|in|xyz|top|ru|info|link|click|site|online|app|dev)\b(?:\/[^\s<>"')\]]*)?/gi;

/**
 * Hosts a newsletter is allowed to link to.
 *
 * Only our own, by default. A weekly digest linking anywhere else is either a
 * hallucinated citation or an injected payload, and neither is worth the risk
 * of guessing which. `NEWSLETTER_ALLOWED_LINK_HOSTS` widens it deliberately
 * rather than accidentally.
 */
function allowedHosts() {
  const hosts = new Set();
  try {
    const client = primaryClientUrl();
    if (client) hosts.add(new URL(client).hostname.toLowerCase().replace(/^www\./, ''));
  } catch {
    /* no client url configured — the allowlist is simply empty */
  }
  for (const h of String(process.env.NEWSLETTER_ALLOWED_LINK_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)) {
    hosts.add(h.replace(/^www\./, ''));
  }
  return hosts;
}

function hostOf(match) {
  const withScheme = /^https?:\/\//i.test(match) ? match : `http://${match}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Every text field of a newsletter, flattened to [path, value] pairs. */
function textFields(result) {
  const fields = [];
  for (const key of ['subject', 'preheader', 'headline', 'intro', 'closingNote']) {
    if (result?.[key] != null) fields.push([key, String(result[key])]);
  }
  const sections = result?.sections;
  if (sections && typeof sections === 'object' && !Array.isArray(sections)) {
    for (const [k, v] of Object.entries(sections).slice(0, MAX_SECTIONS)) {
      if (v != null) fields.push([`sections.${k}`, String(v)]);
    }
  }
  return fields;
}

/**
 * Inspect a generated newsletter.
 *
 * Never throws and never mutates its input: a validator that can fail is a new
 * way for the pipeline to break open.
 *
 * @param {object} result  the parsed model output
 * @returns {{ok: boolean, violations: Array<{field: string, rule: string, detail: string}>}}
 */
function validateNewsletter(result) {
  const violations = [];
  const add = (field, rule, detail) => violations.push({ field, rule, detail });

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    add('$root', 'shape', 'newsletter is not an object');
    return { ok: false, violations };
  }

  // ── shape ───────────────────────────────────────────────────────────────
  if (!String(result.subject || '').trim()) add('subject', 'shape', 'missing subject');
  if (!String(result.intro || '').trim()) add('intro', 'shape', 'missing intro');

  if (result.sections != null && (typeof result.sections !== 'object' || Array.isArray(result.sections))) {
    add('sections', 'shape', 'sections is not an object');
  } else if (result.sections && Object.keys(result.sections).length > MAX_SECTIONS) {
    add('sections', 'shape', `${Object.keys(result.sections).length} sections exceeds ${MAX_SECTIONS}`);
  }

  const fields = textFields(result);
  const hosts = allowedHosts();

  for (const [path, value] of fields) {
    const limit = path.startsWith('sections.') ? FIELD_LIMITS.section : FIELD_LIMITS[path];
    if (limit && value.length > limit) {
      add(path, 'shape', `${value.length} chars exceeds ${limit}`);
    }

    // ── markup ────────────────────────────────────────────────────────────
    for (const { re, label } of MARKUP_PATTERNS) {
      if (re.test(value)) add(path, 'markup', label);
    }

    // ── intent ────────────────────────────────────────────────────────────
    for (const { re, label } of INTENT_PATTERNS) {
      if (re.test(value)) add(path, 'intent', label);
    }

    // ── links ─────────────────────────────────────────────────────────────
    for (const match of value.match(URL_PATTERN) || []) {
      const host = hostOf(match);
      if (!host) {
        add(path, 'link', `unparseable link: ${match.slice(0, 80)}`);
      } else if (!hosts.has(host)) {
        add(path, 'link', `link to non-allowlisted host: ${host}`);
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

/** One-line summary for a log entry or an admin-facing notification. */
function summarize(violations) {
  if (!violations?.length) return 'no violations';
  return violations
    .slice(0, 6)
    .map((v) => `${v.field}: ${v.rule} (${v.detail})`)
    .join('; ');
}

module.exports = {
  validateNewsletter,
  summarize,
  allowedHosts,
  FIELD_LIMITS,
  INTENT_PATTERNS,
  MARKUP_PATTERNS,
};
