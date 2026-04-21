import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StoryCard({ story, issueId, onHelpful, onRemove }) {
  const { user } = useAuth();
  const [voted, setVoted] = useState(story.userVotedHelpful ?? false);
  const [count, setCount] = useState(story.helpfulCount ?? 0);
  const [loading, setLoading] = useState(false);

  const isOwn = user && !story.isAnonymous && story.author?.id === user.id;

  async function handleHelpful() {
    if (!user || loading) return;
    setLoading(true);
    try {
      const result = await onHelpful(story.id);
      if (result) {
        setVoted(result.userVoted);
        setCount(result.helpfulCount);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: story.isAnonymous
              ? 'rgba(0,0,0,0.1)'
              : 'linear-gradient(135deg, #0D4F4F, #14897A)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {story.isAnonymous ? '?' : (story.author?.name?.[0] ?? '?')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
            {story.isAnonymous ? 'Anonymous Citizen' : (story.author?.name ?? 'Citizen')}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>{timeAgo(story.createdAt)}</div>
        </div>
        {story.isAnonymous && (
          <span
            style={{
              fontSize: 11,
              color: '#888',
              background: 'rgba(0,0,0,0.06)',
              borderRadius: 99,
              padding: '2px 8px',
            }}
          >
            Anonymous
          </span>
        )}
      </div>

      {/* Content */}
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#333' }}>{story.content}</p>

      {/* Photos */}
      {story.photos?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {story.photos.map((p, i) => (
            <img
              key={i}
              src={p.url}
              alt={p.caption || ''}
              style={{
                height: 72,
                width: 96,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
        <button
          onClick={handleHelpful}
          disabled={!user || loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 12px',
            borderRadius: 99,
            border: `1.5px solid ${voted ? '#14897A' : 'rgba(0,0,0,0.12)'}`,
            background: voted ? 'rgba(20,137,122,0.08)' : 'transparent',
            color: voted ? '#14897A' : '#555',
            fontSize: 13,
            fontWeight: 500,
            cursor: user ? 'pointer' : 'default',
          }}
        >
          👍 Helpful · {count}
        </button>
        {isOwn && (
          <button
            onClick={() => onRemove(story.id)}
            style={{
              marginLeft: 'auto',
              padding: '5px 10px',
              borderRadius: 99,
              border: '1.5px solid rgba(220,20,60,0.2)',
              background: 'transparent',
              color: '#DC143C',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
