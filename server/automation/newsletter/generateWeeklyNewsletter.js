/**
 * Weekly newsletter generation.
 *
 * This job used to end with the line `// Auto-send to all approved members`,
 * and it meant it: model output went straight into `sendAnnouncementEmail` for
 * every approved user, over a verified Brevo sender, with no human between the
 * generation and the outbox. The Phase 2 test used one prompt-injected post
 * title to rewrite that email into a password-reset phish carrying an attacker
 * URL, and nothing stopped it.
 *
 * It now generates and stops. Four independent things have to hold before any
 * student receives this mail, and no two of them share a failure mode:
 *
 *   1. Student text enters the prompt as delimited, JSON-encoded, single-line
 *      data with a standing rule that it is never instruction (ai/untrusted).
 *   2. A model refusal ends the request instead of failing over to a provider
 *      that complies (ai/refusal, wired into ai/runner).
 *   3. The generated artefact is inspected for off-domain links, markup, and
 *      credential-harvesting language (./newsletterGuard). A failure quarantines
 *      the draft as `blocked` — it cannot be approved, only regenerated.
 *   4. An admin reads the draft and approves it (newsletterController.sendDraft).
 *
 * Layers 1 and 2 reduce the chance of a poisoned draft. Layers 3 and 4 assume
 * one exists anyway. That is the important distinction: a defence that depends
 * on a model behaving is not a defence, and the H4 reproduction proved it by
 * walking past a provider that behaved correctly.
 */

const { run } = require('../../ai/runner');
const PROMPTS = require('../../ai/prompts');
const { runJob } = require('../jobRunner');
const NewsletterDraft = require('../../models/NewsletterDraft');
const Post = require('../../models/Post');
const Company = require('../../models/Company');
const DailyBriefing = require('../../models/DailyBriefing');
const User = require('../../models/User');
const { notifyBulk } = require('../../controllers/notificationController');
const { untrustedBlock } = require('../../ai/untrusted');
const { isRefusal } = require('../../ai/refusal');
const { validateNewsletter, summarize } = require('./newsletterGuard');
const logger = require('../../utils/logger');

function getMondayKey() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d.toISOString().slice(0, 10);
}

/**
 * The three most-liked posts of the week.
 *
 * The previous query was `.sort({ 'likes.length': -1 })`, which MongoDB cannot
 * evaluate — a dotted path does not reach an array's length — so it silently
 * degraded to natural order. Verified in the Phase 2 run: a zero-like post came
 * back first, ahead of one with five. That is a product bug on its own (the
 * "top discussions" were arbitrary), and it made H4 cheap to exploit, because
 * an attacker needed no engagement at all to place a post in the selection.
 *
 * Real ranking does not make injection impossible; it makes it cost something.
 */
async function topPostsOfWeek(since) {
  return Post.aggregate([
    { $match: { createdAt: { $gte: since }, hidden: { $ne: true } } },
    { $addFields: { likeCount: { $size: { $ifNull: ['$likes', []] } } } },
    { $sort: { likeCount: -1, createdAt: -1 } },
    { $limit: 3 },
    { $project: { _id: 0, title: 1, tag: 1, likeCount: 1 } },
  ]);
}

