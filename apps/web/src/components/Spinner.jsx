const SIZES = { small: 20, large: 40 };

export default function Spinner({ size = 'small', color = 'var(--color-teal)' }) {
  const px = SIZES[size] ?? size;
  const border = size === 'small' ? 2 : 3;

  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: px,
        height: px,
        borderRadius: '50%',
        border: `${border}px solid rgba(0,0,0,0.08)`,
        borderTopColor: color,
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

export function FullPageLoader() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--color-bg)',
      }}
    >
      {/* Crimson inverted triangle logo */}
      <div style={{ marginBottom: 8 }}>
        <svg width="52" height="46" viewBox="0 0 52 46" fill="none">
          <polygon
            points="26,44 2,4 50,4"
            fill="none"
            stroke="#DC143C"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <text
            x="26"
            y="28"
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            fill="#DC143C"
            fontFamily="'Noto Sans', sans-serif"
          >
            प्र
          </text>
        </svg>
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--color-deep-teal)',
          letterSpacing: '-0.3px',
        }}
      >
        प्रजाशक्ति
      </div>
      <Spinner size="large" />
    </div>
  );
}
