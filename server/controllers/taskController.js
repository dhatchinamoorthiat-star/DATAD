const Task = require('../models/Task');
const { notify } = require('./notificationController');

exports.listTasks = async (req, res, next) => {
  try {
    const filter = { $or: [{ createdBy: req.user.userId }, { assignee: req.user.userId }] };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.subject) filter.subject = req.query.subject;
    const tasks = await Task.find(filter)
      .populate('createdBy', 'name')
      .populate('assignee', 'name')
      .sort({ dueDate: 1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
};

exports.createTask = async (req, res, next) => {
  try {
    const { title, type, subject, dueDate, description, assignToSelf, assignee: assigneeId } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ message: 'Title and due date are required' });
    }
    const resolvedAssignee = assignToSelf ? req.user.userId : (assigneeId || null);
    const task = await Task.create({
      title, type, subject, dueDate, description,
      assignee: resolvedAssignee,
      createdBy: req.user.userId,
    });
    // Notify assignee if different from creator
    if (resolvedAssignee && String(resolvedAssignee) !== req.user.userId) {
      notify({
        user: resolvedAssignee,
        type: 'task',
        title: `${req.user.name} assigned you a task: ${title}`,
        body: dueDate ? `Due ${new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : undefined,
        link: '/me/planner',
        actor: req.user.userId,
      }).catch(() => {});
    }
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
};

const canModify = (task, userId) =>
  task.createdBy.equals(userId) || (task.assignee && task.assignee.equals(userId));

exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!canModify(task, req.user.userId)) {
      return res.status(403).json({ message: 'Only the creator or assignee can edit this task' });
    }
    const wasNotDone = task.status !== 'done';
    const { title, type, subject, dueDate, description, status } = req.body;
    const updates = { title, type, subject, dueDate, description, status };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) task[key] = value;
    }
    await task.save();
    // Notify creator when assignee marks task done
    if (status === 'done' && wasNotDone && task.createdBy && String(task.createdBy) !== req.user.userId) {
      notify({
        user: task.createdBy,
        type: 'task',
        title: `Task completed: ${task.title}`,
        body: `${req.user.name} marked it as done`,
        link: '/me/planner',
        actor: req.user.userId,
      }).catch(() => {});
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!canModify(task, req.user.userId)) {
      return res.status(403).json({ message: 'Only the creator or assignee can delete this task' });
    }
    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};
