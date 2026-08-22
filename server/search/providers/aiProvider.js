const ChatMessage = require('../../models/ChatMessage');
const UserMemory = require('../../models/UserMemory');

module.exports = {
  id: 'ai',
  label: 'AI History',
  priority: 50,

  async search(query, userId) {
    const q = query.toLowerCase();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const [messages, memory] = await Promise.all([
      ChatMessage.find({
        user: userId,
        content: { $regex: escaped, $options: 'i' },
      })
        .select('role content createdAt')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      UserMemory.findOne({ user: userId })
        .select('contextSummary recentTopics strengths weaknesses')
        .lean(),
    ]);

    const results = [];

    for (const m of messages) {
      const content = (m.content || '').toLowerCase();
      if (content.includes(q)) {
        results.push({
          id: `chat-${m._id}`,
          title: m.role === 'assistant' ? 'Dax response' : 'Your message',
          subtitle: `Dax conversation · ${m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ''}`,
          description: (m.content || '').slice(0, 200),
          url: null,
          icon: m.role === 'assistant' ? 'Sparkles' : 'User',
          tags: ['chat', 'dax', 'conversation', m.role].filter(Boolean),
          matchType: 'content',
          action: 'open-chat',
        });
      }
    }

    if (memory) {
      for (const topic of (memory.recentTopics || [])) {
        if (topic.toLowerCase().includes(q)) {
          results.push({
            id: `mem-topic-${topic}`,
            title: topic,
            subtitle: 'Recent topic · Dax memory',
            url: null,
            icon: 'Brain',
            tags: ['memory', 'topic', 'ai'],
            matchType: 'title',
            action: 'open-chat',
          });
        }
      }
      const summary = (memory.contextSummary || '').toLowerCase();
      if (summary.includes(q)) {
        results.push({
          id: `mem-summary`,
          title: 'Dax memory summary',
          subtitle: (memory.contextSummary || '').slice(0, 100),
          url: null,
          icon: 'Brain',
          tags: ['memory', 'summary', 'ai'],
          matchType: 'content',
          action: 'open-chat',
        });
      }
      for (const s of (memory.strengths || [])) {
        if (s.toLowerCase().includes(q)) {
          results.push({
            id: `mem-strength-${s}`,
            title: s,
            subtitle: 'Identified strength · Dax memory',
            url: null,
            icon: 'Zap',
            tags: ['strength', 'memory', 'ai'],
            matchType: 'content',
            action: 'open-chat',
          });
        }
      }
      for (const w of (memory.weaknesses || [])) {
        if (w.toLowerCase().includes(q)) {
          results.push({
            id: `mem-weakness-${w}`,
            title: w,
            subtitle: 'Area to improve · Dax memory',
            url: null,
            icon: 'Target',
            tags: ['weakness', 'improvement', 'ai'],
            matchType: 'content',
            action: 'open-chat',
          });
        }
      }
    }

    return results.slice(0, 6);
  },
};
