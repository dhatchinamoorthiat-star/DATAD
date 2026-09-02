const Company = require('../../models/Company');
const Resume = require('../../models/Resume');

module.exports = {
  id: 'career',
  label: 'Career',
  priority: 80,

  async search(query, userId) {
    const q = query.toLowerCase();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const [companies, resume] = await Promise.all([
      Company.find({
        $or: [
          { name: { $regex: escaped, $options: 'i' } },
          { industry: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
        ],
      })
        .select('name industry slug description')
        .limit(10)
        .lean(),
      Resume.findOne({ user: userId })
        .select('personal.fullName summary skills certifications')
        .lean(),
    ]);

    const results = [];

    for (const c of companies) {
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const industryMatch = (c.industry || '').toLowerCase().includes(q);
      results.push({
        id: `company-${c._id}`,
        title: c.name,
        subtitle: c.industry || 'Company',
        description: (c.description || '').slice(0, 150),
        url: `/placement/companies/${c.slug}`,
        icon: 'Building2',
        tags: [c.industry, 'company'].filter(Boolean),
        matchType: nameMatch ? 'title' : 'tag',
      });
    }

    if (resume) {
      const skills = (resume.skills || []).filter((s) =>
        s.toLowerCase().includes(q)
      );
      for (const skill of skills) {
        results.push({
          id: `skill-${skill}`,
          title: skill,
          subtitle: `Skill on resume`,
          url: '/placement/resume',
          icon: 'Award',
          tags: ['skill', 'resume'],
          matchType: 'title',
        });
      }

      const certs = (resume.certifications || []).filter((c) =>
        (c.name || '').toLowerCase().includes(q)
      );
      for (const cert of certs) {
        results.push({
          id: `cert-${cert.name}`,
          title: cert.name,
          subtitle: `${cert.issuer || 'Certification'} · ${cert.year || ''}`,
          url: '/placement/resume',
          icon: 'Certificate',
          tags: ['certification', cert.issuer].filter(Boolean),
          matchType: 'title',
        });
      }
    }

    return results.slice(0, 8);
  },
};
