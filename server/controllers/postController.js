const Post = require('../models/Post');
const Reply = require('../models/Reply');
const User = require('../models/User');
const { notify } = require('./notificationController');
const events = require('../events/domainEvents');

async function notifyMentions(text, actorId, actorName, link) {
  const handles = [...new Set((text.match(/@(\w+)/g) || []).map((m) => m.slice(1).toLowerCase()))];
  if (!handles.length) return;
  const users = await User.find({ status: 'approved' }).select('_id name').lean();
  for (const u of users) {
    if (handles.includes(u.name.split(' ')[0].toLowerCase()) && String(u._id) !== String(actorId)) {
      notify({ user: u._id, type: 'mention', title: `${actorName} mentioned you`, body: text.slice(0, 80), link, actor: actorId }).catch(() => {});
    }
  }
}

// ── Posts ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

exports.listPosts = async (req, res, next) => {
  try {
    const { tag, q, page } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const filter = {};
    if (tag) filter.tag = tag;
    if (q) filter.$or = [
      { title: { $regex: q.trim(), $options: 'i' } },
      { body:  { $regex: q.trim(), $options: 'i' } },
    ];

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('author', 'name')
        .sort({ pinned: -1, createdAt: -1 })
        .skip((pageNum - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Post.countDocuments(filter),
    ]);

    const uid = req.user.userId;
    res.json({
      posts: posts.map((p) => ({ ...p, liked: p.likes.some((id) => String(id) === uid) })),
      hasMore: pageNum * PAGE_SIZE < total,
      page: pageNum,
    });
  } catch (err) { next(err); }
};

exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name').lean();
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const replies = await Reply.find({ post: post._id })
      .populate('author', 'name')
      .sort({ createdAt: 1 })
      .lean();
    const uid = req.user.userId;
    res.json({
      ...post,
      liked: post.likes.some((id) => String(id) === uid),
      replies: replies.map((r) => ({ ...r, liked: r.likes.some((id) => String(id) === uid) })),
    });
  } catch (err) { next(err); }
};

exports.createPost = async (req, res, next) => {
  try {
    const { title, body, tag } = req.body;
    const post = await Post.create({ title, body, tag, author: req.user.userId });
    await post.populate('author', 'name');
    notifyMentions(`${title || ''} ${body || ''}`, req.user.userId, req.user.name, '/community/feed').catch(() => {});
    res.status(201).json(post);
  } catch (err) { next(err); }
};

exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const isOwner = String(post.author) === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not allowed' });
    const { title, body, tag, pinned } = req.body;
    if (title !== undefined) post.title = title;
    if (body  !== undefined) post.body  = body;
    if (tag   !== undefined) post.tag   = tag;
    if (pinned !== undefined && isAdmin) post.pinned = pinned;
    await post.save();
    res.json(post);
  } catch (err) { next(err); }
};

exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const isOwner = String(post.author) === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not allowed' });
    await post.deleteOne();
    await Reply.deleteMany({ post: post._id });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.toggleLikePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const uid = req.user.userId;
    const idx = post.likes.findIndex((id) => String(id) === uid);
    if (idx === -1) post.likes.push(uid);
    else post.likes.splice(idx, 1);
    await post.save();
    if (idx === -1 && String(post.author) !== uid) {
      notify({ user: post.author, type: 'reaction', title: `${req.user.name} liked your post`, body: (post.title || post.body || '').slice(0, 80), link: '/community/feed', actor: uid }).catch(() => {});
      events.social.reaction(post.author, { by: req.user.name, reaction: 'liked', contentType: 'post', contentId: post._id, actorUserId: uid }).catch(() => {});
    }
    res.json({ likes: post.likes.length, liked: idx === -1 });
  } catch (err) { next(err); }
};

// ── Replies ────────────────────────────────────────────────────────────────

exports.createReply = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const uid = req.user.userId;
    const reply = await Reply.create({ post: post._id, body: req.body.body, author: uid });
    await reply.populate('author', 'name');
    await Post.findByIdAndUpdate(post._id, { $inc: { replyCount: 1 } });
    if (String(post.author) !== uid) {
      notify({ user: post.author, type: 'reaction', title: `${req.user.name} replied to your post`, body: req.body.body.slice(0, 80), link: '/community/feed', actor: uid }).catch(() => {});
      events.social.reply(post.author, { by: req.user.name, contentType: 'post', contentId: post._id, actorUserId: uid }).catch(() => {});
    }
    notifyMentions(req.body.body, uid, req.user.name, '/community/feed').catch(() => {});
    res.status(201).json(reply);
  } catch (err) { next(err); }
};

exports.deleteReply = async (req, res, next) => {
  try {
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Reply not found' });
    const isOwner = String(reply.author) === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not allowed' });
    await reply.deleteOne();
    await Post.findByIdAndUpdate(reply.post, { $inc: { replyCount: -1 } });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.toggleLikeReply = async (req, res, next) => {
  try {
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) return res.status(404).json({ message: 'Reply not found' });
    const uid = req.user.userId;
    const idx = reply.likes.findIndex((id) => String(id) === uid);
    if (idx === -1) reply.likes.push(uid);
    else reply.likes.splice(idx, 1);
    await reply.save();
    if (idx === -1 && String(reply.author) !== uid) {
      notify({ user: reply.author, type: 'reaction', title: `${req.user.name} liked your reply`, body: reply.body.slice(0, 80), link: '/community/feed', actor: uid }).catch(() => {});
      events.social.reaction(reply.author, { by: req.user.name, reaction: 'liked', contentType: 'reply', contentId: reply._id, actorUserId: uid }).catch(() => {});
    }
    res.json({ likes: reply.likes.length, liked: idx === -1 });
  } catch (err) { next(err); }
};
