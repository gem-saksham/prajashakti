import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ENABLED: 'auth:biometric_enabled',
  PHONE: 'auth:biometric_phone', // last successfully authed phone (10-digit)
};

// ─── Capability checks ────────────────────────────────────────────────────────

/**
 * Returns true if the device hardware supports biometrics AND the user has
 * at least one biometric enrolled (Face ID, fingerprint, iris).
 */
export async function isBiometricAvailable() {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

/**
 * Returns the types of biometrics available on this device.
 * e.g. [FACIAL_RECOGNITION, FINGERPRINT]
 */
export async function getAvailableTypes() {
  return LocalAuthentication.supportedAuthenticationTypesAsync();
}

/**
 * Returns a human-readable label for the primary biometric on this device.
 * iOS: "Face ID" or "Touch ID"
 * Android: "Fingerprint" or "Biometrics"
 */
export async function getBiometricLabel() {
  const types = await getAvailableTypes();
  const AuthType = LocalAuthentication.AuthenticationType;
  if (types.includes(AuthType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(AuthType.FINGERPRINT)) return 'Fingerprint';
  return 'Biometrics';
}

// ─── User preference ──────────────────────────────────────────────────────────

export async function isBiometricEnabled() {
  const val = await AsyncStorage.getItem(KEYS.ENABLED);
  return val === 'true';
}

export async function setBiometricEnabled(phone) {
  await AsyncStorage.multiSet([
    [KEYS.ENABLED, 'true'],
    [KEYS.PHONE, phone],
  ]);
}

export async function disableBiometric() {
  await AsyncStorage.multiRemove([KEYS.ENABLED, KEYS.PHONE]);
}

export async function getBiometricPhone() {
  return AsyncStorage.getItem(KEYS.PHONE);
}

// ─── Authentication ───────────────────────────────────────────────────────────

/**
 * Prompt the user for biometric authentication.
 *
 * @param {string} [reason]  Prompt message shown on the biometric dialog.
 * @returns {{ success: boolean, error?: string }}
 */
export async function authenticate(reason = 'Verify your identity to log in') {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    return { success: result.success, error: result.error };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
