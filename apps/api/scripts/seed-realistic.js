#!/usr/bin/env node
/**
 * Realistic Seed Script
 *
 * Seeds a production-like dataset for load testing and demo:
 *   - 200 users spread across 15 Indian cities (various roles, verification states)
 *   - 500 issues across all categories, urgencies, and districts
 *   - ~10,000 supports (realistic distribution — viral issues get more)
 *   - 5 issues at 100+ supporters (triggers trending status)
 *   - 2 issues flagged by anti-gaming (suspicious_activity entries)
 *
 * Prerequisites: taxonomy + locations already seeded.
 *
 * Usage:
 *   cd apps/api && node --env-file=.env scripts/seed-realistic.js
 *   cd apps/api && DATABASE_URL=... node scripts/seed-realistic.js
 */

import pg from 'pg';
import crypto from 'crypto';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/prajashakti',
});

// ── Data fixtures ─────────────────────────────────────────────────────────────

const CITIES = [
  { district: 'Central Delhi', state: 'Delhi', lat: 28.6315, lng: 77.2167, pincode: '110001' },
  { district: 'South Delhi', state: 'Delhi', lat: 28.5355, lng: 77.299, pincode: '110017' },
  { district: 'Mumbai City', state: 'Maharashtra', lat: 18.9388, lng: 72.8354, pincode: '400001' },
  { district: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, pincode: '411001' },
  {
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
    pincode: '560001',
  },
  { district: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, pincode: '600001' },
  { district: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867, pincode: '500001' },
  { district: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, pincode: '700001' },
  { district: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, pincode: '380001' },
  { district: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, pincode: '302001' },
  { district: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, pincode: '226001' },
  { district: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376, pincode: '800001' },
  { district: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126, pincode: '462001' },
  { district: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lng: 76.7794, pincode: '160001' },
  { district: 'Thiruvananthapuram', state: 'Kerala', lat: 8.5241, lng: 76.9366, pincode: '695001' },
];

const CATEGORIES = [
  'Infrastructure',
  'Healthcare',
  'Education',
  'Safety',
  'Environment',
  'Agriculture',
  'Corruption',
  'Other',
];

const URGENCIES = ['critical', 'high', 'medium', 'low'];

const ISSUE_TITLES = [
  'Road full of potholes near main market causing accidents',
  'Street lights not working in residential colony for months',
  'Garbage not collected for over two weeks in our ward',
  'Open drainage causing waterlogging and disease spread',
  'Public hospital lacks basic medicines and equipment',
  'School building in dangerous condition, needs urgent repair',
  'Illegal construction blocking road access to locality',
  'Water supply contaminated with sewage in our area',
  'Encroachment on public park by private builder',
  'Broken footpaths causing injury to pedestrians daily',
  'Traffic signals not working at main intersection',
  'Illegal dumping of industrial waste near river',
  'Public toilet in deplorable condition at bus stand',
  'Electricity cuts lasting 8+ hours daily in summer',
  'Stray animal menace — no action despite complaints',
  'Corruption in ration distribution at PDS shop',
  'Child labour spotted at construction site',
  'Fake medicines sold openly at local pharmacy',
  'Borewell dug illegally depleting groundwater table',
  'Crop damage due to flooding — no compensation given',
  'Land encroachment on farmer fields by government officials',
  'Police extorting money from street vendors regularly',
  'Missing manhole covers causing accidents at night',
  'Air pollution from brick kiln exceeding limits',
  'River water level dangerously high, no warning system',
  'Primary health centre closed on weekdays due to absenteeism',
  'School teachers absent for weeks with no action taken',
  'Government housing allotted to ineligible people',
  'Transformer not repaired despite multiple complaints',
  'Road not constructed despite budget sanctioned three years ago',
  'Park turned into parking lot by local corporator',
  'Tree felling drive destroying green cover in city',
  'Pesticide poisoning outbreak in village — no medical aid',
  'Child malnutrition crisis in tribal area — no response',
  'Fake documents used to get government scheme benefits',
  'Hospital charging for free treatment under government scheme',
  'Sewage treatment plant not functioning properly',
  'Bridge in dangerous condition, declared unsafe years ago',
  'Groundwater extraction causing subsidence in colony',
  'Public distribution shop selling substandard grains',
  'Night shelter for homeless locked during winter months',
  'Road divider removed without permission for commercial use',
  'Drinking water tanker supply irregular and corrupted',
  'School mid-day meal quality extremely poor and unhygienic',
  'Ambulance service unavailable at primary health centre',
  'CCTV cameras installed but not working for past year',
  'Storm drain choked, flooding basement apartments',
  'Public library converted to storage by officials',
  'Covid vaccination centre charges unofficial fees',
  'Old age pension not released for over six months',
];

