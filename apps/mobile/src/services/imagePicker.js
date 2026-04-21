import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ensurePermission } from '../utils/permissions';

const PICKER_OPTIONS = {
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

/**
 * Open the device photo library. Returns processed image or null if cancelled/denied.
 */
export async function pickFromGallery() {
  const granted = await ensurePermission('gallery');
  if (!granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    ...PICKER_OPTIONS,
    mediaTypes: 'images',
  });

  if (result.canceled) return null;
  return processImage(result.assets[0]);
}

/**
 * Open the device camera. Returns processed image or null if cancelled/denied.
 */
export async function takePhoto() {
  const granted = await ensurePermission('camera');
  if (!granted) return null;

  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);

  if (result.canceled) return null;
  return processImage(result.assets[0]);
}

/**
 * Resize and compress image to max 800px wide JPEG before upload.
 */
async function processImage(asset) {
  console.log('[ImagePicker] raw asset:', {
    uri: asset?.uri?.slice(0, 60),
    width: asset?.width,
    height: asset?.height,
  });
  try {
    // New contextual API (expo-image-manipulator v14+)
    const context = ImageManipulator.manipulate(asset.uri);
    context.resize({ width: 800 });
    const imageRef = await context.renderAsync();
    const manipulated = await imageRef.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    // Release native memory
    context.release();
    imageRef.release();

    const result = {
      uri: manipulated.uri,
      width: manipulated.width,
      height: manipulated.height,
      fileName: `avatar_${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
    };
    console.log('[ImagePicker] processed:', {
      uri: result.uri?.slice(0, 60),
      width: result.width,
      height: result.height,
    });
    return result;
  } catch (e) {
    console.error('[ImagePicker] manipulate failed:', e?.message, e);
    throw e;
  }
}
