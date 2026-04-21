/**
 * ActivityTimeline (mobile) — synthetic escalation timeline derived from issue data.
 * Color-coded: green (done), amber (pending), red (overdue).
 * Mirrors web version in apps/web/src/components/issue-detail/ActivityTimeline.jsx.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '../../theme';

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
      status: 'done',
      icon: '📨',
    });
  } else {
    events.push({
      label: 'First reminder',
      description: 'Sends automatically on Day 3',
      date: null,
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
      description: 'Triggers on Day 14 if unresolved',
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
  done: { dot: '#16a34a', border: '#16a34a', line: '#bbf7d0', text: '#166534' },
  pending: { dot: '#d1d5db', border: '#d1d5db', line: '#f3f4f6', text: '#6b7280' },
  overdue: { dot: '#ef4444', border: '#ef4444', line: '#fee2e2', text: '#b91c1c' },
};

export default function ActivityTimeline({ issue }) {
  const events = buildEvents(issue);

  return (
    <View>
      <Text style={styles.heading}>Escalation Timeline</Text>
      <View>
        {events.map((ev, i) => {
          const s = STATUS_STYLE[ev.status];
          const isLast = i === events.length - 1;
          return (
            <View key={i} style={styles.row}>
              {/* Dot + line */}
              <View style={styles.gutter}>
                <View style={[styles.dot, { backgroundColor: s.dot, borderColor: s.border }]} />
                {!isLast ? <View style={[styles.line, { backgroundColor: s.line }]} /> : null}
              </View>

              {/* Content */}
              <View style={[styles.content, isLast ? null : { paddingBottom: 18 }]}>
                <View style={styles.eventHead}>
                  <Text style={[styles.eventLabel, { color: s.text }]} numberOfLines={2}>
                    {ev.icon} {ev.label}
                  </Text>
                  {ev.date ? (
                    <Text style={styles.eventDate} numberOfLines={1}>
                      {formatDate(ev.date)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.eventDesc}>{ev.description}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    color: '#555',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  row: { flexDirection: 'row', gap: 12 },
  gutter: { alignItems: 'center', flexShrink: 0, width: 14 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginTop: 3,
  },
  line: { width: 2, flex: 1, minHeight: 20 },
  content: { flex: 1 },
  eventHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  eventLabel: { fontSize: 13, fontWeight: FONTS.weight.semibold, flex: 1 },
  eventDate: { fontSize: 11, color: '#888', flexShrink: 0 },
  eventDesc: { fontSize: 12, color: '#888', marginTop: 2 },
});
