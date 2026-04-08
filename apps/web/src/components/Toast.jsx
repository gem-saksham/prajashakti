import { createContext, useContext, useState, useCallback, useRef } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_STYLES = {
  success: { bg: '#e8f8f3', border: '#34c987', icon: '✓', color: '#1a7a52' },
  error: { bg: '#fdf0f0', border: '#e05555', icon: '✕', color: '#b83232' },
  info: { bg: '#e8f4f8', border: 'var(--color-teal)', icon: 'ℹ', color: 'var(--color-teal)' },
  warning: { bg: '#fef6ec', border: 'var(--color-accent-orange)', icon: '!', color: '#b85c1a' },
};

const AUTO_DISMISS_MS = 4000;

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'info') => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: 'min(calc(100vw - 32px), 400px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const s = TYPE_STYLES[toast.type] ?? TYPE_STYLES.info;

  return (
    <div
      role="alert"
      style={{
        pointerEvents: 'all',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        animation: 'slideDown 0.25s ease',
        fontSize: 14,
        fontWeight: 500,
        color: s.color,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: s.border,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {s.icon}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Close notification"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: s.color,
          opacity: 0.6,
          fontSize: 16,
          lineHeight: 1,
          padding: '0 2px',
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