const DESCRIPTIONS = [
  'Citizens have been facing this problem for months. Multiple complaints have been filed but there has been no action from the authorities. This is affecting hundreds of families in the area.',
  'The situation has been deteriorating rapidly. Despite multiple representations to local officials and the district administration, the problem remains unresolved. We demand immediate action.',
  'This issue is causing severe hardship to residents, especially elderly people and children. The concerned department has been informed multiple times but the work order has not been issued.',
  'The problem was first reported six months ago. Officials visited and promised action, but nothing has been done. We are now escalating this to the district level.',
  'Local residents have been suffering for too long. This affects our daily lives, health, and safety. We urge the authorities to take immediate corrective action.',
  'Despite multiple complaints to the gram panchayat, municipal corporation, and district collector, no one has taken responsibility for resolving this issue.',
  'The contractor collected payment but abandoned the work midway. The department is aware but not taking any action against the contractor or completing the work.',
  'This situation poses a direct threat to public health and safety. We request the honourable officials to kindly intervene and ensure this is resolved without further delay.',
  'Photographic evidence has been submitted to the relevant department. The problem has worsened significantly in the last few weeks and requires emergency intervention.',
  'This is a clear violation of citizens rights under the Constitution. We demand accountability from the responsible officials and request the higher authorities to investigate.',
];

const FIRST_NAMES = [
  'Amit',
  'Priya',
  'Rahul',
  'Sunita',
  'Vikram',
  'Meera',
  'Arun',
  'Kavita',
  'Suresh',
  'Anita',
  'Rajesh',
  'Pooja',
  'Deepak',
  'Sonia',
  'Manoj',
  'Rekha',
  'Vinod',
  'Geeta',
  'Santosh',
  'Nisha',
  'Ravi',
  'Usha',
  'Ashok',
  'Seema',
  'Ramesh',
  'Lata',
  'Dinesh',
  'Pushpa',
  'Naresh',
  'Kamla',
  'Mohan',
  'Savita',
  'Gopal',
  'Hema',
  'Girish',
  'Jyoti',
  'Prakash',
  'Mamta',
  'Subhash',
  'Radha',
  'Narendra',
  'Sheela',
  'Pankaj',
  'Vandana',
  'Arvind',
  'Shanti',
];

const LAST_NAMES = [
  'Sharma',
  'Verma',
  'Gupta',
  'Singh',
  'Kumar',
  'Yadav',
  'Joshi',
  'Patel',
  'Mishra',
  'Sinha',
  'Pandey',
  'Dubey',
  'Shukla',
  'Tiwari',
  'Saxena',
  'Agarwal',
  'Srivastava',
  'Rai',
  'Mehta',
  'Shah',
  'Nair',
  'Reddy',
  'Pillai',
  'Iyer',
  'Menon',
  'Krishnan',
  'Subramaniam',
  'Naidu',
  'Rao',
];

// ── Utility functions ─────────────────────────────────────────────────────────

