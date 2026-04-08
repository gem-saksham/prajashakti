import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../utils/api.js';
import PhoneInput from '../components/PhoneInput.jsx';
import OtpInput from '../components/OtpInput.jsx';
import Spinner from '../components/Spinner.jsx';
import { useToast } from '../components/Toast.jsx';

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ size = 56 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size * 0.88} viewBox="0 0 56 50" fill="none">
        <polygon
          points="28,47 3,5 53,5"
          fill="rgba(220,20,60,0.08)"
          stroke="#DC143C"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <text
          x="28"
          y="30"
          textAnchor="middle"
          fontSize="11"
          fontWeight="800"
          fill="#DC143C"
          fontFamily="'Noto Sans', sans-serif"
        >
          प्र
        </text>
      </svg>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: 'var(--color-deep-teal)',
          letterSpacing: '-0.5px',
        }}
      >
        प्रजाशक्ति
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        Power of the Citizens
      </div>
    </div>
  );
}

// ─── Primary button ───────────────────────────────────────────────────────────

function PrimaryButton({ children, onClick, disabled, loading, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        padding: '15px 20px',
        background:
          disabled || loading ? 'rgba(13,79,79,0.35)' : 'linear-gradient(135deg, #0D4F4F, #14897A)',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        fontSize: 16,
        fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'opacity 0.2s, transform 0.1s',
        minHeight: 52,
        fontFamily: 'inherit',
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled && !loading) e.currentTarget.style.transform = 'scale(0.97)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {loading ? <Spinner size="small" color="#fff" /> : children}
    </button>
  );
}

function SecondaryButton({ children, onClick, style = {} }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px 20px',
        background: 'transparent',
        color: 'var(--color-teal)',
        border: '1.5px solid var(--color-teal)',
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.15s, transform 0.1s',
        minHeight: 52,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(20,137,122,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.97)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </button>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function AuthCard({ children, style = {} }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--color-card)',
        borderRadius: 20,
        padding: '36px 28px 32px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.09)',
        border: '1px solid var(--color-border)',
        animation: 'fadeIn 0.3s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Resend countdown ─────────────────────────────────────────────────────────

function ResendTimer({ onResend }) {
  const [secs, setSecs] = useState(30);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  if (secs > 0) {
    return (
      <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        Resend OTP in <strong>{secs}s</strong>
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        onResend();
        setSecs(30);
      }}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-teal)',
        fontFamily: 'inherit',
        padding: 0,
      }}
    >
      Resend OTP
    </button>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEP_WELCOME = 'welcome';
const STEP_PHONE = 'phone';
const STEP_OTP = 'otp';

