/**
 * Client-side XSS prevention helpers.
 *
 * React already escapes JSX content by default — never use dangerouslySetInnerHTML
 * for user-generated content. These helpers cover edge cases:
 *   - URLs in user content (links in bios, profile URLs)
 *   - Displaying multi-line user text safely
 */

/**
 * Validate and sanitise a URL from user content.
 * Rejects javascript: and data: URIs which can execute code.
 * Prepends https:// if no protocol is given.
 *
 * @param {string | null | undefined} url
 * @returns {string} Safe URL, or empty string if invalid/dangerous
 */
export function safeUrl(url) {
  if (!url || typeof url !== 'string') return '';

  const cleaned = url.trim();
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();

  // Reject dangerous URI schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return '';
  }

  // Require http/https for external links
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    // Could be a relative path — allow those, they don't execute code
    if (cleaned.startsWith('/') || cleaned.startsWith('./') || cleaned.startsWith('../')) {
      return cleaned;
    }
    // Treat as external URL needing a protocol
    return `https://${cleaned}`;
  }

  return cleaned;
}

/**
 * Render multi-line user text safely.
 * Instead of injecting <br> tags (XSS vector), use CSS white-space: pre-wrap.
 * Returns an inline style object to apply to the containing element.
 */
export const multilineTextStyle = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
};
