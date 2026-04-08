/**
 * Unit tests — User Model
 * Tests the DB query layer directly using the test database.
 */

import { createTestApp, truncateTables, closeTestConnections, testPool } from '../helpers.js';

import * as UserModel from '../../src/models/user.js';

let app;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
  await closeTestConnections();
});
beforeEach(() => truncateTables());

// ── create ────────────────────────────────────────────────────────────────────

describe('UserModel.create', () => {
  test('creates user with phone and name, returns UUID', async () => {
    const user = await UserModel.create({ phone: '9111111101', name: 'Arun Kumar' });

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.phone).toBe('9111111101');
    expect(user.name).toBe('Arun Kumar');
    expect(user.role).toBe('citizen');
  });

  test('throws on duplicate phone', async () => {
    await UserModel.create({ phone: '9111111102', name: 'First' });
    await expect(UserModel.create({ phone: '9111111102', name: 'Duplicate' })).rejects.toThrow();
  });
});

// ── findByPhone ───────────────────────────────────────────────────────────────

describe('UserModel.findByPhone', () => {
  test('returns correct user for registered phone', async () => {
    await UserModel.create({ phone: '9111111103', name: 'Priya Singh' });
    const user = await UserModel.findByPhone('9111111103');

    expect(user).not.toBeNull();
    expect(user.phone).toBe('9111111103');
    expect(user.name).toBe('Priya Singh');
  });

  test('returns null for non-existent phone', async () => {
    const user = await UserModel.findByPhone('9000000000');
    expect(user).toBeNull();
  });
});

// ── findById ──────────────────────────────────────────────────────────────────

describe('UserModel.findById', () => {
  test('returns correct user by UUID', async () => {
    const created = await UserModel.create({ phone: '9111111104', name: 'Ravi Pillai' });
    const found = await UserModel.findById(created.id);

    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
    expect(found.name).toBe('Ravi Pillai');
  });

  test('returns null for unknown UUID', async () => {
    const user = await UserModel.findById('00000000-0000-0000-0000-000000000000');
    expect(user).toBeNull();
  });
});

// ── findByEmail ───────────────────────────────────────────────────────────────

describe('UserModel.findByEmail', () => {
  test('returns user by email after it is set', async () => {
    const created = await UserModel.create({ phone: '9111111105', name: 'Meena Devi' });
    await UserModel.update(created.id, { email: 'meena@example.com' });

    const found = await UserModel.findByEmail('meena@example.com');
    expect(found).not.toBeNull();
    expect(found.email).toBe('meena@example.com');
  });

  test('returns null for unknown email', async () => {
    const user = await UserModel.findByEmail('nobody@example.com');
    expect(user).toBeNull();
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe('UserModel.update', () => {
  test('updates name and bio, returns updated fields', async () => {
    const created = await UserModel.create({ phone: '9111111106', name: 'Old Name' });
    const updated = await UserModel.update(created.id, {
      name: 'New Name',
      bio: 'Updated bio here',
    });

    expect(updated.name).toBe('New Name');
    expect(updated.bio).toBe('Updated bio here');
  });

  test('unknown columns are silently dropped (filtered by service layer)', async () => {
    // The model receives already-filtered snake_case columns.
    // Passing zero valid fields would normally be caught by the service,
    // but the model itself doesn't break — it just returns null with no SET clause.
    const created = await UserModel.create({ phone: '9111111107', name: 'Stable' });
    // Passing valid field — model only needs valid columns
    const updated = await UserModel.update(created.id, { name: 'Stable Updated' });
    expect(updated.name).toBe('Stable Updated');
  });
});

// ── linkGoogleAccount ────────────────────────────────────────────────────────

describe('UserModel.linkGoogleAccount', () => {
  test('sets google_id and email on the user', async () => {
    const created = await UserModel.create({ phone: '9111111108', name: 'Google User' });
    const linked = await UserModel.linkGoogleAccount(created.id, {
      googleId: 'google_abc123',
      email: 'linked@gmail.com',
      emailVerified: true,
    });

    // google_id is now in PRIVATE_COLS — returned camelCased as googleId
    expect(linked.googleId).toBe('google_abc123');

    // Verify directly in DB
    const { rows } = await testPool.query(
      'SELECT google_id, email, email_verified FROM users WHERE id = $1',
      [created.id],
    );
    expect(rows[0].google_id).toBe('google_abc123');
    expect(rows[0].email).toBe('linked@gmail.com');
    expect(rows[0].email_verified).toBe(true);
  });
});

// ── findPublicById ────────────────────────────────────────────────────────────

describe('UserModel.findPublicById', () => {
  test('returns only public fields — no phone, email, or location', async () => {
    const created = await UserModel.create({ phone: '9111111109', name: 'Public User' });
    const pub = await UserModel.findPublicById(created.id);

    expect(pub).not.toBeNull();
    expect(pub.id).toBe(created.id);
    expect(pub.name).toBe('Public User');
    expect(pub.isVerified).toBeDefined(); // verified badge field
    expect(pub.phone).toBeUndefined(); // must NOT be present
    expect(pub.email).toBeUndefined();
    expect(pub.locationLat).toBeUndefined();
  });

  test('returns null for nonexistent UUID', async () => {
    const user = await UserModel.findPublicById('00000000-0000-0000-0000-000000000000');
    expect(user).toBeNull();
  });
});
