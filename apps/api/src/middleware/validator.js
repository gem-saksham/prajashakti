/**
 * Reusable Fastify/Ajv schema objects
 * Import and compose these in route schema definitions.
 *
 * Updated for Sprint 2 Day 16 — enhanced issue schema with government
 * taxonomy links, campaign fields, and tracking ID structure.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

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

export const STATUSES = [
  'active',
  'trending',
  'escalated',
  'officially_resolved',
  'citizen_verified_resolved',
  'citizen_disputed',
  'closed',
];

export const JURISDICTION_TYPES = ['national', 'state', 'district', 'municipal', 'local'];

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

export const pincodeSchema = {
  type: 'string',
  pattern: '^\\d{6}$',
  description: '6-digit Indian pincode',
};

export const categoryEnum = {
  type: 'string',
  enum: CATEGORIES,
  description: 'PrajaShakti issue category',
};

export const urgencyEnum = {
  type: 'string',
  enum: URGENCIES,
  description: 'Issue urgency level',
};

export const statusEnum = {
  type: 'string',
  enum: STATUSES,
  description: 'Issue status',
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
    pincode: pincodeSchema,
  },
};

/**
 * Phase 2 tracking IDs — JSONB structure for external government portal references.
 * All fields are optional. Populated when the issue is filed/tracked on that platform.
 */
export const trackingIdsSchema = {
  type: 'object',
  properties: {
    cpgrams_id: { type: 'string', maxLength: 100 },
    cpgrams_filed_at: { type: 'string', format: 'date-time' },
    cpgrams_last_status: { type: 'string', maxLength: 100 },
    state_portal_id: { type: 'string', maxLength: 100 },
    state_portal_type: { type: 'string', maxLength: 100 },
    nch_docket_id: { type: 'string', maxLength: 100 },
    rti_registration_id: { type: 'string', maxLength: 100 },
    rti_filed_at: { type: 'string', format: 'date-time' },
    rti_response_due: { type: 'string', format: 'date-time' },
  },
  additionalProperties: false,
};

// ─── Issue Route Schemas ─────────────────────────────────────────────────────

/**
 * Create Issue — all required fields for creation.
 * location_lat and location_lng are required; taxonomy fields are optional.
 */
export const issueCreateSchema = {
  body: {
    type: 'object',
    required: ['title', 'description', 'category', 'location_lat', 'location_lng'],
    properties: {
      title: { type: 'string', minLength: 10, maxLength: 200 },
      description: { type: 'string', minLength: 20, maxLength: 2000 },
      category: categoryEnum,
      urgency: { ...urgencyEnum, default: 'medium' },

      // Location (required)
      location_lat: {
        type: 'number',
        minimum: 6,
        maximum: 38,
        description: 'Indian lat range ~6-38',
      },
      location_lng: {
        type: 'number',
        minimum: 68,
        maximum: 98,
        description: 'Indian lng range ~68-98',
      },
      district: { type: 'string', maxLength: 100 },
      state: { type: 'string', maxLength: 100 },
      pincode: pincodeSchema,
      formatted_address: { type: 'string', maxLength: 500 },

      // Media
      photos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string', maxLength: 1000 },
            caption: { type: 'string', maxLength: 200 },
          },
          required: ['url'],
        },
        maxItems: 5,
        default: [],
      },

      // Government taxonomy (optional — populated by user or NLP later)
      ministry_id: uuidSchema,
      department_id: uuidSchema,
      grievance_category_id: uuidSchema,

      // Official tagging (free-text, optional)
      official_name: { type: 'string', maxLength: 200 },
      official_designation: { type: 'string', maxLength: 200 },
      official_department: { type: 'string', maxLength: 200 },

      // Flags
      is_anonymous: { type: 'boolean', default: false },

      // Official IDs to tag at creation time (from suggest-tags response)
      suggested_official_ids: {
        type: 'array',
        items: uuidSchema,
        maxItems: 5,
        default: [],
      },
    },
    additionalProperties: false,
  },
};

/**
 * Update Issue — subset allowed for updates (creator only, not status).
 */
