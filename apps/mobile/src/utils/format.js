// Format: 9876543210 → "98765 43210"
export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '').slice(0, 10);
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
}

// Mask: 9876543210 → "98765 •••••"
export function maskPhone(phone) {
  if (!phone || phone.length < 10) return phone;
  return `${phone.slice(0, 5)} •••••`;
}

// Countdown: 90 → "1:30"
export function formatCountdown(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
