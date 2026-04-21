/**
 * Support Weight Calculation
 *
 * Every support carries a weight that Phase 2's escalation engine uses
 * to decide when real thresholds are met. Raw counts are preserved in
 * issues.supporter_count; weighted sums are used for escalation decisions.
 *
 * Scale:
 *   0.1  — flagged/suspicious
 *   0.3  — brand-new account (< 24 h)
 *   0.5  — unverified citizen (default)
 *   0.7  — account < 7 days old
 *   1.0  — Aadhaar-verified citizen
 *   1.2  — community leader
 *   1.3  — moderator
 *   +rep  — up to +0.3 bonus from reputation score
 *   max   — 1.5
 */

export function computeSupportWeight(user) {
  if (!user) return 0.1;

  // Base weight by verification status
  let weight = user.isVerified ? 1.0 : 0.5;

  // Role upgrades (replace base, not add)
  if (user.role === 'leader') weight = Math.max(weight, 1.2);
  if (user.role === 'moderator') weight = Math.max(weight, 1.3);
  if (user.role === 'admin') weight = Math.max(weight, 1.3);

  // Reputation bonus — scaled: 10 000 rep = +0.3, capped
  const repBonus = Math.min(0.3, (user.reputationScore || 0) / 10000);
  weight += repBonus;

  // New account penalty applied last (hard cap)
  const ageMs = Date.now() - new Date(user.createdAt).getTime();
  const ageHours = ageMs / 3_600_000;

  if (ageHours < 24) weight = Math.min(weight, 0.3);
  else if (ageHours < 168) weight = Math.min(weight, 0.7); // < 7 days

  // Absolute bounds
  return parseFloat(Math.min(1.5, Math.max(0.1, weight)).toFixed(2));
}
