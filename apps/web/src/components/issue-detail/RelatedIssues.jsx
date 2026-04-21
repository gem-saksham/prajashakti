/**
 * RelatedIssues — compact cards linking to related issues.
 */
import { useQuery } from '@tanstack/react-query';
import { issueApi } from '../../utils/api.js';

const URGENCY_COLOR = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#2563eb',
  low: '#16a34a',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function RelatedIssues({ issueId, onOpenIssue }) {
  const { data, isLoading } = useQuery({
    queryKey: ['related', issueId],
    queryFn: () => issueApi.getRelated(issueId, 3),
    staleTime: 300_000,
  });

  const issues = data?.data ?? [];

  if (isLoading) {
    return (
      <div>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#555',
            margin: '0 0 12px',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Related Issues
        </h3>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 64,
              borderRadius: 10,
              background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              marginBottom: 8,
            }}
          />
        ))}
      </div>
    );
  }

  if (!issues.length) return null;

  return (
    <div>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#555',
          margin: '0 0 12px',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Related Issues
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {issues.map((issue) => (
          <button
            key={issue.id}
            onClick={() => onOpenIssue?.(issue.id)}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: '#fff',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1a1a1a',
                  lineHeight: 1.3,
                  flex: 1,
                }}
              >
                {issue.title}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: URGENCY_COLOR[issue.urgency] ?? '#555',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {issue.urgency}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4, display: 'flex', gap: 10 }}>
              <span>👍 {(issue.supporterCount ?? 0).toLocaleString()}</span>
              {issue.district && <span>📍 {issue.district}</span>}
              <span>{timeAgo(issue.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
