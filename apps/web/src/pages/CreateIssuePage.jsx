import { useState, useEffect } from 'react';
import { useIssueDraft } from '../hooks/useIssueDraft.js';
import Step1Details from '../components/issue/Step1Details.jsx';
import Step2Location from '../components/issue/Step2Location.jsx';
import Step3Department from '../components/issue/Step3Department.jsx';
import Step4Photos from '../components/issue/Step4Photos.jsx';
import { issueApi, photoApi, uploadToS3 } from '../utils/api.js';

const STEPS = [
  { number: 1, title: "What's the issue?", subtitle: 'Title, description, category, urgency' },
  { number: 2, title: 'Where is it?', subtitle: 'Location with map preview' },
  { number: 3, title: "Who's responsible?", subtitle: 'Suggested departments & officials' },
  { number: 4, title: 'Add evidence', subtitle: 'Photos (optional but powerful)' },
];

// ── Resume draft banner ────────────────────────────────────────────────────────

function ResumeBanner({ onResume, onDiscard }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid rgba(20,137,122,0.3)',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        animation: 'fadeIn 0.25s ease',
        marginBottom: 16,
      }}
    >
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#0D4F4F', marginBottom: 2 }}>
          📝 Resume your draft?
        </p>
        <p style={{ fontSize: 12, color: '#888' }}>You have an unfinished issue from earlier.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onDiscard}
          style={{
            padding: '7px 12px',
            background: '#f4f5f0',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: '#888',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Discard
        </button>
        <button
          onClick={onResume}
          style={{
            padding: '7px 14px',
            background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Resume →
        </button>
      </div>
    </div>
  );
}

// ── Progress indicator ─────────────────────────────────────────────────────────

function ProgressBar({ step, total }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        {STEPS.map((s) => {
          const done = s.number < step;
          const active = s.number === step;
          return (
            <div
              key={s.number}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: done ? '#14897A' : active ? '#0D4F4F' : 'rgba(0,0,0,0.1)',
                  color: done || active ? '#fff' : '#888',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: done ? 14 : 13,
                  fontWeight: 700,
                  transition: 'all 0.25s',
                  boxShadow: active ? '0 2px 8px rgba(13,79,79,0.25)' : 'none',
                }}
              >
                {done ? '✓' : s.number}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#0D4F4F' : done ? '#14897A' : '#aaa',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  maxWidth: 60,
                }}
              >
                {s.title.split(' ').slice(0, 2).join(' ')}
              </span>
            </div>
          );
        })}
        {/* Connecting lines */}
        <style>{`
          .step-connectors {
            position: absolute;
            top: 15px;
            left: 0;
            right: 0;
            height: 2px;
            background: rgba(0,0,0,0.08);
            z-index: -1;
          }
        `}</style>
      </div>
      {/* Progress bar track */}
      <div
        style={{
          height: 3,
          background: 'rgba(0,0,0,0.07)',
          borderRadius: 99,
          overflow: 'hidden',
          marginTop: 4,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${((step - 1) / (total - 1)) * 100}%`,
            background: 'linear-gradient(90deg, #0D4F4F, #14897A)',
            borderRadius: 99,
            transition: 'width 0.35s ease',
          }}
        />
      </div>
    </div>
  );
}

// ── Submit overlay ─────────────────────────────────────────────────────────────

function SubmitOverlay({ state }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,79,79,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {state === 'submitting' && (
        <>
          <div
            style={{
              width: 60,
              height: 60,
              border: '4px solid rgba(255,255,255,0.2)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginBottom: 20,
            }}
          />
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Submitting your issue...</p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 6 }}>
            Uploading photos and publishing
          </p>
        </>
      )}
      {state === 'success' && (
        <div style={{ textAlign: 'center', animation: 'scaleIn 0.3s ease' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              marginBottom: 20,
              marginLeft: 'auto',
              marginRight: 'auto',
              boxShadow: '0 0 40px rgba(255,255,255,0.3)',
            }}
          >
            ✅
          </div>
          <p style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>Issue published!</p>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, marginTop: 8 }}>
            Your issue is live. Citizens can now support it.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CreateIssuePage({ onSuccess, onCancel }) {
  const {
    step,
    setStep,
    draft,
    updateDraft,
    saveDraft,
    clearDraft,
    stepValid,
    hasSavedDraft,
    dismissSavedDraft,
    resumeSavedDraft,
  } = useIssueDraft();
  const [submitState, setSubmitState] = useState(null); // null | 'submitting' | 'success'
  const [submitError, setSubmitError] = useState('');
  const [photoProgress, setPhotoProgress] = useState({});
  const [discardConfirm, setDiscardConfirm] = useState(false);

  const currentStep = STEPS[step - 1];
  const isLastStep = step === STEPS.length;
  const canProceed = stepValid[step];

  // Handle Esc key
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') setDiscardConfirm(true);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function goNext() {
    if (step < STEPS.length) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goBack() {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setDiscardConfirm(true);
    }
  }

  async function handleSubmit() {
    setSubmitError('');
    setSubmitState('submitting');

    try {
      // 1. Create issue
      const issueBody = {
        title: draft.title,
        description: draft.description,
        category: draft.category,
        urgency: draft.urgency,
        location_lat: draft.location.lat,
        location_lng: draft.location.lng,
        district: draft.location.district || undefined,
        state: draft.location.state || undefined,
        pincode: draft.location.pincode || undefined,
        formatted_address: draft.location.displayName || undefined,
        is_anonymous: false,
      };
      if (draft.ministryId) issueBody.ministry_id = draft.ministryId;
      if (draft.departmentId) issueBody.department_id = draft.departmentId;
      if (draft.suggestedOfficialIds?.length) {
        issueBody.suggested_official_ids = draft.suggestedOfficialIds;
      }

      const issueRes = await issueApi.create(issueBody);
      const issueId = issueRes.data.id;

      // 2. Upload photos (with progress tracking)
      const photosWithFiles = draft.photos.filter((p) => p.file);
      for (const photo of photosWithFiles) {
        try {
          // Request pre-signed URL
          const urlRes = await photoApi.requestUploadUrl(issueId, photo.type);
          const { uploadUrl, fileKey } = urlRes.data;

          // Upload to S3 with progress
          await uploadToS3(uploadUrl, photo.file, (pct) => {
            setPhotoProgress((prev) => ({ ...prev, [photo.id]: pct }));
          });

          // Confirm upload
          await photoApi.confirm(issueId, fileKey);
        } catch {
          // Non-fatal: continue with other photos
        }
      }

      // 3. Success
      setSubmitState('success');
      clearDraft();

      // 4. Redirect after 2s
      setTimeout(() => {
        setSubmitState(null);
        onSuccess?.(issueId);
      }, 2000);
    } catch (err) {
      setSubmitState(null);
      const code = err?.error?.code;
      if (code === 'TOO_MANY_REQUESTS' || err?.status === 429) {
        setSubmitError("You're submitting too quickly. Please wait a moment and try again.");
      } else if (err?.status === 400) {
        setSubmitError(
          err?.error?.message || 'Some fields are invalid. Please check and try again.',
        );
      } else if (err?.status === 401) {
        setSubmitError('Your session expired. Please login again.');
      } else {
        setSubmitError('Failed to submit. Your draft is saved. Please try again.');
      }
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 120 }}>
      {/* Overlay during submit */}
      {submitState && <SubmitOverlay state={submitState} />}

      {/* Discard confirm */}
      {discardConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: '24px 20px',
              width: '100%',
              maxWidth: 340,
              animation: 'scaleIn 0.2s ease',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: '#1a1a1a' }}>
              Discard issue?
            </h3>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.5, marginBottom: 20 }}>
              Your progress will be saved as a draft and you can resume it within 24 hours.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  clearDraft();
                  onCancel?.();
                }}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: '#fff',
                  border: '1.5px solid rgba(220,20,60,0.3)',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#DC143C',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Discard
              </button>
              <button
                onClick={() => {
                  saveDraft();
                  onCancel?.();
                }}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Save draft
              </button>
            </div>
            <button
              onClick={() => setDiscardConfirm(false)}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '9px',
                background: 'none',
                border: 'none',
                fontSize: 13,
                color: '#888',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Continue editing
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 0' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <button
            onClick={goBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              padding: '6px 10px 6px 0',
              color: '#555',
            }}
            aria-label="Go back"
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0D4F4F', lineHeight: 1.2 }}>
              Report an Issue
            </h1>
          </div>
          <button
            onClick={() => {
              saveDraft();
              onCancel?.();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#888',
              fontFamily: 'inherit',
              fontWeight: 600,
              padding: '6px 0 6px 10px',
            }}
          >
            Save & exit
          </button>
        </div>

        {/* Resume draft banner */}
        {hasSavedDraft && (
          <ResumeBanner onResume={resumeSavedDraft} onDiscard={dismissSavedDraft} />
        )}

        {/* Progress */}
        <div style={{ marginBottom: 24 }}>
          <ProgressBar step={step} total={STEPS.length} />
        </div>

        {/* Step header */}
        <div
          style={{
            marginBottom: 24,
            animation: 'slideLeft 0.25s ease',
            key: step,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              color: '#14897A',
              marginBottom: 4,
            }}
          >
            Step {step} of {STEPS.length}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0D4F4F', marginBottom: 4 }}>
            {currentStep.title}
          </h2>
          <p style={{ fontSize: 13, color: '#888' }}>{currentStep.subtitle}</p>
        </div>

        {/* Step content */}
        <div key={step} style={{ animation: 'slideLeft 0.25s ease' }}>
          {step === 1 && (
            <Step1Details draft={draft} onUpdate={updateDraft} location={draft.location} />
          )}
          {step === 2 && <Step2Location draft={draft} onUpdate={updateDraft} />}
          {step === 3 && <Step3Department draft={draft} onUpdate={updateDraft} />}
          {step === 4 && <Step4Photos draft={draft} onUpdate={updateDraft} />}
        </div>

        {/* Submit error */}
        {submitError && (
          <div
            style={{
              background: '#fff5f5',
              border: '1px solid rgba(220,20,60,0.25)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              color: '#c0392b',
              marginTop: 20,
              lineHeight: 1.5,
            }}
          >
            ⚠️ {submitError}
          </div>
        )}

        {/* Photo warning on step 4 */}
        {step === 4 && draft.photos.length === 0 && (
          <div
            style={{
              background: 'rgba(224,123,58,0.08)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              color: '#E07B3A',
              marginTop: 16,
              lineHeight: 1.5,
            }}
          >
            ℹ️ No photos added yet. Photos are optional but significantly increase the chances of
            action.
          </div>
        )}
      </div>

      {/* Sticky bottom button row */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid rgba(0,0,0,0.07)',
          padding: '12px 16px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          display: 'flex',
          gap: 12,
          zIndex: 100,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        }}
      >
        {/* Back */}
        <button
          onClick={goBack}
          style={{
            flex: step === 1 ? 'none' : 1,
            padding: '14px 20px',
            background: 'transparent',
            border: '1.5px solid rgba(0,0,0,0.15)',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            color: '#555',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: step === 1 ? 'none' : 'block',
          }}
        >
          ← Back
        </button>

        {/* Next / Submit */}
        {!isLastStep ? (
          <button
            onClick={goNext}
            disabled={!canProceed}
            style={{
              flex: 1,
              padding: '14px',
              background: canProceed
                ? 'linear-gradient(135deg, #0D4F4F, #14897A)'
                : 'rgba(0,0,0,0.08)',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 800,
              color: canProceed ? '#fff' : '#aaa',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            Next Step →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed || submitState === 'submitting'}
            style={{
              flex: 1,
              padding: '14px',
              background:
                !canProceed || submitState === 'submitting'
                  ? 'rgba(0,0,0,0.08)'
                  : 'linear-gradient(135deg, #DC143C, #c01234)',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 800,
              color: !canProceed || submitState === 'submitting' ? '#aaa' : '#fff',
              cursor: !canProceed || submitState === 'submitting' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            🚩 Submit Issue
          </button>
        )}
      </div>
    </div>
  );
}
