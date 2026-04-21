/**
 * Official Service — business logic layer.
 * Routes call this; this calls OfficialModel.
 * No raw SQL here. ServiceError for all business-rule failures.
 */

import * as OfficialModel from '../models/official.js';
import * as IssueModel from '../models/issue.js';
import { ServiceError } from './userService.js';

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Create a new official. Moderator-only in Phase 1.
 * Phase 2 will populate officials from DoPT data scraping.
 */
export async function createOfficial(data, userRole) {
  if (userRole !== 'admin' && userRole !== 'moderator') {
    throw new ServiceError(403, 'FORBIDDEN', 'Only moderators can create officials');
  }

  if (!data.name?.trim()) {
    throw new ServiceError(400, 'INVALID_NAME', 'Official name is required');
  }
  if (!data.designation?.trim()) {
    throw new ServiceError(400, 'INVALID_DESIGNATION', 'Designation is required');
  }

  return OfficialModel.create({
    name: data.name.trim(),
    designation: data.designation.trim(),
    departmentId: data.department_id || null,
    ministryId: data.ministry_id || null,
    jurisdictionType: data.jurisdiction_type || null,
    jurisdictionCode: data.jurisdiction_code || null,
    stateCode: data.state_code || null,
    districtCode: data.district_code || null,
    publicEmail: data.public_email || null,
    publicPhone: data.public_phone || null,
    officeAddress: data.office_address || null,
    twitterHandle: data.twitter_handle || null,
    cadre: data.cadre || null,
    batchYear: data.batch_year || null,
    source: data.source || 'manual',
    isVerified: data.is_verified || false,
  });
}

/**
 * Get an official by ID with stats.
 */
export async function getOfficial(id) {
  const official = await OfficialModel.findById(id);
  if (!official) throw new ServiceError(404, 'OFFICIAL_NOT_FOUND', 'Official not found');
  return official;
}

/**
 * Fuzzy search officials by name/designation, optionally scoped to jurisdiction.
 *
 * @param {string} query          — search text
 * @param {{ stateCode, districtCode }} jurisdiction
 * @param {number} limit
 */
export async function searchOfficials(query, jurisdiction = {}, limit = 20) {
  if (!query || query.trim().length < 2) {
    throw new ServiceError(400, 'QUERY_TOO_SHORT', 'Search query must be at least 2 characters');
  }
  return OfficialModel.search(query.trim(), { ...jurisdiction, limit });
}

/**
 * List officials with optional filters and pagination.
 */
export async function listOfficials(filters, pagination) {
  return OfficialModel.findAll(filters, pagination);
}

// ── Issue-Official tagging ─────────────────────────────────────────────────────

/**
 * Tag an official to an issue.
 * Only the issue creator (or admin) can tag.
 * Increments the official's total_issues_tagged counter.
 */
export async function tagOfficialToIssue(
  issueId,
  officialId,
  userId,
  userRole,
  tagType = 'primary',
) {
  const issue = await IssueModel.findById(issueId);
  if (!issue) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

  if (issue.createdBy !== userId && userRole !== 'admin' && userRole !== 'moderator') {
    throw new ServiceError(403, 'FORBIDDEN', 'Only the issue creator can tag officials');
  }

  if (issue.status === 'closed') {
    throw new ServiceError(400, 'ISSUE_CLOSED', 'Cannot tag officials on a closed issue');
  }

  const official = await OfficialModel.findById(officialId);
  if (!official) throw new ServiceError(404, 'OFFICIAL_NOT_FOUND', 'Official not found');

  const result = await OfficialModel.tagToIssue(issueId, officialId, userId, tagType);
  if (result === null) {
    throw new ServiceError(409, 'ALREADY_TAGGED', 'This official is already tagged on this issue');
  }

  // Increment counter — fire-and-forget
  OfficialModel.incrementTaggedCount(officialId).catch(() => {});

  return result;
}

/**
 * Untag an official from an issue.
 * Only the issue creator or admin.
 */
export async function untagOfficial(issueId, officialId, userId, userRole) {
  const issue = await IssueModel.findById(issueId);
  if (!issue) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

  if (issue.createdBy !== userId && userRole !== 'admin' && userRole !== 'moderator') {
    throw new ServiceError(403, 'FORBIDDEN', 'Only the issue creator can untag officials');
  }

  const removed = await OfficialModel.untagFromIssue(issueId, officialId);
  if (!removed) {
    throw new ServiceError(404, 'NOT_TAGGED', 'This official is not tagged on this issue');
  }

  // Decrement counter — fire-and-forget
  OfficialModel.incrementTaggedCount(officialId, -1).catch(() => {});

  return { untagged: true };
}

/**
 * Get all officials tagged on an issue.
 */
export async function getOfficialsForIssue(issueId) {
  const issue = await IssueModel.findById(issueId);
  if (!issue) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  return OfficialModel.getOfficialsForIssue(issueId);
}

/**
 * Claim an official account (Phase 3 scaffold).
 * In Phase 3 this will require identity verification via Aadhaar.
 * For now: any authenticated user can claim an unclaimed profile.
 */
export async function claimOfficialAccount(officialId, userId) {
  const official = await OfficialModel.findById(officialId);
  if (!official) throw new ServiceError(404, 'OFFICIAL_NOT_FOUND', 'Official not found');

  if (official.claimedByUserId) {
    throw new ServiceError(
      409,
      'ALREADY_CLAIMED',
      'This official profile has already been claimed',
    );
  }

  const result = await OfficialModel.claimProfile(officialId, userId);
  if (!result) {
    throw new ServiceError(
      409,
      'ALREADY_CLAIMED',
      'This official profile has already been claimed',
    );
  }

  return result;
}
