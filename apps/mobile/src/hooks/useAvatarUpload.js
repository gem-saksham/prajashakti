import { useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { profileApi } from '../utils/api';
import { getTokens } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

/**
 * Manages the full avatar upload flow via API proxy:
 *   pick image → POST binary to /users/me/avatar (API uploads to S3) → update local state
 *
 * This avoids the device needing direct network access to LocalStack/S3.
 * Returns { uploadAvatar, removeAvatar, isUploading, progress }
 */
export function useAvatarUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { updateUser } = useAuth();
  const { show } = useToast();

  async function uploadAvatar(image) {
    setIsUploading(true);
    setProgress(0);
    try {
      console.log('[Avatar] Step 1 — image received:', {
        uri: image?.uri?.slice(0, 80),
        mimeType: image?.mimeType,
        width: image?.width,
        height: image?.height,
      });

      // Get auth token to include in proxy upload request
      const { accessToken } = await getTokens();
      setProgress(10);

      // Upload binary directly to API proxy endpoint.
      // The API server uploads to S3 — device never contacts S3/LocalStack directly.
      const uploadUrl = profileApi.avatarUploadUrl;
      console.log('[Avatar] Step 2 — uploading to API proxy:', uploadUrl);

      let result;
      try {
        result = await FileSystem.uploadAsync(uploadUrl, image.uri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'Content-Type': image.mimeType,
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (e) {
        console.error('[Avatar] uploadAsync threw:', e?.message, e);
        throw e;
      }

      console.log('[Avatar] Step 3 — upload result:', {
        status: result?.status,
        body: result?.body?.slice?.(0, 300),
      });

      if (result.status !== 200 && result.status !== 201) {
        throw new Error(`Upload failed: ${result.status} — ${result.body?.slice(0, 200)}`);
      }

      const data = JSON.parse(result.body);
      if (!data.success) throw { status: result.status, ...data };

      setProgress(90);

      // Update local auth state with the new avatar
      // Cache-bust in state only — DB stores clean URL
      updateUser({ ...data.user, avatarUrl: `${data.publicUrl}?t=${Date.now()}` });
      setProgress(100);

      console.log('[Avatar] Step 4 — done! publicUrl:', data.publicUrl?.slice(0, 80));
      show({ message: 'Profile photo updated!', type: 'success' });
      return data.publicUrl;
    } catch (err) {
      console.error('[Avatar] UPLOAD FAILED:', {
        message: err?.message,
        status: err?.status,
        error: err?.error,
      });
      show({ message: 'Upload failed. Please try again.', type: 'error' });
      throw err;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  }

  async function removeAvatar() {
    try {
      const { user } = await profileApi.deleteAvatar();
      updateUser(user);
      show({ message: 'Profile photo removed.', type: 'success' });
    } catch {
      show({ message: 'Could not remove photo. Try again.', type: 'error' });
    }
  }

  return { uploadAvatar, removeAvatar, isUploading, progress };
}
