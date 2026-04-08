import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Returns the correct API base URL depending on the runtime environment.
 *
 * Priority order:
 *  1. Production build       → app.json extra.apiUrl
 *  2. Android emulator       → 10.0.2.2 (loopback alias for host machine)
 *  3. Physical device (any)  → host IP derived from Metro's hostUri (set at bundle time)
 *  4. iOS simulator fallback → localhost
 */
export function getApiUrl() {
  const BASE_PATH = '/api/v1';
  const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

  if (!__DEV__) {
    return (extra.apiUrl ?? 'https://api.prajashakti.in') + BASE_PATH;
  }

  // Android emulator: 10.0.2.2 always maps to the host machine loopback
  if (Platform.OS === 'android' && !isPhysicalDevice()) {
    return `http://10.0.2.2:3000${BASE_PATH}`;
  }

  // Physical device (Android or iOS): Metro sets hostUri to "192.168.x.x:8081"
  // Use that IP to reach the dev machine over Wi-Fi.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    Constants.manifest?.debuggerHost ??
    null;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000${BASE_PATH}`;
  }

  // iOS simulator fallback
  return `http://localhost:3000${BASE_PATH}`;
}

/**
 * Returns the host machine's address as seen from the device.
 * Used to rewrite LocalStack URLs (which always contain "localhost") to
 * a reachable address for the current runtime environment.
 */
export function getDevHost() {
  if (!__DEV__) return null;

  if (Platform.OS === 'android' && !isPhysicalDevice()) {
    return '10.0.2.2';
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    Constants.manifest?.debuggerHost ??
    null;

  if (hostUri) return hostUri.split(':')[0];

  return 'localhost';
}

/**
 * Heuristic: if Metro hostUri IP is not the Android emulator loopback alias,
 * we're likely on a physical device.
 */
function isPhysicalDevice() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost ?? '';
  // Metro on emulator reports "10.0.2.2:8081"; physical device reports LAN IP
  return hostUri.length > 0 && !hostUri.startsWith('10.0.2.2') && !hostUri.startsWith('localhost');
}

export const API_URL = getApiUrl();
