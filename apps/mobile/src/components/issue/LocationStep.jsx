/**
 * LocationStep — EXIF → GPS → manual cascade.
 *
 * On first entry (no location set):
 *   1. If any photo has EXIF GPS, offer to use it ("Use photo location")
 *   2. Offer device GPS via LocationAutocomplete's built-in GPS button
 *   3. Fall back to manual search
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import LocationAutocomplete from '../LocationAutocomplete';
import { locationApi } from '../../utils/api';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme';

export default function LocationStep({ draft, onUpdate }) {
  const location = draft.location;
  const photos = draft.photos || [];
  const firstExifPhoto = photos.find((p) => p.exifGps);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestedDismissed, setSuggestedDismissed] = useState(false);

  async function useExifLocation() {
    if (!firstExifPhoto?.exifGps) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSuggesting(true);
    try {
      const { lat, lng } = firstExifPhoto.exifGps;
      const res = await locationApi.reverse(lat, lng);
      const address = res?.location || {};
      const loc = {
        lat,
        lng,
        district: address.district || '',
        state: address.state || '',
        pincode: address.pincode || '',
        displayName: address.formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      };
      onUpdate({ location: loc });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Silent — user can use manual search
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } finally {
      setSuggesting(false);
    }
  }

  function handleSelect(loc) {
    Haptics.selectionAsync().catch(() => {});
    onUpdate({ location: loc });
  }

  function handleClear() {
    onUpdate({ location: null });
  }

  function openInMaps() {
    if (!location?.lat) return;
    const { lat, lng } = location;
    const label = encodeURIComponent(location.displayName || 'Selected location');
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`,
    });
    Linking.openURL(url).catch(() => {});
  }

  const showExifSuggestion = !location?.lat && firstExifPhoto?.exifGps && !suggestedDismissed;

  return (
    <View style={styles.root}>
      <View style={styles.tip}>
        <Text style={styles.tipText}>
          📍 <Text style={styles.tipBold}>Tip:</Text> An accurate location helps us route your issue
          to the right officials.
        </Text>
      </View>

      {/* EXIF suggestion — shown only if a photo has GPS but no location set */}
      {showExifSuggestion && (
        <View style={styles.exifCard}>
          <Text style={styles.exifIcon}>📸</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.exifTitle}>Use location from your photo?</Text>
            <Text style={styles.exifSub}>
              {firstExifPhoto.exifGps.lat.toFixed(5)}, {firstExifPhoto.exifGps.lng.toFixed(5)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setSuggestedDismissed(true)}
            style={styles.exifDismiss}
            hitSlop={10}
            accessibilityLabel="Dismiss photo location suggestion"
          >
            <Text style={styles.exifDismissText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={useExifLocation}
            disabled={suggesting}
            activeOpacity={0.85}
            accessibilityLabel="Use photo location"
            style={styles.exifUseBtn}
          >
            {suggesting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exifUseText}>Use this</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Search + GPS */}
      <View>
        <Text style={styles.label}>
          Location <Text style={styles.required}>*</Text>
        </Text>
        <LocationAutocomplete
          value={location?.displayName}
          onChange={handleSelect}
          onClear={handleClear}
          placeholder="Search your location or use GPS..."
        />
      </View>

      {/* Selected preview */}
      {location?.lat != null ? (
        <View>
          <TouchableOpacity
            onPress={openInMaps}
            activeOpacity={0.85}
            accessibilityLabel="Open location in Maps"
            style={styles.mapCard}
          >
            <View style={styles.mapPinCircle}>
              <Text style={styles.mapPin}>📍</Text>
            </View>
            <Text style={styles.mapCoords}>
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </Text>
            <Text style={styles.mapOpen}>Tap to open in Maps →</Text>
          </TouchableOpacity>
          <Text style={styles.mapHint}>
            Showing selected location — search again above to change it
          </Text>

          <View style={styles.detailsRow}>
            {[
              { label: 'District', value: location.district },
              { label: 'State', value: location.state },
              { label: 'Pincode', value: location.pincode },
            ].map(({ label, value }) => (
              <View key={label} style={styles.detailCell}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text
                  style={[styles.detailValue, !value && styles.detailValueEmpty]}
                  numberOfLines={1}
                >
                  {value || '—'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyTitle}>No location selected yet</Text>
          <Text style={styles.emptySub}>Use GPS above or search by name</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACING.xl },

  tip: {
    backgroundColor: 'rgba(20,137,122,0.07)',
    borderRadius: RADIUS.sm + 2,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tipText: { fontSize: FONTS.size.sm, color: COLORS.teal, lineHeight: 20 },
  tipBold: { fontWeight: FONTS.weight.bold },

  exifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(224,123,58,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(224,123,58,0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  exifIcon: { fontSize: 24 },
  exifTitle: {
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    color: COLORS.orange,
  },
  exifSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  exifDismiss: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exifDismissText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  exifUseBtn: {
    backgroundColor: COLORS.orange,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    minWidth: 72,
    alignItems: 'center',
  },
  exifUseText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: FONTS.weight.bold,
  },

  label: {
    fontSize: FONTS.size.sm + 1,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  required: { color: COLORS.crimson },

  mapCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(20,137,122,0.05)',
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
  },
  mapPinCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(20,137,122,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPin: { fontSize: 26 },
  mapCoords: {
    fontSize: 14,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.deepTeal,
  },
  mapOpen: {
    fontSize: 12,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.teal,
  },
  mapHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },

  detailsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  detailCell: {
    flex: 1,
    backgroundColor: '#f8f8f6',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  detailLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textPrimary,
  },
  detailValueEmpty: { color: '#bbb' },

  empty: {
    backgroundColor: '#f8f8f6',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    borderStyle: 'dashed',
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: {
    fontSize: 14,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
