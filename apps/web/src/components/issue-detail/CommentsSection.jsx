/**
 * CommentsSection — scaffold placeholder. Full implementation in a later sprint.
 */
export default function CommentsSection({ commentCount }) {
  return (
    <div
      style={{
        background: '#f9fafb',
        border: '1px dashed rgba(0,0,0,0.1)',
        borderRadius: 12,
        padding: '16px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 20, marginBottom: 6 }}>💬</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>
        {commentCount > 0
          ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}`
          : 'No comments yet'}
      </div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
        Comments coming in a future update
      </div>
    </div>
  );
}
