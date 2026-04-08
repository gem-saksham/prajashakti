/**
 * Indian phone number input.
 * Stores 10-digit raw value, displays with space after 5th digit.
 * Shows green checkmark when valid (10 digits, starts with 6-9).
 */
export default function PhoneInput({ value, onChange, error, disabled, autoFocus }) {
  const isValid = /^[6-9]\d{9}$/.test(value);

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(digits);
  }

  // Display format: "98765 43210"
  const display = value.length > 5 ? `${value.slice(0, 5)} ${value.slice(5)}` : value;

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: `1.5px solid ${error ? '#e05555' : isValid ? '#34c987' : 'var(--color-border)'}`,
          borderRadius: 12,
          background: disabled ? '#f0f0ee' : 'var(--color-input-bg)',
          transition: 'border-color 0.2s',
          overflow: 'hidden',
        }}
      >
        {/* +91 prefix */}
        <span
          style={{
            padding: '0 12px 0 14px',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            borderRight: '1.5px solid var(--color-border)',
            lineHeight: '52px',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          +91
        </span>

        <input
          type="tel"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="tel-national"
          placeholder="98765 43210"
          aria-label="Mobile number"
          aria-invalid={!!error}
          style={{
            flex: 1,
            padding: '0 14px',
            height: 52,
            border: 'none',
            background: 'transparent',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: 1,
            outline: 'none',
          }}
        />

        {/* Validation indicator */}
        {isValid && (
          <span
            aria-label="Valid phone number"
            style={{
              marginRight: 14,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#34c987',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ✓
          </span>
        )}
      </div>

      {error && (
        <p role="alert" style={{ margin: '6px 0 0 2px', fontSize: 13, color: '#e05555' }}>
          {error}
        </p>
      )}
    </div>
  );
}
