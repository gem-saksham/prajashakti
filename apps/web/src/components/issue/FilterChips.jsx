const CATEGORY_CHIPS = [
  { value: '', label: 'All' },
  { value: 'Infrastructure', label: '🛣️ Infrastructure' },
  { value: 'Healthcare', label: '🏥 Healthcare' },
  { value: 'Education', label: '🎓 Education' },
  { value: 'Safety', label: '🛡️ Safety' },
  { value: 'Environment', label: '🌿 Environment' },
  { value: 'Agriculture', label: '🌾 Agriculture' },
  { value: 'Corruption', label: '⚖️ Corruption' },
  { value: 'Other', label: '• Other' },
];

const URGENCY_CHIPS = [
  { value: 'critical', label: '🚨 Critical' },
  { value: 'high', label: '⚠️ High' },
  { value: 'medium', label: '● Medium' },
  { value: 'low', label: '○ Low' },
];

const STATUS_CHIPS = [
  { value: 'active', label: 'Active' },
  { value: 'trending', label: '🔥 Trending' },
  { value: 'escalated', label: '🔺 Escalated' },
  { value: 'officially_resolved', label: '✓ Resolved' },
];

function Chip({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '6px 14px',
        borderRadius: 99,
        border: `1.5px solid ${selected ? '#0D4F4F' : 'rgba(0,0,0,0.12)'}`,
        background: selected ? '#0D4F4F' : '#fff',
        color: selected ? '#fff' : '#333',
        fontSize: 13,
        fontWeight: selected ? 700 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

export default function FilterChips({ filters, onUpdate }) {
  function toggle(key, value) {
    onUpdate({ [key]: filters[key] === value ? '' : value });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Category row */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {CATEGORY_CHIPS.map((c) => (
          <Chip
            key={c.value}
            label={c.label}
            selected={filters.category === c.value}
            onClick={() => onUpdate({ category: c.value })}
          />
        ))}
      </div>

      {/* Urgency + Status row */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {URGENCY_CHIPS.map((c) => (
          <Chip
            key={c.value}
            label={c.label}
            selected={filters.urgency === c.value}
            onClick={() => toggle('urgency', c.value)}
          />
        ))}
        <div
          style={{
            width: 1,
            background: 'rgba(0,0,0,0.1)',
            flexShrink: 0,
            margin: '0 4px',
          }}
        />
        {STATUS_CHIPS.map((c) => (
          <Chip
            key={c.value}
            label={c.label}
            selected={filters.status === c.value}
            onClick={() => toggle('status', c.value)}
          />
        ))}
      </div>
    </div>
  );
}
