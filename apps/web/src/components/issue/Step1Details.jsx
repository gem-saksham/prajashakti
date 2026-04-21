import { useState, useRef, useEffect } from 'react';
import { aiApi } from '../../utils/api.js';

const CATEGORIES = [
  { id: 'Infrastructure', label: 'Infrastructure', emoji: '🛣️' },
  { id: 'Healthcare', label: 'Healthcare', emoji: '🏥' },
  { id: 'Education', label: 'Education', emoji: '📚' },
  { id: 'Safety', label: 'Safety', emoji: '🚨' },
  { id: 'Environment', label: 'Environment', emoji: '🌳' },
  { id: 'Agriculture', label: 'Agriculture', emoji: '🌾' },
  { id: 'Corruption', label: 'Corruption', emoji: '⚖️' },
  { id: 'Other', label: 'Other', emoji: '📌' },
];

const URGENCIES = [
  {
    id: 'low',
    label: 'Low',
    color: '#888',
    bg: 'rgba(136,136,136,0.1)',
    desc: 'Minor issue, no immediate danger',
  },
  {
    id: 'medium',
    label: 'Medium',
    color: '#2B7CB8',
    bg: 'rgba(43,124,184,0.1)',
    desc: 'Significant inconvenience to residents',
  },
  {
    id: 'high',
    label: 'High',
    color: '#E07B3A',
    bg: 'rgba(224,123,58,0.1)',
    desc: 'Serious impact on daily life',
  },
  {
    id: 'critical',
    label: 'Critical',
    color: '#DC143C',
    bg: 'rgba(220,20,60,0.1)',
    desc: 'Immediate danger to life or property',
  },
];

function CharCounter({ current, max, minGood = null }) {
  const pct = current / max;
  const color =
    pct > 0.95
      ? '#DC143C'
      : pct > 0.8
        ? '#E07B3A'
        : minGood && current < minGood
          ? '#888'
          : '#14897A';
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {current} / {max}
    </span>
  );
}

