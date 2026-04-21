/**
 * FilterSummaryBar — active filter pills + result count + save search + copy link.
 */
import { useState } from 'react';

const DEFAULTS = {
  search: '',
  category: '',
  urgency: '',
  status: '',
  state: '',
  district: '',
  sort: 'newest',
  minSupport: 0,
  dateRange: 'all',
  hasPhotos: false,
  verifiedOnly: false,
};

const DATE_RANGE_LABELS = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

function buildPills(filters) {
  const pills = [];
  if (filters.search)
    pills.push({ key: 'search', label: `"${filters.search}"`, reset: { search: '' } });
  if (filters.category)
    pills.push({ key: 'category', label: filters.category, reset: { category: '' } });
  if (filters.urgency)
    pills.push({ key: 'urgency', label: `${filters.urgency} urgency`, reset: { urgency: '' } });
  if (filters.status)
    pills.push({
      key: 'status',
      label: filters.status.replace(/_/g, ' '),
      reset: { status: '' },
    });
  if (filters.state)
    pills.push({ key: 'state', label: filters.state, reset: { state: '', district: '' } });
  if (filters.district)
    pills.push({ key: 'district', label: filters.district, reset: { district: '' } });
  if (filters.sort && filters.sort !== 'newest')
    pills.push({
      key: 'sort',
      label: `↕ ${filters.sort.replace(/_/g, ' ')}`,
      reset: { sort: 'newest' },
    });
  if (filters.minSupport > 0)
    pills.push({
      key: 'minSupport',
      label: `≥${filters.minSupport} supporters`,
      reset: { minSupport: 0 },
    });
  if (filters.dateRange && filters.dateRange !== 'all')
    pills.push({
      key: 'dateRange',
      label: DATE_RANGE_LABELS[filters.dateRange] || filters.dateRange,
      reset: { dateRange: 'all' },
    });
  if (filters.hasPhotos)
    pills.push({ key: 'hasPhotos', label: 'Has photos', reset: { hasPhotos: false } });
  if (filters.verifiedOnly)
    pills.push({ key: 'verifiedOnly', label: 'Verified location', reset: { verifiedOnly: false } });
  if (filters.lat != null && filters.lng != null)
    pills.push({
      key: 'geo',
      label: `📍 Within ${filters.radiusKm || 10} km`,
      reset: { lat: null, lng: null },
    });
  return pills;
}

export default function FilterSummaryBar({
  filters,
  onUpdate,
  onClear,
  total,
  isLoading,
  onSaveSearch,
}) {
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [copied, setCopied] = useState(false);

  function handleCopyLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Fallback for browsers without clipboard API
        const el = document.createElement('input');
        el.value = window.location.href;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }

  const pills = buildPills(filters);
  if (pills.length === 0) return null;

  function handleSaveSubmit(e) {
    e.preventDefault();
    if (!saveName.trim()) return;
    onSaveSearch?.(saveName.trim(), { ...filters });
    setSaveName('');
    setSaving(false);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
        padding: '8px 0 2px',
      }}
    >
      {/* Result count */}
      <span style={{ fontSize: 12, color: '#888', fontWeight: 600, flexShrink: 0, marginRight: 2 }}>
        {isLoading
          ? '...'
          : `${(total || 0).toLocaleString('en-IN')} result${total !== 1 ? 's' : ''}`}
      </span>

      {/* Active filter pills */}
      {pills.map((p) => (
        <span
          key={p.key}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px 3px 10px',
            background: 'rgba(13,79,79,0.08)',
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 600,
            color: '#0D4F4F',
            whiteSpace: 'nowrap',
          }}
        >
          {p.label}
          <button
            onClick={() => onUpdate(p.reset)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(13,79,79,0.5)',
              fontSize: 11,
              lineHeight: 1,
              padding: '0 2px',
              display: 'flex',
              alignItems: 'center',
            }}
            title={`Remove ${p.label} filter`}
          >
            ✕
          </button>
        </span>
      ))}

      {/* Clear all */}
      <button
        onClick={onClear}
        style={{
          background: 'none',
          border: 'none',
          fontSize: 12,
          color: '#DC143C',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '3px 6px',
          whiteSpace: 'nowrap',
        }}
      >
        Clear all
      </button>

      {/* Copy shareable link */}
      <button
        onClick={handleCopyLink}
        style={{
          background: 'none',
          border: '1px solid rgba(0,0,0,0.15)',
          borderRadius: 99,
          fontSize: 12,
          color: copied ? '#14897A' : '#888',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '3px 10px',
          whiteSpace: 'nowrap',
          transition: 'color 0.2s',
        }}
      >
        {copied ? '✓ Copied!' : '🔗 Copy link'}
      </button>

      {/* Save search */}
      {onSaveSearch && !saving && (
        <button
          onClick={() => setSaving(true)}
          style={{
            background: 'none',
            border: '1px solid rgba(20,137,122,0.3)',
            borderRadius: 99,
            fontSize: 12,
            color: '#14897A',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: '3px 10px',
            whiteSpace: 'nowrap',
          }}
        >
          💾 Save search
        </button>
      )}

      {saving && (
        <form onSubmit={handleSaveSubmit} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            autoFocus
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Search name…"
            style={{
              padding: '4px 10px',
              border: '1.5px solid #14897A',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
              width: 140,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '4px 10px',
              background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setSaving(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 12,
              color: '#888',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
