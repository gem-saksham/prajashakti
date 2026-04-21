import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_SIZE_MB = 10;
const MAX_PHOTOS = 5;

function generateId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function exifToGps(exif) {
  if (!exif) return null;
  const rawLat = exif.GPSLatitude;
  const rawLng = exif.GPSLongitude;
  if (rawLat == null || rawLng == null) return null;
  let lat = Number(rawLat);
  let lng = Number(rawLng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (exif.GPSLatitudeRef === 'S' && lat > 0) lat = -lat;
  if (exif.GPSLongitudeRef === 'W' && lng > 0) lng = -lng;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function LocationBadge({ photo, issueLocation }) {
  if (!photo.exifGps) {
    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(136,136,136,0.75)' }]}>
        <Text style={styles.badgeText}>📍 No GPS</Text>
      </View>
    );
  }
  if (!issueLocation?.lat) {
    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(20,137,122,0.85)' }]}>
        <Text style={styles.badgeText}>📍 Has GPS</Text>
      </View>
    );
  }
  const distKm = haversineKm(
    photo.exifGps.lat,
    photo.exifGps.lng,
    issueLocation.lat,
    issueLocation.lng,
  );
  if (distKm <= 0.5) {
    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(20,137,122,0.9)' }]}>
        <Text style={styles.badgeText}>✓ Verified</Text>
      </View>
    );
  }
  if (distKm <= 5) {
    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(224,123,58,0.9)' }]}>
        <Text style={styles.badgeText}>⚠️ {distKm.toFixed(1)}km</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: 'rgba(220,20,60,0.9)' }]}>
      <Text style={styles.badgeText}>⚠️ Mismatch</Text>
    </View>
  );
}

