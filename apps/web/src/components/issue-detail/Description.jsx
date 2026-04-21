/**
 * Description — issue body text with "Read more / less" at 500 chars.
 * Auto-links plain URLs safely (no eval, no innerHTML with scripts).
 */
import { useState } from 'react';

const TRUNCATE_AT = 500;

/** Split text into plain-text and URL segments. */
function parseText(text) {
  const URL_RE = /https?:\/\/[^\s<>"']+/g;
  const parts = [];
  let last = 0;
  let match;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) });
    parts.push({ type: 'url', value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

export default function Description({ text }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const displayText =
    !expanded && text.length > TRUNCATE_AT ? text.slice(0, TRUNCATE_AT) + '…' : text;

  const parts = parseText(displayText);

  return (
    <div>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          color: '#333',
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {parts.map((part, i) =>
          part.type === 'url' ? (
            <a
              key={i}
              href={part.value}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#14897A', textDecoration: 'underline' }}
            >
              {part.value}
            </a>
          ) : (
            <span key={i}>{part.value}</span>
          ),
        )}
      </p>

      {text.length > TRUNCATE_AT && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            marginTop: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#14897A',
            fontSize: 13,
            fontWeight: 600,
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