// ─── Main component ───────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState(STEP_WELCOME);
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneErr, setPhoneErr] = useState('');
  const [otpErr, setOtpErr] = useState(false);
  const [otpErrMsg, setOtpErrMsg] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [nameErr, setNameErr] = useState('');

  const nameRef = useRef(null);

  const isPhoneValid = /^[6-9]\d{9}$/.test(phone);
  const isNameValid = name.trim().length >= 2;

  // Auto-focus name when switching to register on phone step
  useEffect(() => {
    if (step === STEP_PHONE && mode === 'register') {
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [step, mode]);

  function goToPhone(selectedMode) {
    setMode(selectedMode);
    setPhone('');
    setName('');
    setPhoneErr('');
    setNameErr('');
    setStep(STEP_PHONE);
  }

  async function handleSendOtp() {
    if (mode === 'register' && !isNameValid) {
      setNameErr('Please enter your name (at least 2 characters)');
      return;
    }
    if (!isPhoneValid) return;

    setLoading(true);
    setPhoneErr('');
    try {
      let res;
      if (mode === 'register') {
        res = await authApi.register(phone, name.trim());
      } else {
        res = await authApi.login(phone);
      }
      if (res.debug_otp) setDebugOtp(res.debug_otp);
      showToast('OTP sent to your number', 'success');
      setOtp('');
      setOtpErr(false);
      setOtpErrMsg('');
      setStep(STEP_OTP);
    } catch (err) {
      const msg = err?.error?.message ?? 'Something went wrong. Please try again.';
      setPhoneErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(code) {
    if (code.length !== 6) return;
    setLoading(true);
    setOtpErr(false);
    setOtpErrMsg('');
    try {
      const res = await authApi.verifyOtp(phone, code);
      // Brief success flash then login
      showToast('Welcome to प्रजाशक्ति! 🎉', 'success');
      login(res.accessToken, res.user, res.refreshToken);
    } catch (err) {
      const msg = err?.error?.message ?? 'Invalid OTP. Please try again.';
      setOtpErr(true);
      setOtpErrMsg(msg);
      setOtp('');
      // Clear error shake after animation completes
      setTimeout(() => setOtpErr(false), 500);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      let res;
      if (mode === 'register') {
        res = await authApi.register(phone, name.trim());
      } else {
        res = await authApi.login(phone);
      }
      if (res.debug_otp) setDebugOtp(res.debug_otp);
      showToast('New OTP sent', 'info');
    } catch {
      showToast('Could not resend OTP. Please try again.', 'error');
    }
  }

  // ── Step: Welcome ──────────────────────────────────────────────────────────

  if (step === STEP_WELCOME) {
    return (
      <PageShell>
        <AuthCard>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Logo />
          </div>

          <p
            style={{
              textAlign: 'center',
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              marginBottom: 28,
              lineHeight: 1.6,
            }}
          >
            Hold your local government accountable.
            <br />
            One citizen at a time.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PrimaryButton onClick={() => goToPhone('register')}>
              I'm new here — Register
            </PrimaryButton>
            <SecondaryButton onClick={() => goToPhone('login')}>
              I have an account — Login
            </SecondaryButton>
          </div>

          <p
            style={{
              textAlign: 'center',
              marginTop: 24,
              fontSize: 12,
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
            }}
          >
            By continuing, you agree to our Terms of Service.
            <br />
            No spam. No corporate funding. Ever.
          </p>
        </AuthCard>
      </PageShell>
    );
  }

  // ── Step: Phone input ──────────────────────────────────────────────────────

  if (step === STEP_PHONE) {
    const canSubmit = isPhoneValid && (mode === 'login' || isNameValid);

    return (
      <PageShell>
        <AuthCard>
          {/* Back */}
          <button
            onClick={() => setStep(STEP_WELCOME)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              fontSize: 13,
              fontFamily: 'inherit',
              padding: '0 0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            aria-label="Go back"
          >
            ← Back
          </button>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Logo size={40} />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>
            {mode === 'register' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--color-text-muted)',
              textAlign: 'center',
              marginBottom: 28,
            }}
          >
            {mode === 'register'
              ? 'Enter your name and phone number'
              : 'Enter your phone number to continue'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: 6,
                  }}
                >
                  Your name
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameErr('');
                  }}
                  placeholder="Arjun Sharma"
                  autoComplete="name"
                  aria-label="Full name"
                  aria-invalid={!!nameErr}
                  maxLength={100}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: `1.5px solid ${nameErr ? '#e05555' : 'var(--color-border)'}`,
                    borderRadius: 12,
                    background: 'var(--color-input-bg)',
                    fontSize: 16,
                    fontFamily: 'inherit',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                  }}
                />
                {nameErr && (
                  <p role="alert" style={{ margin: '5px 0 0 2px', fontSize: 13, color: '#e05555' }}>
                    {nameErr}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 6,
                }}
              >
                Mobile number
              </label>
              <PhoneInput
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  setPhoneErr('');
                }}
                error={phoneErr}
                disabled={loading}
                autoFocus={mode === 'login'}
              />
            </div>

            <PrimaryButton
              onClick={handleSendOtp}
              disabled={!canSubmit}
              loading={loading}
              style={{ marginTop: 4 }}
            >
              Send OTP
            </PrimaryButton>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              onClick={() => showToast('Google sign-in coming soon!', 'info')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--color-text-muted)',
                fontFamily: 'inherit',
              }}
            >
              Use Google instead →
            </button>
          </div>
        </AuthCard>
      </PageShell>
    );
  }

  // ── Step: OTP ──────────────────────────────────────────────────────────────

  const formattedPhone =
    phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : `+91 ${phone}`;

  return (
    <PageShell>
      {/* Dev OTP banner */}
      {debugOtp && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a1a',
            color: '#f0f0f0',
            padding: '8px 20px',
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 9998,
            letterSpacing: 1,
          }}
        >
          Dev OTP: <span style={{ color: '#34c987', fontSize: 15 }}>{debugOtp}</span>
        </div>
      )}

      <AuthCard>
        {/* Back */}
        <button
          onClick={() => {
            setStep(STEP_PHONE);
            setOtp('');
            setOtpErr(false);
            setOtpErrMsg('');
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: 13,
            fontFamily: 'inherit',
            padding: '0 0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          aria-label="Change phone number"
        >
          ← Change number
        </button>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(20,137,122,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 24,
            }}
          >
            📱
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Enter OTP</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            We sent a 6-digit code to
            <br />
            <strong style={{ color: 'var(--color-text-primary)' }}>{formattedPhone}</strong>
          </p>
        </div>

        <OtpInput
          value={otp}
          onChange={setOtp}
          onComplete={handleVerifyOtp}
          error={otpErr}
          disabled={loading}
        />

        {otpErrMsg && (
          <p
            role="alert"
            aria-live="assertive"
            style={{
              textAlign: 'center',
              marginTop: 12,
              fontSize: 13,
              color: '#e05555',
              fontWeight: 500,
            }}
          >
            {otpErrMsg}
          </p>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <Spinner size="large" />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <ResendTimer onResend={handleResend} />
        </div>
      </AuthCard>
    </PageShell>
  );
}

// ─── Page shell (centers the card) ───────────────────────────────────────────

function PageShell({ children }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'var(--color-bg)',
      }}
    >
      {children}
    </div>
  );
}
