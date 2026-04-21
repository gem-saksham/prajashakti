import * as Location from 'expo-location';
import { ensurePermission } from '../utils/permissions';
import { api } from '../utils/api';

/**
 * Get the device's current GPS position + reverse-geocode it via the API.
 * Returns location object or null on denial/error.
 */
export async function getCurrentLocation() {
  const granted = await ensurePermission('location');
  if (!granted) return null;

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000,
    });

    const { latitude, longitude } = location.coords;

    const res = await api(`/location/reverse?lat=${latitude}&lng=${longitude}`);
    const address = res?.location ?? {};

    return {
      lat: latitude,
      lng: longitude,
      district: address.district ?? '',
      state: address.state ?? '',
      pincode: address.pincode ?? '',
      displayName: address.formattedAddress ?? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    };
  } catch (error) {
    console.error('[location] getCurrentLocation error:', error);
    return null;
  }
}

/**
 * Forward geocode — search Indian locations by query string.
 * Returns [] on error or if query is too short.
 */
export async function searchLocations(query) {
  if (!query || query.length < 3) return [];
  try {
    const res = await api(`/location/search?q=${encodeURIComponent(query)}`);
    return Array.isArray(res?.results) ? res.results : [];
  } catch {
    return [];
  }
}
