const Resume = require('../../models/Resume');

module.exports = {
  id: 'documents',
  label: 'Documents',
  priority: 55,

  async search(query, userId) {
    const q = query.toLowerCase();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const resume = await Resume.findOne({ user: userId })
      .select('personal.fullName summary skills experience projects achievements certifications')
      .lean();

    if (!resume) return [];

    const results = [];

    const name = (resume.personal?.fullName || '').toLowerCase();
    const summary = (resume.summary || '').toLowerCase();

    if (name.includes(q) || summary.includes(q)) {
      results.push({
        id: `doc-resume`,
        title: `${resume.personal?.fullName || 'Untitled'} — Resume`,
        subtitle: `${resume.skills?.length || 0} skills · ${resume.experience?.length || 0} experiences`,
        url: '/placement/resume',
        icon: 'FileUser',
        tags: ['resume', 'document'],
        matchType: name.includes(q) ? 'title' : 'content',
      });
    }

    const skillMatch = (resume.skills || []).filter((s) =>
      s.toLowerCase().includes(q)
    );
    for (const s of skillMatch) {
      results.push({
        id: `doc-skill-${s}`,
        title: s,
        subtitle: 'Skill listed on resume',
        url: '/placement/resume',
        icon: 'Award',
        tags: ['skill', 'resume', 'document'],
        matchType: 'title',
      });
    }

    const projectMatch = (resume.projects || []).filter((p) =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.technologies || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
    for (const p of projectMatch) {
      results.push({
        id: `doc-project-${p.title}`,
        title: p.title,
        subtitle: `${p.technologies || 'Project'} on resume`,
        url: '/placement/resume',
        icon: 'FolderGit2',
        tags: ['project', 'resume', 'document'],
        matchType: 'title',
      });
    }

    return results.slice(0, 6);
  },
};
