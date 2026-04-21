/**
 * PrajaShakti Issue Type Definitions
 *
 * JSDoc type annotations for the issue entity and related structures.
 * These serve as documentation and IDE auto-complete targets.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * @typedef {'Infrastructure'|'Healthcare'|'Education'|'Safety'|'Environment'|'Agriculture'|'Corruption'|'Other'} IssueCategory
 */

/**
 * @typedef {'critical'|'high'|'medium'|'low'} IssueUrgency
 */

/**
 * @typedef {'active'|'trending'|'escalated'|'officially_resolved'|'citizen_verified_resolved'|'citizen_disputed'|'closed'} IssueStatus
 */

// ─── Sub-objects ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} IssueLocation
 * @property {number} locationLat - Latitude (DECIMAL 10,8)
 * @property {number} locationLng - Longitude (DECIMAL 11,8)
 * @property {string|null} district
 * @property {string|null} state
 * @property {string|null} pincode - 6-digit Indian pincode
 * @property {string|null} formattedAddress - Full human-readable address
 */

/**
 * @typedef {Object} IssuePhoto
 * @property {string} url - S3 URL or media proxy path
 * @property {string} [caption]
 * @property {string} [uploadedAt] - ISO timestamp
 */

/**
 * Phase 2 bridge: external tracking IDs for government portals.
 * Each field is populated when the issue is filed/tracked on that platform.
 *
 * @typedef {Object} TrackingIds
 * @property {string} [cpgrams_id] - CPGRAMS registration number (e.g., "DARPG/E/2026/0001234")
 * @property {string} [cpgrams_filed_at] - ISO timestamp when filed on CPGRAMS
 * @property {string} [cpgrams_last_status] - Latest CPGRAMS status (e.g., "under_examination")
 * @property {string} [state_portal_id] - State grievance portal ID (e.g., "HRYCMW/2026/00567")
 * @property {string} [state_portal_type] - Portal identifier (e.g., "haryana_cm_window")
 * @property {string} [nch_docket_id] - National Consumer Helpline docket
 * @property {string} [rti_registration_id] - RTI application number
 * @property {string} [rti_filed_at] - ISO timestamp when RTI was filed
 * @property {string} [rti_response_due] - ISO timestamp when RTI response is due (30 days)
 */

/**
 * @typedef {Object} IssueMinistry
 * @property {string} id - UUID
 * @property {string} name - Ministry name
 * @property {string} code - Short code (e.g., "MOHFW")
 */

/**
 * @typedef {Object} IssueDepartment
 * @property {string} id - UUID
 * @property {string} name - Department name
 * @property {string} code - Short code
 */

/**
 * @typedef {Object} IssueGrievanceCategory
 * @property {string} id - UUID
 * @property {string} name - Category name
 * @property {string} slug - URL-safe slug
 */

/**
 * @typedef {Object} IssueCreator
 * @property {string} id - User UUID
 * @property {string} name - Display name (or "Anonymous Citizen" if is_anonymous)
 * @property {string|null} avatarUrl
 * @property {string|null} district
 * @property {string|null} state
 */

// ─── Main Entity ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Issue
 * @property {string} id - UUID
 * @property {string} title - 10-200 characters
 * @property {string} description - Max 2000 characters
 *
 * @property {IssueCategory} category - User-facing category
 * @property {IssueUrgency} urgency - Urgency level
 *
 * @property {IssueMinistry|null} ministry - Linked ministry (null until classified)
 * @property {string|null} ministryId - UUID FK
 * @property {IssueDepartment|null} department - Linked department (null until classified)
 * @property {string|null} departmentId - UUID FK
 * @property {IssueGrievanceCategory|null} grievanceCategory - Linked CPGRAMS category
 * @property {string|null} grievanceCategoryId - UUID FK
 *
 * @property {string|null} officialName - Free-text official name
 * @property {string|null} officialDesignation - Free-text designation
 * @property {string|null} officialDepartment - Free-text department
 *
 * @property {number} locationLat
 * @property {number} locationLng
 * @property {string|null} district
 * @property {string|null} state
 * @property {string|null} pincode
 * @property {string|null} formattedAddress
 *
 * @property {IssuePhoto[]} photos - Array of photo objects
 *
 * @property {IssueStatus} status
 *
 * @property {number} supporterCount - Denormalized count
 * @property {number} commentCount - Denormalized count
 * @property {number} shareCount - Denormalized count
 * @property {number} viewCount - Denormalized count
 *
 * @property {boolean} isCampaign - Whether promoted to a campaign
 * @property {number|null} targetSupporters - Campaign target
 * @property {string|null} campaignDeadline - ISO timestamp
 * @property {number} escalationLevel - 0-5 escalation ladder position
 * @property {string|null} escalatedAt - ISO timestamp of last escalation
 *
 * @property {TrackingIds} trackingIds - Phase 2 external tracking IDs
 *
 * @property {string|null} resolvedAt - ISO timestamp
 * @property {string|null} resolutionNotes - Text notes on resolution
 * @property {number|null} discrepancyScore - Phase 2 Reality Check score (0-100)
 *
 * @property {string} createdBy - User UUID
 * @property {IssueCreator} creator - Nested creator info
 * @property {boolean} isAnonymous
 * @property {boolean} isVerifiedLocation
 *
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

// ─── API Input Shapes ────────────────────────────────────────────────────────

/**
 * @typedef {Object} CreateIssueInput
 * @property {string} title - 10-200 chars
 * @property {string} description - Max 2000 chars
 * @property {IssueCategory} category
 * @property {IssueUrgency} [urgency='medium']
 * @property {number} locationLat
 * @property {number} locationLng
 * @property {string} [district]
 * @property {string} [state]
 * @property {string} [pincode]
 * @property {string} [formattedAddress]
 * @property {IssuePhoto[]} [photos=[]]
 * @property {string} [ministryId]
 * @property {string} [departmentId]
 * @property {string} [grievanceCategoryId]
 * @property {string} [officialName]
 * @property {string} [officialDesignation]
 * @property {string} [officialDepartment]
 * @property {boolean} [isAnonymous=false]
 */

/**
 * @typedef {Object} UpdateIssueInput
 * @property {string} [title]
 * @property {string} [description]
 * @property {IssueCategory} [category]
 * @property {IssueUrgency} [urgency]
 * @property {string} [ministryId]
 * @property {string} [departmentId]
 * @property {string} [grievanceCategoryId]
 * @property {string} [officialName]
 * @property {string} [officialDesignation]
 * @property {string} [officialDepartment]
 * @property {string} [district]
 * @property {string} [state]
 * @property {string} [pincode]
 * @property {string} [formattedAddress]
 * @property {IssuePhoto[]} [photos]
 * @property {number} [targetSupporters]
 * @property {string} [campaignDeadline]
 * @property {boolean} [isAnonymous]
 * @property {string} [resolutionNotes]
 */

/**
 * @typedef {Object} IssueFilters
 * @property {IssueStatus} [status]
 * @property {IssueCategory} [category]
 * @property {IssueUrgency} [urgency]
 * @property {string} [district]
 * @property {string} [state]
 * @property {string} [createdBy] - UUID
 * @property {boolean} [isCampaign]
 * @property {string} [search] - Free-text search on title/description
 */

/**
 * @typedef {Object} IssuePagination
 * @property {number} [page=1]
 * @property {number} [limit=20]
 * @property {'newest'|'oldest'|'most_supported'|'most_urgent'|'most_viewed'} [sort='newest']
 */

export default {};
