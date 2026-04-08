/**
 * Snake ↔ camelCase transform utilities.
 * Used by the model layer to convert DB rows (snake_case) to
 * application objects (camelCase) and vice versa.
 */

// "some_field_name" → "someFieldName"
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// "someFieldName" → "some_field_name"
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * Convert a plain object's keys from snake_case → camelCase.
 * Handles null/undefined gracefully.
 */
export function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [snakeToCamel(k), v]));
}

/**
 * Convert a plain object's keys from camelCase → snake_case.
 */
export function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [camelToSnake(k), v]));
}
