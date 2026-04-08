const shimmerStyle = {
  background: 'linear-gradient(90deg, #ececec 25%, #f5f5f5 50%, #ececec 75%)',
  backgroundSize: '600px 100%',
  animation: 'shimmer 1.5s infinite linear',
  borderRadius: 6,
};

function Bone({ width = '100%', height = 14, style = {} }) {
  return <div style={{ ...shimmerStyle, width, height, borderRadius: 6, ...style }} />;
}

/**
 * SkeletonCard — animated shimmer placeholder mimicking an issue card.
 * Used in loading states and FeedPlaceholder.
 */
export default function SkeletonCard() {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Title + badge row */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
      >
        <Bone width="60%" height={16} />
        <Bone width={52} height={22} style={{ borderRadius: 99 }} />
      </div>

      {/* Body text lines */}
      <Bone width="90%" height={12} />
      <Bone width="75%" height={12} />

      {/* Stats pills */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Bone width={64} height={22} style={{ borderRadius: 99 }} />
        <Bone width={64} height={22} style={{ borderRadius: 99 }} />
        <Bone width={64} height={22} style={{ borderRadius: 99 }} />
      </div>

      {/* Progress bar */}
      <Bone width="100%" height={6} style={{ borderRadius: 99 }} />
    </div>
  );
}
