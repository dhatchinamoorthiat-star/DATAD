/**
 * User Data Cleanup — safe cascade deletion for account removal.
 *
 * Called by authController.deleteAccount. Deletes all user-owned data across
 * all collections, handling shared data correctly:
 *   - User-owned documents (notes, expenses, etc.) → deleted
 *   - Shared documents where user is a participant (task assignee) → unassigned
 *   - Referral credits → returned to referrer
 *
 * Collections are processed in parallel for speed. Each delete is independent,
 * so a failure on one collection does not block the others. This is the same
 * pattern as the original inline implementation, expanded to cover all models.
 *
 * Mongo does not support multi-document transactions on the free tier (Atlas
 * M0), so there is no transaction wrapping. In the worst case, a partial
 * cleanup leaves orphaned documents that a periodic sweep job can collect.
 */

const Album = require('../models/Album');
const Note = require('../models/Note');
const Task = require('../models/Task');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const Resume = require('../models/Resume');
const JournalEntry = require('../models/JournalEntry');
const Announcement = require('../models/Announcement');
const UserProfile = require('../models/UserProfile');
const StudentIdentity = require('../models/StudentIdentity');
const Notification = require('../models/Notification');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const PivotPlan = require('../models/PivotPlan');
const ProposedAction = require('../models/ProposedAction');
const HabitLog = require('../models/HabitLog');
const AiUsage = require('../models/AiUsage');
const Bookmark = require('../models/Bookmark');
const Post = require('../models/Post');
const PostReaction = require('../models/PostReaction');
const Reply = require('../models/Reply');
const CalendarEvent = require('../models/CalendarEvent');
const EventRSVP = require('../models/EventRSVP');
const PlacementOutcome = require('../models/PlacementOutcome');
const PlacementApplication = require('../models/PlacementApplication');
const SubscriptionRequest = require('../models/SubscriptionRequest');
const WeeklyReview = require('../models/WeeklyReview');
const DailyCaseSolve = require('../models/DailyCaseSolve');
const ApiKey = require('../models/ApiKey');
const SearchHistory = require('../models/SearchHistory');
const PinnedSearch = require('../models/PinnedSearch');
const Recommendation = require('../models/Recommendation');
const UserMemory = require('../models/UserMemory');
const UserModelPref = require('../models/UserModelPref');
const StarStory = require('../models/StarStory');
const Resource = require('../models/Resource');
const CompanyRead = require('../models/CompanyRead');
const Photo = require('../models/Photo');
const MarketListing = require('../models/MarketListing');
const SkillListing = require('../models/SkillListing');
const SkillRating = require('../models/SkillRating');
const Event = require('../models/Event');
const User = require('../models/User');

async function cleanupUserData(userId) {
  // ── 1. Delete user-owned documents ──────────────────────────────────
  await Promise.all([
    Album.deleteMany({ createdBy: userId }),
    Note.deleteMany({ author: userId }),
    Task.deleteMany({ createdBy: userId }),
    Expense.deleteMany({ user: userId }),
    Budget.deleteMany({ user: userId }),
    Resume.deleteMany({ user: userId }),
    JournalEntry.deleteMany({ user: userId }),
    Announcement.deleteMany({ createdBy: userId }),
    UserProfile.deleteMany({ user: userId }),
    StudentIdentity.deleteMany({ user: userId }),
    Notification.deleteMany({ user: userId }),
    Conversation.deleteMany({ user: userId }),
    ChatMessage.deleteMany({ user: userId }),
    PivotPlan.deleteMany({ user: userId }),
    ProposedAction.deleteMany({ user: userId }),
    HabitLog.deleteMany({ user: userId }),
    AiUsage.deleteMany({ user: userId }),
    Bookmark.deleteMany({ user: userId }),
    Post.deleteMany({ author: userId }),
    PostReaction.deleteMany({ user: userId }),
    Reply.deleteMany({ author: userId }),
    CalendarEvent.deleteMany({ user: userId }),
    EventRSVP.deleteMany({ user: userId }),
    PlacementOutcome.deleteMany({ user: userId }),
    PlacementApplication.deleteMany({ user: userId }),
    SubscriptionRequest.deleteMany({ user: userId }),
    WeeklyReview.deleteMany({ user: userId }),
    DailyCaseSolve.deleteMany({ user: userId }),
    ApiKey.deleteMany({ user: userId }),
    SearchHistory.deleteMany({ user: userId }),
    PinnedSearch.deleteMany({ user: userId }),
    Recommendation.deleteMany({ user: userId }),
    UserMemory.deleteMany({ user: userId }),
    UserModelPref.deleteMany({ user: userId }),
    StarStory.deleteMany({ user: userId }),
    CompanyRead.deleteMany({ user: userId }),
    MarketListing.deleteMany({ seller: userId }),
    SkillListing.deleteMany({ user: userId }),
    SkillRating.deleteMany({ rater: userId }),
    Event.deleteMany({ createdBy: userId }),
    Photo.deleteMany({ uploadedBy: userId }),
    Resource.deleteMany({ uploadedBy: userId }),
  ]);

  // ── 2. Handle shared data ───────────────────────────────────────────
  // Tasks assigned to this user: unassign, don't delete (the task belongs to the creator)
  await Task.updateMany({ assignee: userId }, { assignee: null });

  // Posts/replies liked by this user: remove from likes arrays
  await Post.updateMany({ likes: userId }, { $pull: { likes: userId } });
  await Reply.updateMany({ likes: userId }, { $pull: { likes: userId } });

  // Entertainment items liked/bookmarked
  const EntertainmentItem = require('../models/EntertainmentItem');
  await EntertainmentItem.updateMany({ likedBy: userId }, { $pull: { likedBy: userId } });
  await EntertainmentItem.updateMany({ bookmarkedBy: userId }, { $pull: { bookmarkedBy: userId } });

  // ── 3. Return referral credit if this user was invited ──────────────
  await User.updateMany({ referralUsedBy: userId }, { referralUsedBy: null });
}

async function deleteUser(userId) {
  await cleanupUserData(userId);
  await User.deleteOne({ _id: userId });
}

module.exports = { cleanupUserData, deleteUser };
