const Post = require('../models/Post');
const PostReaction = require('../models/PostReaction');
const { notify } = require('./notificationController');

exports.getFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = {};

    // ⭐ Filter by program
    const programId = req.user?.program?.id;
    if (programId) {
      filter.program = programId;
    }

    if (req.query.type) filter.type = req.query.type;

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('author', 'name avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Post.countDocuments(filter),
    ]);

    const postsWithReactions = await Promise.all(
      posts.map(async (p) => {
        const reactions = await PostReaction.find({ post: p._id });
        const counts = {};
        ['👍', '❤️', '🔥', '😂', '👏'].forEach((e) => {
          counts[e] = reactions.filter((r) => r.emoji === e).length;
        });
        const myReaction = reactions.find((r) => r.user.equals(req.user.userId));
        const myVoteIdx = p.pollOptions?.findIndex((o) => o.voters?.some((v) => v.equals(req.user.userId)));
        return { ...p.toObject(), reactionCounts: counts, myReaction: myReaction?.emoji || null, myVote: myVoteIdx >= 0 ? myVoteIdx : null };
      })
    );

    res.json({ posts: postsWithReactions, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.createPost = async (req, res, next) => {
  try {
    const { title, body, type, tags, imageUrl, pollOptions } = req.body;
    if (!body) return res.status(400).json({ message: 'Post body required' });
    const post = await Post.create({
      title: title || body.slice(0, 100),
      body,
      type: type || 'text',
      tags: tags || [],
      imageUrl,
      pollOptions: pollOptions ? pollOptions.map((t) => ({ text: t, votes: 0 })) : [],
      author: req.user.userId,
      // ⭐ Automatically scope post to user's program
      program: req.user?.program?.id || null,
    });
    await post.populate('author', 'name avatar');
    res.status(201).json(post);
  } catch (err) { next(err); }
};

exports.reactToPost = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const existing = await PostReaction.findOne({ post: req.params.id, user: req.user.userId });
    if (existing) {
      if (existing.emoji === emoji) {
        await existing.deleteOne();
        return res.json({ removed: true });
      }
      existing.emoji = emoji;
      await existing.save();
      return res.json(existing);
    }
    const reaction = await PostReaction.create({ post: req.params.id, user: req.user.userId, emoji: emoji || '👍' });
    // Notify post author (skip self-notifications)
    const post = await Post.findById(req.params.id).select('author title').lean();
    if (post && String(post.author) !== req.user.userId) {
      notify({ user: post.author, type: 'reaction', actor: req.user.userId,
        title: `Someone reacted ${emoji || '👍'} to your post`,
        body: post.title?.slice(0, 60),
        link: '/community/feed',
      }).catch(() => {});
    }
    res.status(201).json(reaction);
  } catch (err) { next(err); }
};

exports.votePoll = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.pollOptions?.length) return res.status(404).json({ message: 'Poll not found' });
    const idx = parseInt(req.params.optionIdx);
    if (idx < 0 || idx >= post.pollOptions.length) return res.status(400).json({ message: 'Invalid option' });
    const uid = req.user.userId;
    if (post.pollOptions.some((o) => o.voters?.some((v) => v.equals(uid)))) {
      return res.status(400).json({ message: 'You already voted in this poll' });
    }
    post.pollOptions[idx].votes += 1;
    post.pollOptions[idx].voters.push(uid);
    post.markModified('pollOptions');
    await post.save();
    res.json({ pollOptions: post.pollOptions, myVote: idx });
  } catch (err) { next(err); }
};
