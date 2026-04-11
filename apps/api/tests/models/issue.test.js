/**
 * Integration tests — Issue Model (Sprint 2)
 *
 * Covers the full issue lifecycle:
 *   - create + findById (with taxonomy joins)
 *   - findAll (pagination, filtering, search, sort)
 *   - update (whitelist fields)
 *   - incrementCounter (supporter, comment, share, view)
 *   - setTrackingId + getTrackingIds (JSONB + GIN)
 *   - findByTrackingId (GIN index @> query)
 *   - updateStatus + softDelete
 *   - findByLocation (Haversine geo query)
 *   - setEscalationLevel
 *   - promoteToCompaign
 */

import {
  createTestApp,
  truncateTables,
  closeTestConnections,
  createTestUser,
  createTestIssue,
  testPool,
} from '../helpers.js';

import * as IssueModel from '../../src/models/issue.js';

let app;
let user;

beforeAll(async () => {
  app = await createTestApp();
  // Create a test user that persists for all tests in this file
  const result = await createTestUser(app, { phone: '9100000001', name: 'Issue Tester' });
  user = result.user;
});

afterAll(async () => {
  await app.close();
  await closeTestConnections();
});

beforeEach(async () => {
  // Clean only issues (keep the user)
  await testPool.query('TRUNCATE comments, supports, issues RESTART IDENTITY CASCADE');
});

// ── create ────────────────────────────────────────────────────────────────────

