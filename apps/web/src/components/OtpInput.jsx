import { useRef, useEffect } from 'react';

const BOX_COUNT = 6;

/**
 * 6-digit OTP input.
 * Props:
 *   value       — string, current 0-6 digit value
 *   onChange    — (otp: string) => void
 *   onComplete  — (otp: string) => void  called when all 6 digits entered
 *   error       — boolean, triggers shake animation
 *   disabled    — boolean
 */
export default function OtpInput({ value = '', onChange, onComplete, error, disabled }) {
  const inputRefs = useRef([]);
  const digits = value.split('');

  // Auto-focus first empty box on mount
  useEffect(() => {
    const firstEmpty = digits.findIndex((d) => !d);
    const focusIdx = firstEmpty === -1 ? BOX_COUNT - 1 : firstEmpty;
    inputRefs.current[focusIdx]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setDigit(index, digit) {
    const arr = value.split('').slice(0, BOX_COUNT);
    arr[index] = digit;
    const newValue = arr.join('').slice(0, BOX_COUNT);
    onChange(newValue);
    if (newValue.length === BOX_COUNT) onComplete?.(newValue);
  }

  function handleKeyDown(e, index) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        // Clear current box
        setDigit(index, '');
      } else if (index > 0) {
        // Move back and clear previous
        setDigit(index - 1, '');
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (e.key === 'ArrowRight' && index < BOX_COUNT - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      return;
    }
  }

  function handleInput(e, index) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;

    // Paste of multiple digits
    if (raw.length > 1) {
      const filled = raw.slice(0, BOX_COUNT);
      onChange(filled);
      const nextFocus = Math.min(filled.length, BOX_COUNT - 1);
      inputRefs.current[nextFocus]?.focus();
      if (filled.length === BOX_COUNT) onComplete?.(filled);
      return;
    }

    const digit = raw[0];
    setDigit(index, digit);

    // Advance to next box
    if (index < BOX_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, BOX_COUNT);
    if (!pasted) return;
    onChange(pasted);
    const nextFocus = Math.min(pasted.length, BOX_COUNT - 1);
    inputRefs.current[nextFocus]?.focus();
    if (pasted.length === BOX_COUNT) onComplete?.(pasted);
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        animation: error ? 'shake 0.4s ease' : 'none',
      }}
      aria-label="OTP input"
    >
      {Array.from({ length: BOX_COUNT }, (_, i) => {
        const digit = digits[i] ?? '';
        const isFilled = !!digit;

        return (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={BOX_COUNT} // allows paste detection
            value={digit}
            disabled={disabled}
            autoComplete="one-time-code"
            aria-label={`Digit ${i + 1}`}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onInput={(e) => handleInput(e, i)}
            onChange={() => {}} // controlled — suppress React warning
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            style={{
              width: 48,
              height: 56,
              textAlign: 'center',
              fontSize: 24,
              fontWeight: 700,
              border: `2px solid ${error ? '#e05555' : isFilled ? 'var(--color-teal)' : 'var(--color-border)'}`,
              borderRadius: 12,
              background: isFilled ? 'rgba(20,137,122,0.07)' : 'var(--color-input-bg)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s, background 0.15s',
              caretColor: 'transparent',
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          />
        );
      })}
    </div>
  );
}
