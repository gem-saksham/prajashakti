import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Linking, Alert } from 'react-native';

const MESSAGES = {
  camera: 'PrajaShakti needs camera access to take profile photos and document issues.',
  gallery: 'PrajaShakti needs photo library access to upload images.',
  location: 'PrajaShakti uses your location to show issues near you.',
};

/**
 * Request a permission and show a Settings alert if denied.
 * @param {'camera'|'gallery'|'location'} type
 * @returns {Promise<boolean>} true if granted
 */
export async function ensurePermission(type) {
  let result;

  if (type === 'camera') {
    result = await ImagePicker.requestCameraPermissionsAsync();
  } else if (type === 'gallery') {
    result = await ImagePicker.requestMediaLibraryPermissionsAsync();
  } else if (type === 'location') {
    result = await Location.requestForegroundPermissionsAsync();
  } else {
    return false;
  }

  if (result.status === 'granted') return true;

  Alert.alert('Permission Required', MESSAGES[type], [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);

  return false;
}

/**
 * Check (without requesting) whether a permission is already granted.
 * @param {'camera'|'gallery'|'location'} type
 * @returns {Promise<boolean>}
 */
export async function checkPermission(type) {
  let result;

  if (type === 'camera') {
    result = await ImagePicker.getCameraPermissionsAsync();
  } else if (type === 'gallery') {
    result = await ImagePicker.getMediaLibraryPermissionsAsync();
  } else if (type === 'location') {
    result = await Location.getForegroundPermissionsAsync();
  } else {
    return false;
  }

  return result.status === 'granted';
}
