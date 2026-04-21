/**
 * DepartmentCard — shows ministry / department / grievance category taxonomy.
 */
export default function DepartmentCard({ issue }) {
  const hasAny = issue.ministry?.name || issue.department?.name || issue.grievanceCategory?.name;
  if (!hasAny) return null;

  return (
    <div
      style={{
        background: '#f8fffe',
        border: '1px solid rgba(14,137,122,0.15)',
        borderRadius: 12,
        padding: '14px 16px',
      }}
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#0D4F4F',
          margin: '0 0 10px',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        🏛️ Responsible Department
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {issue.ministry?.name && (
          <div style={{ fontSize: 13 }}>
            <span style={{ color: '#888', marginRight: 6 }}>Ministry:</span>
            <strong style={{ color: '#1a1a1a' }}>{issue.ministry.name}</strong>
          </div>
        )}
        {issue.department?.name && (
          <div style={{ fontSize: 13 }}>
            <span style={{ color: '#888', marginRight: 6 }}>Department:</span>
            <strong style={{ color: '#1a1a1a' }}>{issue.department.name}</strong>
          </div>
        )}
        {issue.grievanceCategory?.name && (
          <div style={{ fontSize: 13 }}>
            <span style={{ color: '#888', marginRight: 6 }}>Category:</span>
            <span style={{ color: '#14897A', fontWeight: 600 }}>
              {issue.grievanceCategory.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
