/**
 * LocationAutocomplete — RN port of the web component.
 *
 * Props:
 *   value       — display string for the selected location (if any)
 *   onChange    — ({ lat, lng, district, state, pincode, displayName }) => void
 *   onClear     — () => void
 *   placeholder — string
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as Location from 'expo-location';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import { locationApi } from '../utils/api';

export default function LocationAutocomplete({
  value,
  onChange,
  onClear,
  placeholder = 'Search your location...',
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await locationApi.search(q);
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function handleSelect(r) {
    onChange({
      lat: r.lat,
      lng: r.lng,
      district: r.district,
      state: r.state,
      pincode: r.pincode ?? '',
      displayName: r.displayName,
    });
    setQuery('');
    setOpen(false);
    setResults([]);
  }

  async function handleGps() {
    setGpsError('');
    setGpsLoading(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setGpsError('Location access denied. Search manually.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude: lat, longitude: lng } = pos.coords;
      const data = await locationApi.reverse(lat, lng);
      onChange({
        lat,
        lng,
        district: data.location?.district || '',
        state: data.location?.state || '',
        pincode: data.location?.pincode || '',
        displayName: data.location?.formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
      setOpen(false);
    } catch {
      setGpsError('Could not detect location. Search manually.');
    } finally {
      setGpsLoading(false);
    }
  }

  // Selected — show as pill
  if (value) {
    return (
      <View style={styles.pillWrap}>
        <View style={styles.pill}>
          <Text style={styles.pillText} numberOfLines={1}>
            📍 {value}
          </Text>
          <TouchableOpacity onPress={onClear} hitSlop={10}>
            <Text style={styles.pillClear}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        onPress={handleGps}
        disabled={gpsLoading}
        activeOpacity={0.75}
        style={styles.gpsBtn}
      >
        {gpsLoading ? (
          <ActivityIndicator color={COLORS.teal} size="small" />
        ) : (
          <Text style={styles.gpsIcon}>📍</Text>
        )}
        <Text style={styles.gpsText}>Use my current location</Text>
      </TouchableOpacity>

      <View style={[styles.inputWrap, focused && styles.inputFocus]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={(q) => {
            setQuery(q);
            search(q);
          }}
          onFocus={() => {
            setFocused(true);
            if (results.length) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
        />
        {loading && <ActivityIndicator color={COLORS.teal} size="small" />}
      </View>

      {!!gpsError && <Text style={styles.gpsError}>{gpsError}</Text>}

      {open && (
        <View style={styles.dropdown}>
          {results.length === 0 && !loading && query.length >= 2 ? (
            <Text style={styles.dropdownEmpty}>No locations found for "{query}"</Text>
          ) : (
            results.map((r, i) => (
              <TouchableOpacity
                key={`${r.lat}-${r.lng}-${i}`}
                onPress={() => handleSelect(r)}
                activeOpacity={0.7}
                style={[styles.dropdownItem, i < results.length - 1 && styles.dropdownItemBorder]}
              >
                <Text style={styles.dropdownPrimary}>
                  {r.district && r.state
                    ? `${r.district}, ${r.state}`
                    : r.displayName.split(',').slice(0, 2).join(',')}
                </Text>
                <Text style={styles.dropdownSecondary} numberOfLines={1}>
                  {r.displayName}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(20,137,122,0.1)',
    borderRadius: RADIUS.pill,
    maxWidth: '100%',
  },
  pillText: {
    color: COLORS.teal,
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    maxWidth: 220,
  },
  pillClear: {
    color: COLORS.teal,
    fontSize: 14,
    marginLeft: 2,
  },

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(20,137,122,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(20,137,122,0.2)',
    borderRadius: 10,
    marginBottom: 8,
  },
  gpsIcon: { fontSize: 14 },
  gpsText: {
    color: COLORS.teal,
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: RADIUS.md,
    backgroundColor: '#f8f8f6',
    paddingHorizontal: 10,
  },
  inputFocus: { borderColor: COLORS.teal },
  searchIcon: { fontSize: 16, color: COLORS.textMuted, paddingHorizontal: 4 },
  input: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 4,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  gpsError: { marginTop: 6, fontSize: 12, color: '#e05555' },

  dropdown: {
    marginTop: 4,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  dropdownEmpty: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  dropdownItem: {
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropdownPrimary: {
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textPrimary,
  },
  dropdownSecondary: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
