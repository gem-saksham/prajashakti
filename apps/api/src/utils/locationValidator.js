/**
 * Location validation utilities for Indian coordinates and administrative data.
 */

// Approximate bounding box for India (mainland + islands)
// Southernmost: Indira Point (6.4°N), Northernmost: Dras (35.7°N)
// Westernmost: Sir Creek (68.0°E), Easternmost: Kibithu (97.4°E)
const INDIA_BOUNDS = {
  minLat: 6.0,
  maxLat: 37.0,
  minLng: 68.0,
  maxLng: 97.5,
};

/**
 * Check whether a coordinate pair falls within India's approximate bounding box.
 * This is a quick pre-filter — not a definitive geofence.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
export function isWithinIndia(lat, lng) {
  return (
    lat >= INDIA_BOUNDS.minLat &&
    lat <= INDIA_BOUNDS.maxLat &&
    lng >= INDIA_BOUNDS.minLng &&
    lng <= INDIA_BOUNDS.maxLng
  );
}

/**
 * Validate an Indian PIN code.
 * Format: 6 digits, first digit 1–8 (0 and 9 are not assigned).
 *
 * @param {string|number} pincode
 * @returns {boolean}
 */
export function isValidPincode(pincode) {
  if (pincode === null || pincode === undefined) return false;
  const str = String(pincode).trim();
  return /^[1-8]\d{5}$/.test(str);
}

// Canonical state name map — covers abbreviations + common variants
const STATE_NAME_MAP = {
  // Abbreviations → canonical
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CG: 'Chhattisgarh',
  CT: 'Chhattisgarh',
  GA: 'Goa',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JK: 'Jammu and Kashmir',
  JH: 'Jharkhand',
  KA: 'Karnataka',
  KL: 'Kerala',
  MP: 'Madhya Pradesh',
  MH: 'Maharashtra',
  MN: 'Manipur',
  ML: 'Meghalaya',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  OR: 'Odisha',
  PB: 'Punjab',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TS: 'Telangana',
  TG: 'Telangana',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UK: 'Uttarakhand',
  UA: 'Uttarakhand',
  WB: 'West Bengal',
  // Union Territories
  AN: 'Andaman and Nicobar Islands',
  CH: 'Chandigarh',
  DN: 'Dadra and Nagar Haveli and Daman and Diu',
  DD: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  PY: 'Puducherry',
  // Common Nominatim / informal variants
  'ANDHRA PRADESH': 'Andhra Pradesh',
  'ARUNACHAL PRADESH': 'Arunachal Pradesh',
  'JAMMU & KASHMIR': 'Jammu and Kashmir',
  'JAMMU AND KASHMIR': 'Jammu and Kashmir',
  KARNATAKA: 'Karnataka',
  MAHARASHTRA: 'Maharashtra',
  ODISHA: 'Odisha',
  ORISSA: 'Odisha',
  UTTARAKHAND: 'Uttarakhand',
  UTTARANCHAL: 'Uttarakhand',
  'WEST BENGAL': 'West Bengal',
  DELHI: 'Delhi',
  'NCT OF DELHI': 'Delhi',
  'NATIONAL CAPITAL TERRITORY OF DELHI': 'Delhi',
  PUDUCHERRY: 'Puducherry',
  PONDICHERRY: 'Puducherry',
};

/**
 * Normalise a state name to its canonical form.
 * Handles abbreviations ("UP"), case variants, and historical names.
 * Returns the input unchanged if no mapping is found.
 *
 * @param {string} name
 * @returns {string}
 */
export function normalizeStateName(name) {
  if (!name) return name;
  const upper = name.trim().toUpperCase();
  return STATE_NAME_MAP[upper] || name.trim();
}

/**
 * Reverse lookup: given a canonical state name, return its two-letter code.
 *
 * @param {string} name
 * @returns {string|null}
 */
export function stateNameToCode(name) {
  if (!name) return null;
  const canonical = normalizeStateName(name);
  for (const [code, cname] of Object.entries(STATE_NAME_MAP)) {
    // Only return 2-letter codes
    if (code.length === 2 && cname === canonical) return code;
  }
  return null;
}