export default function CaptureStep({ draft, onUpdate, onSkip }) {
  const [errors, setErrors] = useState([]);
  const [preview, setPreview] = useState(null);
  const photos = draft.photos || [];

  async function ingestAsset(asset) {
    const localErrors = [];
    if (asset.fileSize && asset.fileSize > MAX_SIZE_MB * 1024 * 1024) {
      localErrors.push(`${asset.fileName || 'Photo'}: File size must be under ${MAX_SIZE_MB}MB.`);
      return { photo: null, errors: localErrors };
    }
    const mime = asset.mimeType || 'image/jpeg';
    if (!ACCEPTED_TYPES.includes(mime.toLowerCase())) {
      localErrors.push(`${asset.fileName || 'Photo'}: Only JPEG, PNG, and WebP are supported.`);
      return { photo: null, errors: localErrors };
    }
    const exifGps = exifToGps(asset.exif);
    const photo = {
      id: generateId(),
      uri: asset.uri,
      preview: asset.uri,
      name: asset.fileName || `photo-${Date.now()}.jpg`,
      size: asset.fileSize ?? 0,
      type: mime,
      exifGps,
      status: 'pending',
      progress: 0,
      uploadedKey: null,
      confirmedUrl: null,
    };
    return { photo, errors: localErrors };
  }

  async function handleAssets(assets) {
    const next = [...photos];
    const allErrors = [];
    for (const asset of assets) {
      if (next.length >= MAX_PHOTOS) {
        allErrors.push(`Maximum ${MAX_PHOTOS} photos allowed.`);
        break;
      }
      const { photo, errors: e } = await ingestAsset(asset);
      if (e.length) allErrors.push(...e);
      if (photo) next.push(photo);
    }
    setErrors(allErrors);
    if (next.length !== photos.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onUpdate({ photos: next });
    }
  }

  async function takePhoto() {
    if (photos.length >= MAX_PHOTOS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      exif: true,
      quality: 0.9,
    });
    if (result.canceled) return;
    await handleAssets(result.assets || []);
  }

  async function pickFromGallery() {
    if (photos.length >= MAX_PHOTOS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const remaining = MAX_PHOTOS - photos.length;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      exif: true,
      quality: 0.9,
    });
    if (result.canceled) return;
    await handleAssets(result.assets || []);
  }

  function removePhoto(id) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onUpdate({ photos: photos.filter((p) => p.id !== id) });
  }

  const canAdd = photos.length < MAX_PHOTOS;
  const hasGpsPhotos = photos.some((p) => p.exifGps);

  return (
    <View style={styles.root}>
      {/* Guidance banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          📸{' '}
          <Text style={styles.bannerBold}>Photos with GPS are 3× more likely to get acted on.</Text>{' '}
          Taking a photo now lets us auto-fill location too.
        </Text>
      </View>

      {/* Primary camera button */}
      {canAdd && (
        <TouchableOpacity
          onPress={takePhoto}
          activeOpacity={0.85}
          accessibilityLabel="Take a photo with your camera"
          accessibilityRole="button"
          style={styles.cameraWrap}
        >
          <LinearGradient
            colors={[COLORS.crimson, '#c01234']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cameraBtn}
          >
            <Text style={styles.cameraIcon}>📷</Text>
          </LinearGradient>
          <Text style={styles.cameraLabel}>Take a photo</Text>
          <Text style={styles.cameraSub}>Captures GPS automatically</Text>
        </TouchableOpacity>
      )}

      {/* Secondary gallery link */}
      {canAdd && (
        <TouchableOpacity
          onPress={pickFromGallery}
          activeOpacity={0.7}
          accessibilityLabel="Choose photos from your gallery"
          accessibilityRole="button"
          style={styles.galleryBtn}
        >
          <Text style={styles.galleryIcon}>🖼️</Text>
          <Text style={styles.galleryText}>Choose from gallery</Text>
        </TouchableOpacity>
      )}

      {/* Skip */}
      {photos.length === 0 && (
        <TouchableOpacity
          onPress={onSkip}
          activeOpacity={0.7}
          accessibilityLabel="Skip photos and continue"
          accessibilityRole="link"
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip photos — continue without evidence</Text>
        </TouchableOpacity>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <View style={styles.errorBox}>
          {errors.map((e, i) => (
            <Text key={i} style={styles.errorLine}>
              {e}
            </Text>
          ))}
        </View>
      )}

      {/* Counter */}
      {photos.length > 0 && (
        <View style={styles.counterRow}>
          <Text style={styles.counterLabel}>Your evidence</Text>
          <Text style={styles.counterValue}>
            {photos.length} / {MAX_PHOTOS}
          </Text>
        </View>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <TouchableOpacity
              key={photo.id}
              activeOpacity={0.85}
              onPress={() => photo.uri && setPreview(photo)}
              style={styles.cell}
              accessibilityLabel="Preview photo"
            >
              {photo.uri ? (
                <Image source={{ uri: photo.uri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Text style={{ fontSize: 28 }}>🖼️</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removePhoto(photo.id)}
                hitSlop={8}
                accessibilityLabel="Remove photo"
              >
                <Text style={styles.removeX}>✕</Text>
              </TouchableOpacity>
              <View style={styles.badgeWrap}>
                <LocationBadge photo={photo} issueLocation={draft.location} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {photos.length > 0 && !hasGpsPhotos && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>
            ℹ️ These photos don't have location data. Consider taking a fresh photo on-site for more
            impact.
          </Text>
        </View>
      )}

      {/* Preview modal */}
      <Modal
        visible={!!preview}
        animationType="fade"
        transparent
        onRequestClose={() => setPreview(null)}
      >
        <TouchableOpacity
          style={styles.previewBackdrop}
          activeOpacity={1}
          onPress={() => setPreview(null)}
        >
          <ScrollView
            maximumZoomScale={3}
            minimumZoomScale={1}
            contentContainerStyle={styles.previewScroll}
            centerContent
            showsVerticalScrollIndicator={false}
          >
            {!!preview && (
              <Image source={{ uri: preview.uri }} style={styles.previewImg} resizeMode="contain" />
            )}
          </ScrollView>
          {!!preview?.exifGps && (
            <View style={styles.previewGps}>
              <Text style={styles.previewGpsText}>
                📍 GPS: {preview.exifGps.lat.toFixed(5)}, {preview.exifGps.lng.toFixed(5)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACING.xl },

  banner: {
    backgroundColor: 'rgba(224,123,58,0.08)',
    borderRadius: RADIUS.sm + 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bannerText: { fontSize: FONTS.size.sm, color: COLORS.orange, lineHeight: 20 },
  bannerBold: { fontWeight: FONTS.weight.bold },

  cameraWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: SPACING.md,
  },
  cameraBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.crimson,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
  cameraIcon: { fontSize: 36 },
  cameraLabel: {
    fontSize: 16,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.deepTeal,
    marginTop: 4,
  },
  cameraSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  galleryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(13,79,79,0.25)',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  galleryIcon: { fontSize: 18 },
  galleryText: {
    fontSize: 14,
    fontWeight: FONTS.weight.bold,
    color: COLORS.deepTeal,
  },

  skipBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.medium,
    textDecorationLine: 'underline',
  },

  errorBox: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: 'rgba(220,20,60,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorLine: { fontSize: 13, color: '#c0392b', marginBottom: 2 },

  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  counterLabel: {
    fontSize: FONTS.size.sm + 1,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
  },
  counterValue: {
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#f0f0ee',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeX: { color: '#fff', fontSize: 12, fontWeight: FONTS.weight.bold },

  badgeWrap: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: FONTS.weight.bold,
  },

  warnBanner: {
    backgroundColor: 'rgba(224,123,58,0.08)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  warnText: {
    fontSize: 12,
    color: COLORS.orange,
    lineHeight: 18,
  },

  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: {
    width: 360,
    maxWidth: '100%',
    aspectRatio: 1,
    borderRadius: 12,
  },
  previewGps: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  previewGpsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: FONTS.weight.semibold,
  },
});
