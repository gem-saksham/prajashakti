/**
 * ActivityTimeline — synthetic escalation timeline derived from issue data.
 * Color-coded: green (done), amber (pending), red (overdue).
 */

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildEvents(issue) {
  const days = daysSince(issue.createdAt);
  const events = [];

  events.push({
    label: 'Issue reported',
    description: `Filed by ${issue.isAnonymous ? 'anonymous citizen' : (issue.creator?.name ?? 'citizen')}`,
    date: issue.createdAt,
    status: 'done',
    icon: '📋',
  });

  if (days >= 3) {
    events.push({
      label: 'First reminder sent',
      description: 'Automated reminder to responsible department',
      date: null,
      offsetDays: 3,
      status: 'done',
      icon: '📨',
    });
  } else {
    events.push({
      label: 'First reminder',
      description: 'Sends automatically on Day 3',
      date: null,
      offsetDays: 3,
      status: 'pending',
      icon: '📨',
    });
  }

  if (issue.escalationLevel >= 1 || days >= 7) {
    events.push({
      label: 'Escalated to Superior Officer',
      description: issue.escalatedAt
        ? `Escalated on ${formatDate(issue.escalatedAt)}`
        : 'Auto-escalated after 7 days',
      date: issue.escalatedAt ?? null,
      status: issue.escalationLevel >= 1 ? 'done' : days >= 7 ? 'overdue' : 'pending',
      icon: '⬆️',
    });
  } else {
    events.push({
      label: 'Escalate to Superior Officer',
      description: `Triggers on Day 7 if unresolved (${7 - days}d remaining)`,
      date: null,
      status: 'pending',
      icon: '⬆️',
    });
  }

  if (issue.escalationLevel >= 2 || days >= 14) {
    events.push({
      label: 'Escalated to District Collector',
      description: 'Issue escalated to district level authority',
      date: null,
      status: issue.escalationLevel >= 2 ? 'done' : 'overdue',
      icon: '🏛️',
    });
  } else {
    events.push({
      label: 'Escalate to District Collector',
      description: `Triggers on Day 14 if unresolved`,
      date: null,
      status: 'pending',
      icon: '🏛️',
    });
  }

  const isResolved = ['officially_resolved', 'citizen_verified_resolved'].includes(issue.status);
  if (isResolved) {
    events.push({
      label: 'Issue Resolved',
      description: issue.resolutionNotes ?? 'Marked as resolved',
      date: issue.resolvedAt,
      status: 'done',
      icon: '✅',
    });
  }

  return events;
}

const STATUS_STYLE = {
  done: { dot: '#16a34a', line: '#bbf7d0', text: '#166534' },
  pending: { dot: '#d1d5db', line: '#f3f4f6', text: '#6b7280' },
  overdue: { dot: '#ef4444', line: '#fee2e2', text: '#b91c1c' },
};

export default function ActivityTimeline({ issue }) {
  const events = buildEvents(issue);

  return (
    <div>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#555',
          margin: '0 0 14px',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Escalation Timeline
      </h3>
      <div style={{ position: 'relative' }}>
        {events.map((ev, i) => {
          const s = STATUS_STYLE[ev.status];
          const isLast = i === events.length - 1;
          return (
            <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
              {/* Connector line + dot */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: s.dot,
                    border: `2px solid ${ev.status === 'done' ? '#16a34a' : ev.status === 'overdue' ? '#ef4444' : '#d1d5db'}`,
                    marginTop: 3,
                    flexShrink: 0,
                  }}
                />
                {!isLast && (
                  <div style={{ width: 2, flex: 1, background: s.line, minHeight: 20 }} />
                )}
              </div>

              {/* Content */}
              <div style={{ paddingBottom: isLast ? 0 : 18, flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.text }}>
                    {ev.icon} {ev.label}
                  </div>
                  {ev.date && (
                    <div
                      style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {formatDate(ev.date)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{ev.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
