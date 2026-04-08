import SkeletonCard from '../components/SkeletonCard.jsx';

export default function FeedPlaceholder({ onGoToProfile }) {
  return (
    <div
      style={{
        padding: '24px 16px',
        maxWidth: 820,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Coming soon banner */}
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.08)',
          padding: '28px 24px',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease',
        }}
      >
        {/* Illustration */}
        <div style={{ fontSize: 52, marginBottom: 12 }}>📢</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0D4F4F', marginBottom: 8 }}>
          Issue Feed — Coming in Sprint 3
        </h2>
        <p
          style={{
            fontSize: 14,
            color: '#555',
            lineHeight: 1.7,
            maxWidth: 380,
            margin: '0 auto 20px',
          }}
        >
          The civic issues feed, escalation system, and RTI generator are being built. Below is a
          preview of what's coming.
        </p>
        <button
          onClick={onGoToProfile}
          style={{
            background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 22px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Complete your profile →
        </button>
      </div>

      {/* Skeleton preview cards */}
      <p
        style={{
          fontSize: 12,
          color: '#888',
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          paddingLeft: 4,
        }}
      >
        Preview — Issue cards will look like this
      </p>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