let phoneCounter = 7000000001;
function nextPhone() {
  return String(phoneCounter++);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(base, maxDelta) {
  return parseFloat((base + (Math.random() - 0.5) * 2 * maxDelta).toFixed(6));
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

// ── Seeding functions ─────────────────────────────────────────────────────────

async function seedUsers(client, count = 200) {
  console.log(`\n[seed] Inserting ${count} users...`);
  const userIds = [];

  const roles = [
    'citizen',
    'citizen',
    'citizen',
    'citizen',
    'citizen',
    'citizen',
    'verified_citizen',
    'verified_citizen',
    'leader',
    'moderator',
  ];

  for (let i = 0; i < count; i++) {
    const city = pick(CITIES);
    const role = pick(roles);
    const isVerified = role !== 'citizen';
    const createdDaysAgo = randInt(1, 365);
    const name = randomName();
    const phone = nextPhone();

    const { rows } = await client.query(
      `INSERT INTO users
         (phone, name, role, district, state, pincode, is_verified,
          reputation_score, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING id`,
      [
        phone,
        name,
        role,
        city.district,
        city.state,
        city.pincode,
        isVerified,
        randInt(0, 500),
        daysAgo(createdDaysAgo),
      ],
    );
    userIds.push({ id: rows[0].id, role, isVerified, createdAt: daysAgo(createdDaysAgo) });
  }

  console.log(`[seed] ✓ Created ${userIds.length} users`);
  return userIds;
}

async function seedIssues(client, userIds, count = 500) {
  console.log(`\n[seed] Inserting ${count} issues...`);
  const issueIds = [];

  // Fetch some grievance category IDs to optionally link
  const { rows: catRows } = await client.query(
    `SELECT id FROM grievance_categories WHERE is_active = true LIMIT 20`,
  );
  const catIds = catRows.map((r) => r.id);

  for (let i = 0; i < count; i++) {
    const city = pick(CITIES);
    const category = pick(CATEGORIES);
    const urgency = pick(URGENCIES);
    const creator = pick(userIds);
    const createdDaysAgo = randInt(0, 180);
    const title = ISSUE_TITLES[i % ISSUE_TITLES.length];
    const description = pick(DESCRIPTIONS);
    const grievanceCategoryId = catIds.length > 0 && Math.random() > 0.5 ? pick(catIds) : null;

    const { rows } = await client.query(
      `INSERT INTO issues
         (title, description, category, urgency,
          location_lat, location_lng, district, state, pincode,
          grievance_category_id,
          status, supporter_count, view_count, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
       RETURNING id`,
      [
        title,
        description,
        category,
        urgency,
        jitter(city.lat, 0.05),
        jitter(city.lng, 0.05),
        city.district,
        city.state,
        city.pincode,
        grievanceCategoryId,
        'active',
        0, // will be updated after supports are inserted
        randInt(0, 200),
        creator.id,
        daysAgo(createdDaysAgo),
      ],
    );
    issueIds.push({ id: rows[0].id, createdDaysAgo });
  }

  console.log(`[seed] ✓ Created ${issueIds.length} issues`);
  return issueIds;
}

async function seedSupports(client, userIds, issueIds, targetTotal = 10000) {
  console.log(`\n[seed] Inserting ~${targetTotal} supports (realistic distribution)...`);

  // Viral issues: first 5 get 100–300 supports each
  const viralCount = Math.min(5, issueIds.length);
  const viral = issueIds.slice(0, viralCount);
  const regular = issueIds.slice(viralCount);

  const inserted = new Set(); // "userId:issueId" dedup
  let totalInserted = 0;

  async function addSupport(userId, issueId, daysAgoN) {
    const key = `${userId}:${issueId}`;
    if (inserted.has(key)) return false;
    inserted.add(key);

    try {
      await client.query(
        `INSERT INTO supports (user_id, issue_id, weight, source, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [userId, issueId, 1.0, 'web', daysAgo(daysAgoN)],
      );
      totalInserted++;
      return true;
    } catch {
      return false;
    }
  }

  // Viral issues: 100–300 supporters each
  for (const issue of viral) {
    const targetSupports = randInt(100, 300);
    const shuffled = [...userIds].sort(() => Math.random() - 0.5);
    let count = 0;
    for (const user of shuffled) {
      if (count >= targetSupports) break;
      if (await addSupport(user.id, issue.id, randInt(0, issue.createdDaysAgo || 1))) {
        count++;
      }
    }
    // Set supporter_count + trending status
    await client.query(
      `UPDATE issues SET supporter_count = $2, status = 'trending', updated_at = NOW()
       WHERE id = $1`,
      [issue.id, count],
    );
  }

  // Remaining supports distributed across regular issues
  const remainingTarget = targetTotal - totalInserted;
  const supportsPerIssue = Math.ceil(remainingTarget / regular.length);

  for (const issue of regular) {
    // Zipf-like distribution: most issues get 5-30 supports, some get more
    const issueTarget = Math.min(
      Math.floor(supportsPerIssue * (0.1 + Math.random() * 0.9)),
      userIds.length - 1,
    );
    const shuffled = [...userIds].sort(() => Math.random() - 0.5);
    let count = 0;
    for (const user of shuffled) {
      if (count >= issueTarget) break;
      if (await addSupport(user.id, issue.id, randInt(0, issue.createdDaysAgo || 1))) {
        count++;
      }
    }
    if (count > 0) {
      await client.query(
        `UPDATE issues SET supporter_count = $2, updated_at = NOW() WHERE id = $1`,
        [issue.id, count],
      );
    }
  }

  console.log(`[seed] ✓ Inserted ${totalInserted} support records`);
  return totalInserted;
}

async function seedSuspiciousActivity(client, issueIds) {
  console.log('\n[seed] Flagging 2 issues with suspicious activity...');

  // Flag the last 2 issues
  const flagged = issueIds.slice(-2);
  for (const issue of flagged) {
    await client.query(
      `INSERT INTO suspicious_activity
         (event_type, entity_type, entity_id, severity, details, reviewed)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'velocity_spike',
        'issue',
        issue.id,
        'warning',
        JSON.stringify({
          check: 'support_velocity',
          window_minutes: 10,
          count: randInt(800, 1200),
          threshold: 1000,
          message: 'Suspicious support velocity detected',
        }),
        false,
      ],
    );
    // Set discrepancy score on issue
    await client.query(
      `UPDATE issues SET discrepancy_score = 0.75, updated_at = NOW() WHERE id = $1`,
      [issue.id],
    );
  }
  console.log('[seed] ✓ Flagged 2 issues with suspicious activity');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[seed:realistic] Starting realistic dataset seed...\n');
  console.log('  Target: 200 users, 500 issues, ~10,000 supports');
  console.log(
    `  Database: ${process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/prajashakti'}\n`,
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear transactional data (keep taxonomy + locations + officials)
    await client.query(`
      TRUNCATE supports, issue_officials, suspicious_activity,
               notifications, user_activity, audit_log,
               issues, users RESTART IDENTITY CASCADE
    `);
    console.log('[seed] Cleared existing transactional data');

    const userIds = await seedUsers(client);
    const issueIds = await seedIssues(client, userIds);
    const supportCount = await seedSupports(client, userIds, issueIds);
    await seedSuspiciousActivity(client, issueIds);

    await client.query('COMMIT');

    // Summary
    const { rows: summary } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM issues) AS issues,
        (SELECT COUNT(*) FROM supports) AS supports,
        (SELECT COUNT(*) FROM issues WHERE status = 'trending') AS trending,
        (SELECT COUNT(*) FROM suspicious_activity WHERE reviewed = false) AS flagged
    `);
    const s = summary[0];

    console.log('\n[seed:realistic] ✅ Done!');
    console.log(`  Users:         ${s.users}`);
    console.log(`  Issues:        ${s.issues}`);
    console.log(`  Supports:      ${s.supports}`);
    console.log(`  Trending:      ${s.trending}`);
    console.log(`  Flagged:       ${s.flagged}`);
    console.log(`\n  Run load tests with:`);
    console.log(`  npx artillery run tests/load/issue-list.yml`);
    console.log(`  npx artillery run tests/load/support-spike.yml`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed:realistic] ❌ Failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
