/**
 * Reusable Fastify/Ajv schema objects
 * Import and compose these in route schema definitions.
 */

export const CATEGORIES = [
  'Infrastructure',
  'Healthcare',
  'Education',
  'Safety',
  'Environment',
  'Agriculture',
  'Corruption',
  'Other',
];

export const URGENCIES = ['critical', 'high', 'medium', 'low'];
export const STATUSES = ['active', 'trending', 'escalated', 'responded', 'resolved', 'closed'];

// ─── Primitive schemas ────────────────────────────────────────────────────────

export const phoneSchema = {
  type: 'string',
  pattern: '^[6-9]\\d{9}$',
  description: '10-digit Indian mobile number starting with 6-9',
};

export const otpSchema = {
  type: 'string',
  pattern: '^\\d{6}$',
  description: 'Exactly 6 digits',
};

export const uuidSchema = {
  type: 'string',
  format: 'uuid',
  description: 'UUID v4',
};

// ─── Compound schemas ─────────────────────────────────────────────────────────

export const paginationSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
};

export const locationSchema = {
  type: 'object',
  properties: {
    lat: { type: 'number', minimum: -90, maximum: 90 },
    lng: { type: 'number', minimum: -180, maximum: 180 },
    district: { type: 'string', maxLength: 100 },
    state: { type: 'string', maxLength: 100 },
    pincode: { type: 'string', pattern: '^\\d{6}$' },
  },
};

// ─── Route-level schemas ──────────────────────────────────────────────────────

export const issueCreateSchema = {
  body: {
    type: 'object',
    required: ['title', 'description', 'category'],
    properties: {
      title: { type: 'string', minLength: 10, maxLength: 200 },
      description: { type: 'string', minLength: 20, maxLength: 2000 },
      category: { type: 'string', enum: CATEGORIES },
      urgency: { type: 'string', enum: URGENCIES, default: 'medium' },
      photos: { type: 'array', items: { type: 'string' }, maxItems: 5, default: [] },
      district: { type: 'string', maxLength: 100 },
      state: { type: 'string', maxLength: 100 },
      pincode: { type: 'string', pattern: '^\\d{6}$' },
      location_lat: { type: 'number', minimum: -90, maximum: 90 },
      location_lng: { type: 'number', minimum: -180, maximum: 180 },
      official_id: { type: 'string', format: 'uuid' },
    },
    additionalProperties: false,
  },
};

export const issueFilterSchema = {
  querystring: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: CATEGORIES },
      urgency: { type: 'string', enum: URGENCIES },
      status: { type: 'string', enum: STATUSES },
      district: { type: 'string' },
      state: { type: 'string' },
      sort: {
        type: 'string',
        enum: ['newest', 'most_supported', 'nearest', 'most_urgent'],
        default: 'newest',
      },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};
