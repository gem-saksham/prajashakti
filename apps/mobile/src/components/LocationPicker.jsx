import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { searchLocations, getCurrentLocation } from '../services/location';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';

/**
 * Location picker with GPS auto-detect and text search.
 *
 * @param {{
 *   value:    { displayName: string, lat?: number, lng?: number } | null,
 *   onChange: (location | null) => void,
 * }} props
 */
export default function LocationPicker({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const debounceRef = useRef(null);

  // ── GPS detect ────────────────────────────────────────────────────────────

  async function handleDetect() {
    setDetecting(true);
    setResults([]);
    setQuery('');
    try {
      const loc = await getCurrentLocation();
      if (loc) onChange(loc);
    } finally {
      setDetecting(false);
    }
  }

  // ── Text search ───────────────────────────────────────────────────────────

  const handleSearch = useCallback((text) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    if (text.length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchLocations(text);
        setResults(res);
      } finally {
        setSearching(false);
      }
    }, 500);
  }, []);

  function selectResult(item) {
    onChange(item);
    setQuery('');
    setResults([]);
  }

  function clearSelection() {
    onChange(null);
    setQuery('');
    setResults([]);
  }

  // ── Selected pill ─────────────────────────────────────────────────────────

  if (value?.displayName) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.sectionLabel}>Location</Text>
        <View style={styles.selectedPill}>
          <Text style={styles.pillText} numberOfLines={1}>
            📍 {value.displayName}
          </Text>
          <TouchableOpacity
            onPress={clearSelection}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.pillRemove}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Picker ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Location</Text>

      {/* GPS button */}
      <TouchableOpacity
        style={styles.gpsBtn}
        onPress={handleDetect}
        disabled={detecting}
        activeOpacity={0.7}
      >
        {detecting ? (
          <ActivityIndicator size="small" color={COLORS.deepTeal} />
        ) : (
          <Text style={styles.gpsIcon}>📍</Text>
        )}
        <Text style={styles.gpsBtnText}>
          {detecting ? 'Detecting location…' : 'Use my current location'}
        </Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or search</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Search input */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleSearch}
          placeholder="Type a city, district or pincode…"
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
        />
        {searching ? (
          <ActivityIndicator size="small" color={COLORS.teal} style={styles.inputSpinner} />
        ) : null}
      </View>

      {/* Results dropdown */}
      {results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(item, i) => item.displayName ?? String(i)}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.result, index < results.length - 1 && styles.resultBorder]}
                onPress={() => selectResult(item)}
                activeOpacity={0.6}
              >
                <Text style={styles.resultName} numberOfLines={1}>
                  {item.displayName}
                </Text>
                {item.state ? (
                  <Text style={styles.resultSub}>
                    {item.district ? `${item.district}, ` : ''}
                    {item.state}
                  </Text>
                ) : null}
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>
      )}

      {query.length >= 3 && !searching && results.length === 0 ? (
        <Text style={styles.empty}>No locations found. Try a different search.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  sectionLabel: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.deepTeal,
    borderRadius: RADIUS.md,
    padding: 14,
  },
  gpsIcon: { fontSize: 18 },
  gpsBtnText: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.deepTeal,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: SPACING.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: FONTS.size.md,
    color: COLORS.textPrimary,
  },
  inputSpinner: { marginLeft: 8 },
  dropdown: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardBg,
    overflow: 'hidden',
  },
  result: { padding: SPACING.md },
  resultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultName: {
    fontSize: FONTS.size.md,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weight.medium,
  },
  resultSub: {
    fontSize: FONTS.size.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  empty: {
    fontSize: FONTS.size.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    padding: SPACING.md,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,79,79,0.07)',
    borderRadius: 99,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  pillText: {
    flex: 1,
    fontSize: FONTS.size.md,
    color: COLORS.deepTeal,
    fontWeight: FONTS.weight.medium,
  },
  pillRemove: {
    fontSize: FONTS.size.sm,
    color: COLORS.textMuted,
  },
});