async function generateWeeklyNewsletter() {
  return runJob('weekly-newsletter-generation', async () => {
    const weekStart = getMondayKey();

    const existing = await NewsletterDraft.findOne({ weekStart });
    if (existing?.status === 'sent') {
      logger.info('[newsletter] already sent for this week', { weekStart });
      return { itemsProcessed: 0, meta: { skipped: true } };
    }

    // Gather data from the past 7 days
    const since = new Date(weekStart);

    const [topPosts, topCompanies, recentBriefings] = await Promise.all([
      topPostsOfWeek(since),
      Company.find().sort({ views: -1 }).limit(3).select('name sector').lean(),
      DailyBriefing.find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 }).limit(3).select('headline sections.economy sections.placements').lean(),
    ]);

    // Post titles are student-authored. Everything else here is either
    // system-generated or admin-curated, but it costs nothing to treat the
    // company names the same way and it removes a question from the next
    // person reading this.
    const topDiscussions = topPosts.length
      ? untrustedBlock('topDiscussions', topPosts.map((p) => ({ tag: p.tag, title: p.title })))
      : 'No discussions this week';
    const topCompaniesTxt = topCompanies.length
      ? untrustedBlock('topCompanies', topCompanies.map((c) => ({ name: c.name, sector: c.sector })))
      : 'No data';
    const briefingSummary = recentBriefings.map((b) => b.headline).join('\n') || 'No briefings generated';

    const prompt = PROMPTS.weeklyNewsletter({ weekStart, topDiscussions, topCompanies: topCompaniesTxt, briefingSummary });

    let result;
    let meta;
    try {
      ({ result, meta } = await run({ system: prompt.system, user: prompt.user, json: true }));
    } catch (err) {
      // A refusal is a signal, not an outage. Something about this week's input
      // made a model decline, and on this path that is far more likely to mean
      // "a post is trying to write your email" than "the provider is broken".
      // It gets its own status so it is visible in the admin view instead of
      // being buried among transport failures.
      if (isRefusal(err)) {
        logger.warn('[newsletter] a provider declined to generate this week — not retried elsewhere', {
          weekStart,
          provider: err.provider,
          outcome: err.outcome,
          excerpt: err.excerpt,
        });
        await NewsletterDraft.findOneAndUpdate(
          { weekStart },
          { weekStart, subject: `Newsletter refused (${weekStart})`, status: 'refused', guardNotes: err.excerpt },
          { upsert: true }
        );
        return { itemsProcessed: 0, meta: { refused: true, provider: err.provider } };
      }
      throw err;
    }

    // ── The gate ────────────────────────────────────────────────────────────
    const verdict = validateNewsletter(result);

    const draft = await NewsletterDraft.findOneAndUpdate(
      { weekStart },
      {
        weekStart,
        subject: result.subject,
        preheader: result.preheader,
        headline: result.headline,
        intro: result.intro,
        sections: result.sections,
        closingNote: result.closingNote,
        generatedBy: meta.provider,
        model: meta.model,
        tokensUsed: meta.tokensUsed,
        // `blocked` is terminal for this draft. sendDraft() refuses to mail
        // anything that is not `draft`, so a quarantined newsletter cannot be
        // released by an admin clicking approve on a busy morning — it has to
        // be regenerated. An approval button that can override the content
        // filter is the content filter.
        status: verdict.ok ? 'draft' : 'blocked',
        guardNotes: verdict.ok ? undefined : summarize(verdict.violations),
        // Cleared on regeneration so a previously-sent week does not carry a
        // stale timestamp into an unsent draft.
        sentAt: undefined,
        recipientCount: 0,
      },
      { upsert: true, new: true }
    );

    if (!verdict.ok) {
      logger.error('[newsletter] generated draft failed content validation and was quarantined', {
        weekStart,
        draftId: String(draft._id),
        violations: verdict.violations,
      });
      return {
        provider: meta.provider,
        model: meta.model,
        tokensUsed: meta.tokensUsed,
        itemsProcessed: 0,
        meta: { blocked: true, violations: verdict.violations },
      };
    }

    // ── Awaiting a human ────────────────────────────────────────────────────
    //
    // Nothing is mailed here. Admins are told a draft is ready; sending happens
    // in newsletterController.sendDraft, behind an explicit approval.
    const admins = await User.find({ role: 'admin', status: 'approved' }).select('_id').lean();
    if (admins.length) {
      notifyBulk(
        admins.map((a) => a._id),
        {
          type: 'announcement',
          title: `Newsletter draft ready for review: ${result.subject}`,
          body: 'Read it, then approve to send. Nothing goes out until you do.',
          link: '/admin/newsletter',
        }
      ).catch(() => {});
    }

    logger.info('[newsletter] draft generated and awaiting admin approval', {
      weekStart,
      draftId: String(draft._id),
      provider: meta.provider,
    });

    return {
      provider: meta.provider,
      model: meta.model,
      tokensUsed: meta.tokensUsed,
      itemsProcessed: 1,
      meta: { status: 'draft', awaitingApproval: true },
    };
  });
}

module.exports = { generateWeeklyNewsletter, topPostsOfWeek };
