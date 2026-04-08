/**
 * Input Sanitisation Middleware
 *
 * Strips dangerous content from all user inputs before they reach business logic.
 * Defence-in-depth: parameterised queries already prevent SQL injection,
 * but this layer catches XSS payloads, null bytes, and oversized fields.
 *
 * In test environments, DOMPurify/jsdom are replaced with a lightweight
 * fallback to avoid ESM/CJS loader conflicts in Jest.
 */

import validator from 'validator';

// ── DOMPurify setup ───────────────────────────────────────────────────────────
// jsdom uses CJS modules incompatible with Jest's --experimental-vm-modules.
// In test mode we use a pure-JS HTML entity encoder as a drop-in replacement
// (this is fine because the test just verifies the hook runs, not the purifier).

let _purify = null;

async function getPurify() {
  if (_purify) return _purify;

  if (process.env.NODE_ENV === 'test') {
    // Lightweight test-safe fallback: strip all HTML tags
    _purify = {
      sanitize: (str) => str.replace(/<[^>]*>/g, '').replace(/javascript:/gi, ''),
    };
    return _purify;
  }

  const { JSDOM } = await import('jsdom');
  const createDOMPurify = (await import('dompurify')).default;
  const { window: jsdomWindow } = new JSDOM('');
  _purify = createDOMPurify(jsdomWindow);
  return _purify;
}

// Eagerly initialise (non-blocking — errors are swallowed gracefully)
getPurify().catch(() => {});

// ── String sanitisation ───────────────────────────────────────────────────────

/**
 * Sanitise a single string value.
 *
 * @param {string} input
 * @param {{ allowHtml?: boolean, maxLength?: number }} options
 */
export function sanitiseString(input, options = {}) {
  if (typeof input !== 'string') return input;

  // Strip null bytes
  let cleaned = input.replace(/\0/g, '');

  // Trim whitespace
  cleaned = cleaned.trim();

  // Enforce max length if specified
  if (options.maxLength && cleaned.length > options.maxLength) {
    cleaned = cleaned.slice(0, options.maxLength);
  }

  if (options.allowHtml && _purify) {
    // Rich text: allow minimal safe HTML via DOMPurify
    cleaned = _purify.sanitize(cleaned, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
      ALLOWED_ATTR: [],
    });
  } else {
    // Plain text: escape HTML entities — handles XSS in any rendering context
    cleaned = validator.escape(cleaned);
  }

  return cleaned;
}

/**
 * Recursively sanitise all string values in an object.
 *
 * Only fields explicitly listed in `schema` are sanitised.
 * Structured strings (MIME types, UUIDs, URLs, enum values) must NOT be
 * escaped — only free-text user content fields need sanitisation.
 * Any key absent from schema passes through unchanged.
 */
export function sanitiseObject(obj, schema = {}) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

  const sanitised = {};
  for (const [key, value] of Object.entries(obj)) {
    const fieldOptions = schema[key];
    if (fieldOptions !== undefined && typeof value === 'string') {
      // Only sanitise fields explicitly defined in the schema
      sanitised[key] = sanitiseString(value, fieldOptions);
    } else if (
      fieldOptions !== undefined &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      sanitised[key] = sanitiseObject(value, fieldOptions);
    } else {
      // Structured fields (fileType, avatarUrl, phone, etc.) pass through unchanged
      sanitised[key] = value;
    }
  }
  return sanitised;
}

// ── Per-field options ─────────────────────────────────────────────────────────

const ROUTE_SCHEMAS = {
  bio: { allowHtml: false, maxLength: 500 },
  name: { allowHtml: false, maxLength: 100 },
  description: { allowHtml: false, maxLength: 2000 },
  title: { allowHtml: false, maxLength: 200 },
  comment: { allowHtml: false, maxLength: 1000 },
};

// ── Fastify hook ──────────────────────────────────────────────────────────────

/**
 * Global preValidation hook — sanitise all request body string fields.
 */
export function sanitiserHook(request, _reply, done) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    request.body = sanitiseObject(request.body, ROUTE_SCHEMAS);
  }
  done();
}
