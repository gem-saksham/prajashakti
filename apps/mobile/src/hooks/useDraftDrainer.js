/**
 * useDraftDrainer — watches NetInfo and attempts to submit queued issue
 * drafts whenever connectivity returns.
 *
 * Note: photos stored in the queue may have stale URIs (the app may have
 * been killed and relaunched), in which case only the issue body is
 * submitted. Users can always attach fresh evidence to the created issue.
 */
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { issueApi, photoApi, uploadToS3 } from '../utils/api';
import { subscribeNetworkDrain, drainQueue } from '../services/draftQueue';

async function submitOne(draft) {
  const body = {
    title: draft.title,
    description: draft.description,
    category: draft.category,
    urgency: draft.urgency,
    location_lat: draft.location?.lat,
    location_lng: draft.location?.lng,
    district: draft.location?.district || undefined,
    state: draft.location?.state || undefined,
    pincode: draft.location?.pincode || undefined,
    formatted_address: draft.location?.displayName || undefined,
    is_anonymous: false,
  };
  if (draft.ministryId) body.ministry_id = draft.ministryId;
  if (draft.departmentId) body.department_id = draft.departmentId;
  if (draft.suggestedOfficialIds?.length) {
    body.suggested_official_ids = draft.suggestedOfficialIds;
  }

  const res = await issueApi.create(body);
  const issueId = res.data.id;

  for (const photo of draft.photos || []) {
    if (!photo.uri) continue;
    try {
      const urlRes = await photoApi.requestUploadUrl(issueId, photo.type);
      const { uploadUrl, fileKey } = urlRes.data;
      await uploadToS3(uploadUrl, { uri: photo.uri, type: photo.type, name: photo.name });
      await photoApi.confirm(issueId, fileKey);
    } catch {
      // skip — issue is published even if a photo fails
    }
  }
}

export function useDraftDrainer() {
  const { user } = useAuth();
  const { show } = useToast();

  useEffect(() => {
    if (!user) return undefined;

    // Attempt to drain once on mount (covers apps relaunched while online).
    drainQueue(submitOne)
      .then((r) => {
        if (r?.succeeded) {
          show({
            message: `Published ${r.succeeded} queued issue${r.succeeded === 1 ? '' : 's'}.`,
            type: 'success',
          });
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeNetworkDrain(submitOne, (r) => {
      if (r?.succeeded) {
        show({
          message: `Published ${r.succeeded} queued issue${r.succeeded === 1 ? '' : 's'}.`,
          type: 'success',
        });
      }
    });
    return unsubscribe;
  }, [user, show]);
}