export default function Step1Details({ draft, onUpdate, location }) {
  const titleRef = useRef(null);
  const [aiModal, setAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState('');

  // Auto-focus title on mount
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Auto-grow textarea
  function autoGrow(e) {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }

  async function handleAiDraft() {
    setAiModal(true);
    setAiLoading(true);
    setAiError('');
    setAiResult('');
    try {
      const res = await aiApi.generateDraft({
        title: draft.title,
        category: draft.category,
        district: location?.district,
        state: location?.state,
      });
      setAiResult(res.data.description);
    } catch (err) {
      setAiError(
        err?.error?.message || 'Could not generate draft. Please write your own description.',
      );
    } finally {
      setAiLoading(false);
    }
  }

  function acceptDraft() {
    onUpdate({ description: aiResult });
    setAiModal(false);
    setAiResult('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Tip */}
      <div
        style={{
          background: 'rgba(20,137,122,0.07)',
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 13,
          color: '#14897A',
          lineHeight: 1.5,
        }}
      >
        💡 <strong>Tip:</strong> Specific titles get more support. Try "Pothole on MG Road since
        June" instead of "Bad road".
      </div>

      {/* Title */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <label style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
            Issue Title <span style={{ color: '#DC143C' }}>*</span>
          </label>
          <CharCounter current={draft.title.length} max={200} minGood={10} />
        </div>
        <input
          ref={titleRef}
          type="text"
          value={draft.title}
          onChange={(e) => onUpdate({ title: e.target.value.slice(0, 200) })}
          placeholder="What is the issue? Be specific and brief."
          maxLength={200}
          style={{
            width: '100%',
            padding: '13px 14px',
            border: `1.5px solid ${draft.title.length >= 10 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.12)'}`,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 500,
            fontFamily: 'inherit',
            color: '#1a1a1a',
            background: '#f8f8f6',
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#14897A';
            e.target.style.boxShadow = '0 0 0 3px rgba(20,137,122,0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(0,0,0,0.12)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {draft.title.length > 0 && draft.title.length < 10 && (
          <p style={{ fontSize: 12, color: '#e05555', marginTop: 4 }}>
            Title must be at least 10 characters
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 6,
          }}
        >
          <label style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
            Description <span style={{ color: '#DC143C' }}>*</span>
          </label>
          <CharCounter current={draft.description.length} max={2000} minGood={20} />
        </div>
        <textarea
          value={draft.description}
          onChange={(e) => {
            onUpdate({ description: e.target.value.slice(0, 2000) });
            autoGrow(e);
          }}
          onInput={autoGrow}
          placeholder="Describe the issue in detail. What, where, since when, who is affected?"
          maxLength={2000}
          rows={4}
          style={{
            width: '100%',
            padding: '13px 14px',
            border: '1.5px solid rgba(0,0,0,0.12)',
            borderRadius: 12,
            fontSize: 14,
            fontFamily: 'inherit',
            color: '#1a1a1a',
            background: '#f8f8f6',
            outline: 'none',
            resize: 'none',
            lineHeight: 1.6,
            transition: 'border-color 0.15s, box-shadow 0.15s',
            minHeight: 100,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#14897A';
            e.target.style.boxShadow = '0 0 0 3px rgba(20,137,122,0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(0,0,0,0.12)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {draft.description.length > 0 && draft.description.length < 20 && (
          <p style={{ fontSize: 12, color: '#e05555', marginTop: 4 }}>
            Description must be at least 20 characters
          </p>
        )}

        {/* AI Draft button */}
        <button
          onClick={handleAiDraft}
          disabled={draft.title.length < 5}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            background: draft.title.length < 5 ? '#f0f0ee' : 'rgba(20,137,122,0.08)',
            border: `1.5px solid ${draft.title.length < 5 ? 'transparent' : 'rgba(20,137,122,0.25)'}`,
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 600,
            color: draft.title.length < 5 ? '#aaa' : '#14897A',
            cursor: draft.title.length < 5 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s',
          }}
        >
          ✨ Help me describe this
        </button>
      </div>

      {/* Category */}
      <div>
        <label
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1a1a1a',
            display: 'block',
            marginBottom: 10,
          }}
        >
          Category <span style={{ color: '#DC143C' }}>*</span>
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}
        >
          {CATEGORIES.map((cat) => {
            const selected = draft.category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onUpdate({ category: cat.id })}
                style={{
                  padding: '12px 10px',
                  borderRadius: 12,
                  border: `1.5px solid ${selected ? '#14897A' : 'rgba(0,0,0,0.1)'}`,
                  background: selected ? 'rgba(20,137,122,0.08)' : '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: selected ? 700 : 500,
                    color: selected ? '#0D4F4F' : '#333',
                  }}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Urgency */}
      <div>
        <label
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1a1a1a',
            display: 'block',
            marginBottom: 10,
          }}
        >
          Urgency Level
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {URGENCIES.map((u) => {
            const selected = draft.urgency === u.id;
            return (
              <button
                key={u.id}
                onClick={() => onUpdate({ urgency: u.id })}
                title={u.desc}
                style={{
                  padding: '8px 16px',
                  borderRadius: 99,
                  border: `1.5px solid ${selected ? u.color : 'rgba(0,0,0,0.1)'}`,
                  background: selected ? u.bg : '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: selected ? 700 : 500,
                  color: selected ? u.color : '#555',
                  transition: 'all 0.15s',
                  flex: '1 0 auto',
                }}
              >
                {u.label}
              </button>
            );
          })}
        </div>
        {draft.urgency && (
          <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
            {URGENCIES.find((u) => u.id === draft.urgency)?.desc}
          </p>
        )}
      </div>

      {/* AI Draft Modal */}
      {aiModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAiModal(false);
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px',
              width: '100%',
              maxWidth: 640,
              margin: '0 auto',
              maxHeight: '80vh',
              overflowY: 'auto',
              animation: 'slideUp 0.25s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0D4F4F' }}>✨ AI Draft</h3>
              <button
                onClick={() => setAiModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#888',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {aiLoading && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#888' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>✨</div>
                <p style={{ fontSize: 14 }}>Generating a draft description...</p>
              </div>
            )}

            {aiError && (
              <div
                style={{
                  background: '#fff5f5',
                  border: '1px solid rgba(220,20,60,0.2)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 14,
                  color: '#c0392b',
                }}
              >
                {aiError}
              </div>
            )}

            {aiResult && !aiLoading && (
              <>
                <div
                  style={{
                    background: 'rgba(20,137,122,0.06)',
                    border: '1.5px solid rgba(20,137,122,0.2)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: '#1a1a1a',
                    marginBottom: 16,
                  }}
                >
                  {aiResult}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={acceptDraft}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Use this draft
                  </button>
                  <button
                    onClick={handleAiDraft}
                    style={{
                      padding: '12px 16px',
                      background: '#f4f5f0',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      color: '#555',
                    }}
                  >
                    Try again
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
