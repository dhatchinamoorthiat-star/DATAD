/**
 * Authorization regression tests for project task deletion (P0-4).
 *
 * deleteTask previously ran `ProjectTask.findByIdAndDelete(req.params.taskId)`
 * with no ownership check at all, while every sibling handler in the same file
 * checked membership. Any authenticated student could destroy any task in the
 * database by id, permanently — the delete is hard and there is no audit row.
 *
 * The invariant these tests pin down: a task may be deleted only by someone
 * authorized to modify the project the task actually belongs to.
 *
 * Models are mocked, so this runs without a database.
 */

const mongoose = require('mongoose');
const Project = require('../models/Project');
const ProjectTask = require('../models/ProjectTask');
const controller = require('../controllers/projectController');

const oid = () => new mongoose.Types.ObjectId();

const OWNER = oid();
const MEMBER = oid();
const OUTSIDER = oid();
const ADMIN = oid();

const PROJECT_A = oid();
const PROJECT_B = oid();
const TASK_IN_A = oid();

const makeRes = () => ({
  statusCode: 200,
  body: undefined,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const makeReq = (userId, projectId, taskId, role = 'member') => ({
  user: { userId: String(userId), role },
  params: { id: String(projectId), taskId: String(taskId) },
  body: {},
});

/** A project doc shaped like Mongoose's, with the .equals() the controller uses. */
const projectDoc = (id, createdBy, members = []) => ({
  _id: id,
  createdBy: { equals: (o) => String(createdBy) === String(o) },
  members: members.map((m) => ({ equals: (o) => String(m) === String(o) })),
});

const taskDoc = (id, projectId) => ({
  _id: id,
  project: { equals: (o) => String(projectId) === String(o) },
  deleteOne: jest.fn().mockResolvedValue(undefined),
});

const deleteBy = jest.spyOn(ProjectTask, 'findByIdAndDelete');

beforeEach(() => jest.clearAllMocks());
afterAll(() => jest.restoreAllMocks());

describe('P0-4 DELETE /projects/:id/tasks/:taskId', () => {
  it('lets the project owner delete a task in their project', async () => {
    const task = taskDoc(TASK_IN_A, PROJECT_A);
    jest.spyOn(ProjectTask, 'findById').mockResolvedValue(task);
    jest.spyOn(Project, 'findById').mockResolvedValue(projectDoc(PROJECT_A, OWNER));

    const res = makeRes();
    await controller.deleteTask(makeReq(OWNER, PROJECT_A, TASK_IN_A), res, jest.fn());

    expect(task.deleteOne).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('lets a project member delete a task in that project', async () => {
    const task = taskDoc(TASK_IN_A, PROJECT_A);
    jest.spyOn(ProjectTask, 'findById').mockResolvedValue(task);
    jest.spyOn(Project, 'findById').mockResolvedValue(projectDoc(PROJECT_A, OWNER, [MEMBER]));

    const res = makeRes();
    await controller.deleteTask(makeReq(MEMBER, PROJECT_A, TASK_IN_A), res, jest.fn());

    expect(task.deleteOne).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('refuses a non-member — the original vulnerability', async () => {
    const task = taskDoc(TASK_IN_A, PROJECT_A);
    jest.spyOn(ProjectTask, 'findById').mockResolvedValue(task);
    jest.spyOn(Project, 'findById').mockResolvedValue(projectDoc(PROJECT_A, OWNER, [MEMBER]));

    const res = makeRes();
    await controller.deleteTask(makeReq(OUTSIDER, PROJECT_A, TASK_IN_A), res, jest.fn());

    expect(task.deleteOne).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('refuses a task reached through a manipulated project id', async () => {
    // Caller is a legitimate member of project B, but the task lives in A.
    const task = taskDoc(TASK_IN_A, PROJECT_A);
    jest.spyOn(ProjectTask, 'findById').mockResolvedValue(task);
    const projectLookup = jest
      .spyOn(Project, 'findById')
      .mockResolvedValue(projectDoc(PROJECT_B, OUTSIDER, [OUTSIDER]));

    const res = makeRes();
    await controller.deleteTask(makeReq(OUTSIDER, PROJECT_B, TASK_IN_A), res, jest.fn());

    expect(task.deleteOne).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    // Rejected on the project/task mismatch before any project was even loaded.
    expect(projectLookup).not.toHaveBeenCalled();
  });

  it('404s for a task that does not exist, without leaking that distinction', async () => {
    jest.spyOn(ProjectTask, 'findById').mockResolvedValue(null);

    const res = makeRes();
    await controller.deleteTask(makeReq(OWNER, PROJECT_A, oid()), res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: 'Not found' });
  });

  it('404s identically whether the task is missing or belongs elsewhere', async () => {
    jest.spyOn(Project, 'findById').mockResolvedValue(projectDoc(PROJECT_A, OWNER));

    jest.spyOn(ProjectTask, 'findById').mockResolvedValue(null);
    const missing = makeRes();
    await controller.deleteTask(makeReq(OWNER, PROJECT_A, oid()), missing, jest.fn());

    ProjectTask.findById.mockResolvedValue(taskDoc(TASK_IN_A, PROJECT_B));
    const elsewhere = makeRes();
    await controller.deleteTask(makeReq(OWNER, PROJECT_A, TASK_IN_A), elsewhere, jest.fn());

    // Same status and same body: the response does not confirm a task's existence.
    expect(missing.statusCode).toBe(elsewhere.statusCode);
    expect(missing.body).toEqual(elsewhere.body);
  });

  it('gives an admin no special power, matching this controller\'s existing policy', async () => {
    // updateProject/deleteProject here require createdBy — there is no admin
    // override anywhere in projectController, so deleteTask must not add one.
    const task = taskDoc(TASK_IN_A, PROJECT_A);
    jest.spyOn(ProjectTask, 'findById').mockResolvedValue(task);
    jest.spyOn(Project, 'findById').mockResolvedValue(projectDoc(PROJECT_A, OWNER, [MEMBER]));

    const res = makeRes();
    await controller.deleteTask(makeReq(ADMIN, PROJECT_A, TASK_IN_A, 'admin'), res, jest.fn());

    expect(task.deleteOne).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('never deletes by id alone', async () => {
    jest.spyOn(ProjectTask, 'findById').mockResolvedValue(taskDoc(TASK_IN_A, PROJECT_A));
    jest.spyOn(Project, 'findById').mockResolvedValue(projectDoc(PROJECT_A, OWNER));

    await controller.deleteTask(makeReq(OWNER, PROJECT_A, TASK_IN_A), makeRes(), jest.fn());

    // The unscoped call that was the bug must not reappear.
    expect(deleteBy).not.toHaveBeenCalled();
  });
});
