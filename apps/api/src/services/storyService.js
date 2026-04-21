/**
 * Story Service — business logic for issue ground-reality stories.
 *
 * Key rules:
 *  - Anyone logged in can post; is_anonymous masks identity from readers
 *  - Rate limit: 3 stories per issue per user per 24 h (prevent flooding)
 *  - Helpful votes are deduplicated per user per story
 *  - Story author or admin can remove
 *  - Cache invalidation: feed cache is cleared on new story (story_count changed)
 */
import * as StoryModel from '../models/story.js';
import { invalidateFeedCache } from './feedService.js';
import pool from '../db/postgres.js';

class StoryError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const MAX_CONTENT_LENGTH = 1000;
const STORIES_PER_ISSUE_PER_DAY = 3;

/**
 * Create a new story.
 */
export async function createStory(issueId, userId, { content, isAnonymous = false, photos = [] }) {
  if (!content?.trim()) {
    throw new StoryError(400, 'EMPTY_CONTENT', 'Story content cannot be empty');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new StoryError(
      400,
      'CONTENT_TOO_LONG',
      `Story must be under ${MAX_CONTENT_LENGTH} characters`,
    );
  }

  // One anonymous story per user per issue
  if (isAnonymous) {
    const { rows: anonCheck } = await pool.query(
      `SELECT 1 FROM issue_stories
       WHERE issue_id = $1 AND author_id = $2 AND is_anonymous = true AND status != 'removed'
       LIMIT 1`,
      [issueId, userId],
    );
    if (anonCheck.length > 0) {
      throw new StoryError(409, 'ANON_LIMIT', 'You can only post one anonymous story per issue');
    }
  }

  // Rate limit check
  const { rows: recent } = await pool.query(
    `SELECT COUNT(*) FROM issue_stories
     WHERE issue_id = $1 AND author_id = $2
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [issueId, userId],
  );
  if (parseInt(recent[0].count, 10) >= STORIES_PER_ISSUE_PER_DAY) {
    throw new StoryError(
      429,
      'RATE_LIMIT',
      `You can post at most ${STORIES_PER_ISSUE_PER_DAY} stories on the same issue per day`,
    );
  }

  // Verify issue exists
  const { rows: issueRows } = await pool.query(
    `SELECT id FROM issues WHERE id = $1 AND status != 'closed'`,
    [issueId],
  );
  if (!issueRows.length) {
    throw new StoryError(404, 'ISSUE_NOT_FOUND', 'Issue not found or is closed');
  }

  const story = await StoryModel.create({
    issueId,
    authorId: userId,
    isAnonymous,
    content: content.trim(),
    photos: (photos || []).slice(0, 3),
  });

  return story;
}

/**
 * Get paginated stories for an issue.
 * Attaches `userVotedHelpful` if userId is provided.
 */
export async function getStories(issueId, { page = 1, limit = 20 } = {}, userId = null) {
  const result = await StoryModel.findByIssue(issueId, { page, limit });

  if (userId && result.data.length > 0) {
    const ids = result.data.map((s) => s.id);
    const voted = await StoryModel.getUserHelpfulVotes(userId, ids);
    result.data = result.data.map((s) => ({
      ...s,
      userVotedHelpful: voted.has(s.id),
    }));
  }

  return result;
}

/**
 * Toggle helpful vote on a story.
 */
export async function toggleHelpful(storyId, userId) {
  const story = await StoryModel.findById(storyId);
  if (!story || story.status !== 'active') {
    throw new StoryError(404, 'STORY_NOT_FOUND', 'Story not found');
  }
  return StoryModel.toggleHelpful(storyId, userId);
}

/**
 * Remove a story (author or admin only).
 */
export async function removeStory(storyId, requesterId, requesterRole) {
  const meta = await StoryModel.getIssueId(storyId);
  if (!meta) {
    throw new StoryError(404, 'STORY_NOT_FOUND', 'Story not found');
  }
  if (requesterRole !== 'admin' && meta.authorId !== requesterId) {
    throw new StoryError(403, 'FORBIDDEN', 'You can only remove your own stories');
  }
  await StoryModel.remove(storyId, meta.issueId);
  return { success: true };
}