describe('IssueModel.create', () => {
  test('creates an issue with all required fields, returns full object with joins', async () => {
    const issue = await IssueModel.create({
      title: 'Broken streetlights on MG Road causing safety hazard',
      description:
        'Multiple streetlights on MG Road have been non-functional for over a month, leading to unsafe conditions',
      category: 'Infrastructure',
      urgency: 'high',
      locationLat: 28.6139,
      locationLng: 77.209,
      district: 'Central Delhi',
      state: 'Delhi',
      pincode: '110001',
      createdBy: user.id,
    });

    expect(issue.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(issue.title).toBe('Broken streetlights on MG Road causing safety hazard');
    expect(issue.category).toBe('Infrastructure');
    expect(issue.urgency).toBe('high');
    expect(issue.status).toBe('active');
    expect(issue.supporterCount).toBe(0);
    expect(issue.commentCount).toBe(0);
    expect(issue.viewCount).toBe(0);
    expect(issue.isCampaign).toBe(false);
    expect(issue.escalationLevel).toBe(0);
    expect(issue.trackingIds).toEqual({});

    // Creator nested object
    expect(issue.creator).toBeDefined();
    expect(issue.creator.id).toBe(user.id);
    expect(issue.creator.name).toBe('Issue Tester');

    // Taxonomy should be null since we didn't set them
    expect(issue.ministry).toBeNull();
    expect(issue.department).toBeNull();
    expect(issue.grievanceCategory).toBeNull();
  });

  test('creates anonymous issue, creator name shows "Anonymous Citizen"', async () => {
    const issue = await IssueModel.create({
      title: 'Corruption at local ration shop near village',
      description:
        'The local ration shop owner is demanding extra money for subsidized goods from poor families',
      category: 'Corruption',
      locationLat: 26.8467,
      locationLng: 80.9462,
      createdBy: user.id,
      isAnonymous: true,
    });

    expect(issue.isAnonymous).toBe(true);
    expect(issue.creator.name).toBe('Anonymous Citizen');
    expect(issue.creator.avatarUrl).toBeNull();
  });

  test('urgency defaults to "medium" when not specified', async () => {
    const issue = await IssueModel.create({
      title: 'Garbage not being collected on schedule',
      description:
        'Municipal garbage collection has stopped for the past two weeks in our colony area',
      category: 'Environment',
      locationLat: 28.6139,
      locationLng: 77.209,
      createdBy: user.id,
    });

    expect(issue.urgency).toBe('medium');
  });

  test('photos stored as JSONB array', async () => {
    const photos = [
      { url: 'https://example.com/photo1.jpg', caption: 'Pothole near entrance' },
      { url: 'https://example.com/photo2.jpg' },
    ];

    const issue = await IssueModel.create({
      title: 'Dangerous potholes on NH-48 highway near Gurgaon',
      description:
        'Multiple deep potholes on the highway that have caused several accidents in the past week',
      category: 'Infrastructure',
      locationLat: 28.4595,
      locationLng: 77.0266,
      createdBy: user.id,
      photos,
    });

    expect(issue.photos).toEqual(photos);
  });
});

// ── findById ──────────────────────────────────────────────────────────────────

describe('IssueModel.findById', () => {
  test('returns issue with all joined data', async () => {
    const created = await createTestIssue(user.id);
    const found = await IssueModel.findById(created.id);

    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
    expect(found.creator).toBeDefined();
    expect(found.creator.id).toBe(user.id);
  });

  test('returns null for non-existent UUID', async () => {
    const found = await IssueModel.findById('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });
});

// ── findAll ───────────────────────────────────────────────────────────────────

describe('IssueModel.findAll', () => {
  test('returns paginated results with correct pagination metadata', async () => {
    // Create 5 issues
    for (let i = 0; i < 5; i++) {
      await createTestIssue(user.id, {
        title: `Test issue number ${i + 1} for pagination test`,
      });
    }

    const result = await IssueModel.findAll({}, { page: 1, limit: 3 });

    expect(result.data).toHaveLength(3);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(3);
    expect(result.pagination.total).toBe(5);
    expect(result.pagination.totalPages).toBe(2);

    // Page 2
    const page2 = await IssueModel.findAll({}, { page: 2, limit: 3 });
    expect(page2.data).toHaveLength(2);
  });

  test('filters by category', async () => {
    await createTestIssue(user.id, { category: 'Healthcare' });
    await createTestIssue(user.id, { category: 'Education' });
    await createTestIssue(user.id, { category: 'Healthcare' });

    const result = await IssueModel.findAll({ category: 'Healthcare' });
    expect(result.data).toHaveLength(2);
    expect(result.data.every((i) => i.category === 'Healthcare')).toBe(true);
  });

  test('filters by urgency', async () => {
    await createTestIssue(user.id, { urgency: 'critical' });
    await createTestIssue(user.id, { urgency: 'low' });

    const result = await IssueModel.findAll({ urgency: 'critical' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].urgency).toBe('critical');
  });

  test('filters by district and state', async () => {
    await createTestIssue(user.id, { district: 'Pune', state: 'Maharashtra' });
    await createTestIssue(user.id, { district: 'Central Delhi', state: 'Delhi' });

    const result = await IssueModel.findAll({ district: 'Pune', state: 'Maharashtra' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].district).toBe('Pune');
  });

  test('search by title or description', async () => {
    await createTestIssue(user.id, {
      title: 'Water supply contamination in local area',
      description: 'Dirty water coming from municipal supply taps for three days',
    });
    await createTestIssue(user.id, {
      title: 'Broken road near village school campus',
      description: 'The road has developed large cracks and needs urgent repair',
    });

    const result = await IssueModel.findAll({ search: 'water' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toContain('Water supply');
  });

  test('filters by createdBy', async () => {
    const otherResult = await createTestUser(app, { phone: '9100000002', name: 'Other User' });
    await createTestIssue(user.id);
    await createTestIssue(otherResult.user.id);

    const result = await IssueModel.findAll({ createdBy: user.id });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].creator.id).toBe(user.id);
  });

  test('excludes closed issues by default', async () => {
    const issue = await createTestIssue(user.id);
    await IssueModel.softDelete(issue.id);

    const result = await IssueModel.findAll({});
    expect(result.data).toHaveLength(0);
  });

  test('can explicitly filter by status=closed', async () => {
    const issue = await createTestIssue(user.id);
    await IssueModel.softDelete(issue.id);

    const result = await IssueModel.findAll({ status: 'closed' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].status).toBe('closed');
  });

  test('sorts by newest (default)', async () => {
    const issue1 = await createTestIssue(user.id, {
      title: 'First issue created for sort test here',
    });
    const issue2 = await createTestIssue(user.id, {
      title: 'Second issue created for sort test here',
    });

    const result = await IssueModel.findAll({});
    expect(result.data[0].id).toBe(issue2.id); // newest first
  });

  test('sorts by most_supported', async () => {
    const issue1 = await createTestIssue(user.id);
    const issue2 = await createTestIssue(user.id);
    await IssueModel.incrementCounter(issue1.id, 'supporter_count', 100);

    const result = await IssueModel.findAll({}, { sort: 'most_supported' });
    expect(result.data[0].id).toBe(issue1.id);
    expect(result.data[0].supporterCount).toBe(100);
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe('IssueModel.update', () => {
  test('updates allowed fields and returns updated issue', async () => {
    const issue = await createTestIssue(user.id);

    const updated = await IssueModel.update(issue.id, {
      title: 'Updated title with more details about the issue',
      description: 'Updated description of the issue with more specific information about it',
      urgency: 'critical',
    });

    expect(updated.title).toBe('Updated title with more details about the issue');
    expect(updated.urgency).toBe('critical');
  });

  test('ignores unknown/disallowed fields', async () => {
    const issue = await createTestIssue(user.id);

    // status is NOT in the update whitelist
    const updated = await IssueModel.update(issue.id, { status: 'closed' });
    expect(updated.status).toBe('active'); // unchanged
  });

  test('returns current issue when no valid fields provided', async () => {
    const issue = await createTestIssue(user.id);
    const updated = await IssueModel.update(issue.id, { nonexistent_field: 'value' });
    expect(updated.id).toBe(issue.id);
  });
});

// ── incrementCounter ──────────────────────────────────────────────────────────

describe('IssueModel.incrementCounter', () => {
  test('increments supporter_count atomically', async () => {
    const issue = await createTestIssue(user.id);

    const result1 = await IssueModel.incrementCounter(issue.id, 'supporter_count', 1);
    expect(result1.supporterCount).toBe(1);

    const result2 = await IssueModel.incrementCounter(issue.id, 'supporter_count', 5);
    expect(result2.supporterCount).toBe(6);
  });

  test('increments view_count', async () => {
    const issue = await createTestIssue(user.id);
    const result = await IssueModel.incrementCounter(issue.id, 'view_count', 10);
    expect(result.viewCount).toBe(10);
  });

  test('counter does not go below zero (GREATEST(0, ...))', async () => {
    const issue = await createTestIssue(user.id);
    const result = await IssueModel.incrementCounter(issue.id, 'supporter_count', -100);
    expect(result.supporterCount).toBe(0);
  });

  test('throws on invalid counter field', async () => {
    const issue = await createTestIssue(user.id);
    await expect(IssueModel.incrementCounter(issue.id, 'invalid_field', 1)).rejects.toThrow(
      'Invalid counter field',
    );
  });

  test('returns null for non-existent issue', async () => {
    const result = await IssueModel.incrementCounter(
      '00000000-0000-0000-0000-000000000000',
      'supporter_count',
      1,
    );
    expect(result).toBeNull();
  });
});

// ── Tracking IDs (JSONB + GIN) ───────────────────────────────────────────────

describe('IssueModel tracking IDs', () => {
  test('setTrackingId adds a key to tracking_ids JSONB', async () => {
    const issue = await createTestIssue(user.id);

    const result = await IssueModel.setTrackingId(issue.id, 'cpgrams_id', 'DARPG/E/2026/0001234');
    expect(result.trackingIds.cpgrams_id).toBe('DARPG/E/2026/0001234');
  });

  test('setTrackingId can set multiple keys', async () => {
    const issue = await createTestIssue(user.id);

    await IssueModel.setTrackingId(issue.id, 'cpgrams_id', 'DARPG/E/2026/0001234');
    await IssueModel.setTrackingId(issue.id, 'state_portal_id', 'HRYCMW/2026/00567');
    await IssueModel.setTrackingId(issue.id, 'rti_registration_id', 'RTI/DoPT/2026/00089');

    const trackingIds = await IssueModel.getTrackingIds(issue.id);
    expect(trackingIds.cpgrams_id).toBe('DARPG/E/2026/0001234');
    expect(trackingIds.state_portal_id).toBe('HRYCMW/2026/00567');
    expect(trackingIds.rti_registration_id).toBe('RTI/DoPT/2026/00089');
  });

  test('getTrackingIds returns current JSONB', async () => {
    const issue = await createTestIssue(user.id);
    const trackingIds = await IssueModel.getTrackingIds(issue.id);
    expect(trackingIds).toEqual({});
  });

  test('getTrackingIds returns null for non-existent issue', async () => {
    const result = await IssueModel.getTrackingIds('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  test('findByTrackingId uses GIN index for @> containment query', async () => {
    const issue1 = await createTestIssue(user.id);
    const issue2 = await createTestIssue(user.id);

    await IssueModel.setTrackingId(issue1.id, 'cpgrams_id', 'DARPG/E/2026/UNIQUE001');
    await IssueModel.setTrackingId(issue2.id, 'cpgrams_id', 'DARPG/E/2026/UNIQUE002');

    const results = await IssueModel.findByTrackingId('cpgrams_id', 'DARPG/E/2026/UNIQUE001');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(issue1.id);
  });

  test('findByTrackingId returns empty array when no match', async () => {
    const results = await IssueModel.findByTrackingId('cpgrams_id', 'NON_EXISTENT');
    expect(results).toEqual([]);
  });
});

// ── updateStatus + softDelete ────────────────────────────────────────────────

describe('IssueModel status management', () => {
  test('updateStatus changes status field', async () => {
    const issue = await createTestIssue(user.id);
    const result = await IssueModel.updateStatus(issue.id, 'trending');
    expect(result.status).toBe('trending');
  });

  test('escalated status sets escalated_at timestamp', async () => {
    const issue = await createTestIssue(user.id);
    const result = await IssueModel.updateStatus(issue.id, 'escalated');

    expect(result.status).toBe('escalated');
    expect(result.escalatedAt).not.toBeNull();
  });

  test('officially_resolved sets resolved_at timestamp', async () => {
    const issue = await createTestIssue(user.id);
    const result = await IssueModel.updateStatus(issue.id, 'officially_resolved');

    expect(result.status).toBe('officially_resolved');
    expect(result.resolvedAt).not.toBeNull();
  });

  test('citizen_verified_resolved sets resolved_at timestamp', async () => {
    const issue = await createTestIssue(user.id);
    const result = await IssueModel.updateStatus(issue.id, 'citizen_verified_resolved');

    expect(result.status).toBe('citizen_verified_resolved');
    expect(result.resolvedAt).not.toBeNull();
  });

  test('softDelete sets status to closed', async () => {
    const issue = await createTestIssue(user.id);
    const result = await IssueModel.softDelete(issue.id);

    expect(result.status).toBe('closed');
  });

  test('softDelete returns null for non-existent issue', async () => {
    const result = await IssueModel.softDelete('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });
});

// ── findByLocation (Haversine geo query) ─────────────────────────────────────

describe('IssueModel.findByLocation', () => {
  test('finds nearby issues within radius', async () => {
    // Delhi: 28.6139, 77.2090
    await createTestIssue(user.id, {
      title: 'Issue very close to search point test',
      locationLat: 28.615,
      locationLng: 77.21,
      district: 'Central Delhi',
    });

    // Mumbai — far away: 19.0760, 72.8777
    await createTestIssue(user.id, {
      title: 'Issue far away in Mumbai for testing',
      locationLat: 19.076,
      locationLng: 72.8777,
      district: 'Mumbai',
    });

    const nearby = await IssueModel.findByLocation(28.6139, 77.209, 5); // 5km radius
    expect(nearby).toHaveLength(1);
    expect(nearby[0].district).toBe('Central Delhi');
    expect(nearby[0].distanceKm).toBeLessThan(1); // very close
  });

  test('returns empty array when no issues in radius', async () => {
    await createTestIssue(user.id, {
      locationLat: 19.076,
      locationLng: 72.8777,
    });

    const nearby = await IssueModel.findByLocation(13.0827, 80.2707, 5); // Chennai
    expect(nearby).toHaveLength(0);
  });

  test('orders by distance ascending', async () => {
    // Close issue (1km away)
    await createTestIssue(user.id, {
      title: 'Close issue near the search location here',
      locationLat: 28.62,
      locationLng: 77.209,
    });

    // Slightly farther issue (5km away)
    await createTestIssue(user.id, {
      title: 'Farther issue from search location here',
      locationLat: 28.65,
      locationLng: 77.209,
    });

    const nearby = await IssueModel.findByLocation(28.6139, 77.209, 10);
    expect(nearby.length).toBeGreaterThanOrEqual(2);
    expect(nearby[0].distanceKm).toBeLessThan(nearby[1].distanceKm);
  });

  test('excludes closed issues from geo results', async () => {
    const issue = await createTestIssue(user.id, {
      locationLat: 28.615,
      locationLng: 77.21,
    });
    await IssueModel.softDelete(issue.id);

    const nearby = await IssueModel.findByLocation(28.6139, 77.209, 5);
    expect(nearby).toHaveLength(0);
  });
});

// ── setEscalationLevel ───────────────────────────────────────────────────────

describe('IssueModel.setEscalationLevel', () => {
  test('sets escalation level and auto-escalates status if active', async () => {
    const issue = await createTestIssue(user.id);
    const result = await IssueModel.setEscalationLevel(issue.id, 1);

    expect(result.escalationLevel).toBe(1);
    expect(result.status).toBe('escalated');
    expect(result.escalatedAt).not.toBeNull();
  });

  test('increases escalation level, updates escalated_at', async () => {
    const issue = await createTestIssue(user.id);
    await IssueModel.setEscalationLevel(issue.id, 1);
    const result = await IssueModel.setEscalationLevel(issue.id, 3);

    expect(result.escalationLevel).toBe(3);
  });

  test('returns null for non-existent issue', async () => {
    const result = await IssueModel.setEscalationLevel('00000000-0000-0000-0000-000000000000', 1);
    expect(result).toBeNull();
  });
});

// ── promoteToCompaign ────────────────────────────────────────────────────────

describe('IssueModel.promoteToCampaign', () => {
  test('promotes issue to campaign with target and deadline', async () => {
    const issue = await createTestIssue(user.id);
    const deadline = new Date('2026-12-31T23:59:59Z');
    const result = await IssueModel.promoteToCampaign(issue.id, 10000, deadline);

    expect(result.isCampaign).toBe(true);
    expect(result.targetSupporters).toBe(10000);
    expect(result.campaignDeadline).toBeDefined();
  });

  test('promotes without deadline', async () => {
    const issue = await createTestIssue(user.id);
    const result = await IssueModel.promoteToCampaign(issue.id, 5000);

    expect(result.isCampaign).toBe(true);
    expect(result.targetSupporters).toBe(5000);
    expect(result.campaignDeadline).toBeNull();
  });
});
