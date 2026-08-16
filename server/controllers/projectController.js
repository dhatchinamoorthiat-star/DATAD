const Project = require('../models/Project');
const ProjectTask = require('../models/ProjectTask');
const User = require('../models/User');

const isMember = (project, userId) =>
  project.createdBy.equals(userId) || project.members.some((m) => m.equals(userId));

exports.listProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({
      $or: [{ createdBy: req.user.userId }, { members: req.user.userId }],
    })
      .populate('createdBy', 'name')
      .populate('members', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) { next(err); }
};

exports.createProject = async (req, res, next) => {
  try {
    const { title, description, subject, deadline } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    const project = await Project.create({
      title, description, subject, deadline,
      createdBy: req.user.userId,
      members: [],
    });
    res.status(201).json(project);
  } catch (err) { next(err); }
};

exports.getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('members', 'name avatar');
    if (!project) return res.status(404).json({ message: 'Not found' });
    if (!isMember(project, req.user.userId)) return res.status(403).json({ message: 'Not a member' });
    const tasks = await ProjectTask.find({ project: project._id })
      .populate('assignee', 'name')
      .sort({ createdAt: 1 });
    res.json({ ...project.toObject(), tasks });
  } catch (err) { next(err); }
};

const PROJECT_UPDATABLE_FIELDS = ['title', 'description', 'subject', 'deadline'];

exports.updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Not found' });
    if (!project.createdBy.equals(req.user.userId)) return res.status(403).json({ message: 'Not authorised' });
    PROJECT_UPDATABLE_FIELDS.forEach((f) => { if (req.body[f] !== undefined) project[f] = req.body[f]; });
    await project.save();
    res.json(project);
  } catch (err) { next(err); }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Not found' });
    if (!project.createdBy.equals(req.user.userId)) return res.status(403).json({ message: 'Not authorised' });
    await ProjectTask.deleteMany({ project: project._id });
    await project.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.addMember = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Not found' });
    if (!project.createdBy.equals(req.user.userId)) return res.status(403).json({ message: 'Not authorised' });
    const user = await User.findById(req.body.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!project.members.some((m) => m.equals(user._id))) {
      project.members.push(user._id);
      await project.save();
    }
    res.json(project);
  } catch (err) { next(err); }
};

exports.removeMember = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Not found' });
    if (!project.createdBy.equals(req.user.userId)) return res.status(403).json({ message: 'Not authorised' });
    project.members = project.members.filter((m) => !m.equals(req.params.userId));
    await project.save();
    res.json(project);
  } catch (err) { next(err); }
};

exports.listTasks = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isMember(project, req.user.userId)) return res.status(403).json({ message: 'Not a member' });
    const tasks = await ProjectTask.find({ project: req.params.id })
      .populate('assignee', 'name')
      .sort({ createdAt: 1 });
    res.json(tasks);
  } catch (err) { next(err); }
};

exports.createTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isMember(project, req.user.userId)) return res.status(403).json({ message: 'Not a member' });
    const { title, description, assignee, status, dueDate } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });
    const task = await ProjectTask.create({
      project: req.params.id, title, description, assignee, status, dueDate,
      createdBy: req.user.userId,
    });
    res.status(201).json(task);
  } catch (err) { next(err); }
};

const TASK_UPDATABLE_FIELDS = ['title', 'description', 'assignee', 'status', 'dueDate'];

exports.updateTask = async (req, res, next) => {
  try {
    const task = await ProjectTask.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Not found' });
    const project = await Project.findById(task.project);
    if (!project || !isMember(project, req.user.userId)) return res.status(403).json({ message: 'Not a member' });
    TASK_UPDATABLE_FIELDS.forEach((f) => { if (req.body[f] !== undefined) task[f] = req.body[f]; });
    await task.save();
    res.json(task);
  } catch (err) { next(err); }
};

// Deleting a task is a modification of its parent project, so it takes the
// same authorization as updateTask: caller must be a member of the project the
// task actually belongs to. This previously deleted by id alone, which let any
// authenticated user destroy any task in the database — and the delete is hard,
// with no audit row to recover from.
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await ProjectTask.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Not found' });

    // The task must belong to the project named in the path. Without this the
    // :id segment is decorative, and a caller could pass a project they belong
    // to alongside a taskId from someone else's project.
    if (!task.project.equals(req.params.id)) {
      return res.status(404).json({ message: 'Not found' });
    }

    const project = await Project.findById(task.project);
    if (!project || !isMember(project, req.user.userId)) {
      return res.status(403).json({ message: 'Not a member' });
    }

    await task.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
