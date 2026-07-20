const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { requireFeature, refreshTier } = require('../subscription/permissionEngine');
const { FEATURE } = require('../subscription/featureRegistry');
const DailyBriefing = require('../models/DailyBriefing');
const { getUserMemory } = require('../ai/memory');

// Specialization → priority sections for Phase 8 personalization
const SPEC_SECTIONS = {
  Finance:    ['market', 'finance', 'economy'],
  Marketing:  ['consulting', 'technology', 'placements'],
  Operations: ['operations', 'economy', 'technology'],
  HR:         ['leadership', 'placements', 'consulting'],
  Consulting: ['consulting', 'market', 'leadership', 'economy'],
};

router.get('/today', verifyToken, refreshTier, requireFeature(FEATURE.BRIEFING), async (req, res, next) => {
  try {
    const dateKey = new Date().toISOString().slice(0, 10);

    // ⭐ Filter by program
    const programId = req.user?.program?.id;
    const filter = { dateKey, status: 'published' };
    if (programId) {
      // Include both program-specific briefings and general briefings (empty programs array)
      filter.$or = [
        { programs: { $in: [programId] } },
        { programs: { $size: 0 } },
      ];
    }

    const briefing = await DailyBriefing.findOne(filter).lean();
    if (!briefing) return res.status(404).json({ message: 'No briefing for today yet' });

    // Phase 8 — surface most-relevant sections for user's specialization
    const mem = await getUserMemory(req.user.userId).catch(() => null);
    const spec = mem?.specialization;
    const prioritySections = spec ? (SPEC_SECTIONS[spec] || []) : [];

    res.json({ ...briefing, _personalization: { specialization: spec || null, prioritySections } });
  } catch (err) { next(err); }
});

router.get('/history', verifyToken, refreshTier, requireFeature(FEATURE.BRIEFING), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 7, 30);

    // ⭐ Filter by program
    const programId = req.user?.program?.id;
    const filter = { status: 'published' };
    if (programId) {
      // Include both program-specific briefings and general briefings
      filter.$or = [
        { programs: { $in: [programId] } },
        { programs: { $size: 0 } },
      ];
    }

    const briefings = await DailyBriefing.find(filter)
      .sort({ dateKey: -1 })
      .limit(limit)
      .select('dateKey headline interviewTip keyNumbers mustKnowTerm createdAt')
      .lean();
    res.json(briefings);
  } catch (err) { next(err); }
});

module.exports = router;