export const issueUpdateSchema = {
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 10, maxLength: 200 },
      description: { type: 'string', minLength: 20, maxLength: 2000 },
      category: categoryEnum,
      urgency: urgencyEnum,

      district: { type: 'string', maxLength: 100 },
      state: { type: 'string', maxLength: 100 },
      pincode: pincodeSchema,
      formatted_address: { type: 'string', maxLength: 500 },

      photos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string', maxLength: 1000 },
            caption: { type: 'string', maxLength: 200 },
          },
          required: ['url'],
        },
        maxItems: 5,
      },

      ministry_id: uuidSchema,
      department_id: uuidSchema,
      grievance_category_id: uuidSchema,

      official_name: { type: 'string', maxLength: 200 },
      official_designation: { type: 'string', maxLength: 200 },
      official_department: { type: 'string', maxLength: 200 },

      target_supporters: { type: 'integer', minimum: 100, maximum: 1000000 },
      campaign_deadline: { type: 'string', format: 'date-time' },
      is_anonymous: { type: 'boolean' },
      resolution_notes: { type: 'string', maxLength: 2000 },

      tracking_ids: trackingIdsSchema,
    },
    additionalProperties: false,
    minProperties: 1,
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: uuidSchema },
  },
};

/**
 * Filter Issues — query params for listing.
 */
export const issueFilterSchema = {
  querystring: {
    type: 'object',
    properties: {
      category: categoryEnum,
      urgency: urgencyEnum,
      status: statusEnum,
      district: { type: 'string' },
      state: { type: 'string' },
      is_campaign: { type: 'boolean' },
      search: { type: 'string', maxLength: 200 },
      // Day 26 — advanced filters
      min_support: { type: 'integer', minimum: 0, default: 0 },
      date_range: {
        type: 'string',
        enum: ['all', 'day', 'week', 'month', 'year'],
        default: 'all',
      },
      has_photos: { type: 'boolean' },
      verified_only: { type: 'boolean' },
      // Geo radius filter (requires both lat and lng)
      lat: { type: 'number', minimum: 6, maximum: 38 },
      lng: { type: 'number', minimum: 68, maximum: 98 },
      radius_km: { type: 'number', minimum: 1, maximum: 100, default: 10 },
      sort: {
        type: 'string',
        enum: [
          'newest',
          'oldest',
          'most_supported',
          'most_urgent',
          'most_viewed',
          'recently_updated',
          'trending',
          'oldest_unresolved',
        ],
        default: 'newest',
      },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

/**
 * Nearby Issues — geo query params.
 */
export const issueNearbySchema = {
  querystring: {
    type: 'object',
    required: ['lat', 'lng'],
    properties: {
      lat: { type: 'number', minimum: -90, maximum: 90 },
      lng: { type: 'number', minimum: -180, maximum: 180 },
      radius_km: { type: 'number', minimum: 1, maximum: 100, default: 10 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    },
  },
};

/**
 * Set Tracking ID — update a single key in the tracking_ids JSONB.
 */
export const setTrackingIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: uuidSchema },
  },
  body: {
    type: 'object',
    required: ['key', 'value'],
    properties: {
      key: {
        type: 'string',
        enum: [
          'cpgrams_id',
          'cpgrams_filed_at',
          'cpgrams_last_status',
          'state_portal_id',
          'state_portal_type',
          'nch_docket_id',
          'rti_registration_id',
          'rti_filed_at',
          'rti_response_due',
        ],
      },
      value: { type: 'string', maxLength: 200 },
    },
    additionalProperties: false,
  },
};

/**
 * Feed — ranked home-screen feed.
 * Modes: trending (default), nearby (requires lat/lng), latest, critical.
 */
export const feedQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['trending', 'nearby', 'latest', 'critical'],
        default: 'trending',
        description: 'Feed ranking mode',
      },
      // Geo params (required for nearby mode — enforced in service layer)
      lat: { type: 'number', minimum: -90, maximum: 90, description: 'Latitude' },
      lng: { type: 'number', minimum: -180, maximum: 180, description: 'Longitude' },
      radius_km: { type: 'number', minimum: 1, maximum: 100, default: 20 },
      // Optional content filters
      category: categoryEnum,
      urgency: urgencyEnum,
      state: { type: 'string', maxLength: 100 },
      district: { type: 'string', maxLength: 100 },
      is_campaign: { type: 'boolean' },
      // Pagination
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    },
  },
};

// ─── Government Taxonomy Schemas ─────────────────────────────────────────────

export const ministryFilterSchema = {
  querystring: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['central', 'state', 'ut'] },
    },
  },
};

export const searchSchema = {
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: { type: 'string', minLength: 2, maxLength: 100 },
    },
  },
};
