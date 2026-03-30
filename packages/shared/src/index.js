// ─── Categories ───
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

// ─── Urgency Levels ───
export const URGENCY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

// ─── Issue Status ───
export const ISSUE_STATUS = {
  ACTIVE: 'active',
  TRENDING: 'trending',
  ESCALATED: 'escalated',
  RESPONDED: 'responded',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

// ─── User Roles ───
export const ROLES = {
  CITIZEN: 'citizen',
  VERIFIED_CITIZEN: 'verified_citizen',
  LEADER: 'leader',
  MODERATOR: 'moderator',
  OFFICIAL: 'official',
  ADMIN: 'admin',
};

// ─── Leader Tiers ───
export const LEADER_TIERS = {
  NONE: { name: 'Citizen', threshold: 0 },
  RISING_VOICE: { name: 'Rising Voice', threshold: 500 },
  COMMUNITY_LEADER: { name: 'Community Leader', threshold: 2000 },
  REGIONAL_LEADER: { name: 'Regional Leader', threshold: 10000 },
  NATIONAL_VOICE: { name: 'National Voice', threshold: 50000 },
};

// ─── Design System Colors ───
export const COLORS = {
  deepTeal: '#0D4F4F',
  teal: '#14897A',
  lightTeal: '#E0F2F1',
  crimson: '#DC143C',
  accentOrange: '#E07B3A',
  bg: '#F4F5F0',
  card: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#555555',
  textMuted: '#888888',
  border: 'rgba(0, 0, 0, 0.08)',
  inputBg: '#F8F8F6',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
};

// ─── Validation ───
export const VALIDATION = {
  PHONE_REGEX: /^[6-9]\d{9}$/,
  OTP_REGEX: /^\d{6}$/,
  NAME_MIN: 2,
  NAME_MAX: 100,
  BIO_MAX: 500,
  ISSUE_TITLE_MIN: 10,
  ISSUE_TITLE_MAX: 200,
  ISSUE_DESC_MAX: 2000,
  MAX_PHOTOS: 5,
  MAX_COMMENT_LENGTH: 1000,
  MAX_COMMENTS_PER_HOUR: 10,
  MAX_OTP_REQUESTS_PER_HOUR: 5,
};

// ─── Escalation Timeline (days) ───
export const ESCALATION_DAYS = {
  FIRST_REMINDER: 3,
  SUPERIOR_OFFICER: 7,
  DISTRICT_AUTHORITY: 14,
  MEDIA_TRIGGER: 21,
  MINISTRY_LEVEL: 30,
};

// ─── API Endpoints ───
export const ENDPOINTS = {
  HEALTH: '/api/health',
  REGISTER: '/api/users/register',
  VERIFY_OTP: '/api/users/verify-otp',
  LOGIN: '/api/users/login',
  ME: '/api/users/me',
};
