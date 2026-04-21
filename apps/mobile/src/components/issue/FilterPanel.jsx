/**
 * FilterPanel (mobile) — bottom-sheet modal with advanced filters:
 *   Near-me + radius, State, District, Date range, Min supporters,
 *   Has photos, Verified location only.
 *
 * Renders as a full Modal; caller controls `visible` + `onClose`.
 * Mirrors the web FilterPanel's options exactly. Continuous sliders
 * are replaced with preset pills since no slider library is installed.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SPACING } from '../../theme';
import { api } from '../../utils/api';

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

const RADIUS_PRESETS = [1, 5, 10, 25, 50, 100];
const SUPPORT_PRESETS = [0, 10, 50, 100, 250, 500];

// ── Small reusable pill ──────────────────────────────────────────────────────

function Pill({ label, selected, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[
        styles.pill,
        selected ? styles.pillActive : styles.pillIdle,
        disabled && styles.pillDisabled,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          selected && styles.pillTextActive,
          disabled && styles.pillTextDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Checkbox({ checked, label, onToggle }) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.checkRow}>
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── State / District selector (modal picker) ─────────────────────────────────

function SelectField({ label, value, placeholder, onPress, disabled, hint }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.75}
        style={[styles.selectBtn, disabled && styles.selectBtnDisabled]}
      >
        <Text
          style={[
            styles.selectValue,
            !value && styles.selectPlaceholder,
            disabled && styles.selectValueDisabled,
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Text style={[styles.selectChev, disabled && styles.selectValueDisabled]}>▾</Text>
      </TouchableOpacity>
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

function OptionsModal({ visible, title, options, selected, onPick, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.optionsSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetGrabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }}>
            {options.length === 0 ? (
              <Text style={styles.optionsEmpty}>No options available.</Text>
            ) : (
              options.map((opt) => {
                const isSel = opt.value === selected;
                return (
                  <TouchableOpacity
                    key={opt.value || 'any'}
                    onPress={() => onPick(opt.value)}
                    activeOpacity={0.7}
                    style={[styles.optionRow, isSel && styles.optionRowActive]}
                  >
                    <Text style={[styles.optionText, isSel && styles.optionTextActive]}>
                      {opt.label}
                    </Text>
                    {isSel && <Text style={styles.optionCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function FilterPanel({ visible, onClose, filters, onUpdate }) {
  const insets = useSafeAreaInsets();
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [districtModal, setDistrictModal] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  // Load states on first open.
  useEffect(() => {
    if (!visible || states.length > 0 || statesLoading) return;
    setStatesLoading(true);
    api('/location/states')
      .then((d) => setStates(d.states || []))
      .catch(() => {})
      .finally(() => setStatesLoading(false));
  }, [visible, states.length, statesLoading]);

  // Load districts whenever selected state changes.
  useEffect(() => {
    if (!filters.state) {
      setDistricts([]);
      return;
    }
    const stateObj = states.find((s) => s.name === filters.state || s.code === filters.state);
    if (!stateObj) return;
    setDistrictsLoading(true);
    api(`/location/states/${stateObj.code}/districts`)
      .then((d) => setDistricts(d.districts || []))
      .catch(() => setDistricts([]))
      .finally(() => setDistrictsLoading(false));
  }, [filters.state, states]);

  const hasGeo = filters.lat != null && filters.lng != null;
  const hasAdvanced =
    !!filters.state ||
    !!filters.district ||
    filters.dateRange !== 'all' ||
    filters.minSupport > 0 ||
    filters.hasPhotos ||
    filters.verifiedOnly ||
    hasGeo;

  async function handleNearMe() {
    setLocError('');
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocError('Location permission denied. Enable it in Settings to use radius filtering.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        radiusKm: filters.radiusKm || 10,
        state: '',
        district: '',
      });
    } catch {
      setLocError('Unable to get location. Please try again.');
    } finally {
      setLocating(false);
    }
  }

  function clearGeo() {
    onUpdate({ lat: null, lng: null });
  }

  function clearAdvanced() {
    onUpdate({
      state: '',
      district: '',
      dateRange: 'all',
      minSupport: 0,
      hasPhotos: false,
      verifiedOnly: false,
      lat: null,
      lng: null,
    });
  }

  const stateOptions = useMemo(
    () => [
      { value: '', label: 'All states' },
      ...states.map((s) => ({ value: s.name, label: s.name })),
    ],
    [states],
  );
  const districtOptions = useMemo(
    () => [
      { value: '', label: 'All districts' },
      ...districts.map((d) => ({ value: d.name, label: d.name })),
    ],
    [districts],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetGrabber} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>More filters</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 560 }}
            contentContainerStyle={{ paddingVertical: 4, gap: SPACING.lg }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Near me + radius ── */}
            <View>
              <Text style={styles.fieldLabel}>📍 Radius filter</Text>
              {!hasGeo ? (
                <TouchableOpacity onPress={handleNearMe} disabled={locating} activeOpacity={0.85}>
                  <LinearGradient
                    colors={locating ? ['#ccc', '#bbb'] : [COLORS.deepTeal, COLORS.teal]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.nearMeBtn}
                  >
                    {locating ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.nearMeIcon}>📍</Text>
                    )}
                    <Text style={styles.nearMeText}>
                      {locating ? 'Detecting…' : 'Use my location'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.geoActive}>
                  <View style={styles.geoActiveHeader}>
                    <Text style={styles.geoActiveLabel} numberOfLines={1}>
                      📍 Within {filters.radiusKm} km of your location
                    </Text>
                    <TouchableOpacity onPress={clearGeo} hitSlop={8}>
                      <Text style={styles.geoActiveRemove}>✕ Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.pillWrap}>
                    {RADIUS_PRESETS.map((km) => (
                      <Pill
                        key={km}
                        label={`${km} km`}
                        selected={filters.radiusKm === km}
                        onPress={() => onUpdate({ radiusKm: km })}
                      />
                    ))}
                  </View>
                </View>
              )}
              {!!locError && <Text style={styles.locError}>{locError}</Text>}
              {!hasGeo && (
                <Text style={styles.fieldHint}>
                  Shows only issues within the selected radius of your current position.
                </Text>
              )}
            </View>

            {/* ── State + District ── */}
            <View style={styles.rowTwo}>
              <SelectField
                label="State"
                value={filters.state}
                placeholder={statesLoading ? 'Loading…' : 'All states'}
                onPress={() => setStateModal(true)}
                disabled={statesLoading || hasGeo}
                hint={hasGeo ? 'Disabled while "Near me" is active' : undefined}
              />
              <SelectField
                label="District"
                value={filters.district}
                placeholder={
                  districtsLoading
                    ? 'Loading…'
                    : !filters.state
                      ? 'Select state first'
                      : 'All districts'
                }
                onPress={() => setDistrictModal(true)}
                disabled={!filters.state || districtsLoading || hasGeo}
              />
            </View>

            {/* ── Date range ── */}
            <View>
              <Text style={styles.fieldLabel}>Date range</Text>
              <View style={styles.pillWrap}>
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <Pill
                    key={opt.value}
                    label={opt.label}
                    selected={filters.dateRange === opt.value}
                    onPress={() => onUpdate({ dateRange: opt.value })}
                  />
                ))}
              </View>
            </View>

            {/* ── Min supporters ── */}
            <View>
              <Text style={styles.fieldLabel}>
                Min. supporters
                {filters.minSupport > 0 && (
                  <Text style={styles.fieldLabelAccent}> ≥ {filters.minSupport}</Text>
                )}
              </Text>
              <View style={styles.pillWrap}>
                {SUPPORT_PRESETS.map((n) => (
                  <Pill
                    key={n}
                    label={n === 0 ? 'Any' : `≥${n}`}
                    selected={filters.minSupport === n}
                    onPress={() => onUpdate({ minSupport: n })}
                  />
                ))}
              </View>
            </View>

            {/* ── Checkboxes ── */}
            <View style={styles.checkGroup}>
              <Checkbox
                checked={!!filters.hasPhotos}
                label="📷 Has photos"
                onToggle={() => onUpdate({ hasPhotos: !filters.hasPhotos })}
              />
              <Checkbox
                checked={!!filters.verifiedOnly}
                label="✅ Verified location only"
                onToggle={() => onUpdate({ verifiedOnly: !filters.verifiedOnly })}
              />
            </View>

            {/* ── Clear advanced ── */}
            {hasAdvanced && (
              <TouchableOpacity onPress={clearAdvanced} activeOpacity={0.7} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear advanced filters</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Apply footer */}
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.applyBtnWrap}>
            <LinearGradient
              colors={[COLORS.deepTeal, COLORS.teal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.applyBtn}
            >
              <Text style={styles.applyBtnText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>

      {/* State picker */}
      <OptionsModal
        visible={stateModal}
        title="Select state"
        options={stateOptions}
        selected={filters.state}
        onPick={(v) => {
          onUpdate({ state: v, district: '' });
          setStateModal(false);
        }}
        onClose={() => setStateModal(false)}
      />

      {/* District picker */}
      <OptionsModal
        visible={districtModal}
        title="Select district"
        options={districtOptions}
        selected={filters.district}
        onPick={(v) => {
          onUpdate({ district: v });
          setDistrictModal(false);
        }}
        onClose={() => setDistrictModal(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: 8,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.deepTeal,
  },
  sheetClose: {
    fontSize: 18,
    color: COLORS.textMuted,
    paddingHorizontal: 4,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  fieldLabelAccent: {
    color: COLORS.teal,
    fontWeight: FONTS.weight.bold,
  },
  fieldHint: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 4,
  },

  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  pillIdle: {
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
  },
  pillActive: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(20,137,122,0.12)',
  },
  pillDisabled: { opacity: 0.5 },
  pillText: {
    fontSize: 12,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textSecondary,
  },
  pillTextActive: { color: COLORS.deepTeal },
  pillTextDisabled: { color: '#aaa' },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  rowTwo: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  selectBtnDisabled: { backgroundColor: '#f4f5f0', opacity: 0.75 },
  selectValue: {
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textPrimary,
    flex: 1,
  },
  selectValueDisabled: { color: COLORS.textMuted },
  selectPlaceholder: { color: COLORS.textMuted, fontWeight: FONTS.weight.regular },
  selectChev: { fontSize: 12, color: COLORS.textMuted, marginLeft: 8 },

  nearMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  nearMeIcon: { fontSize: 14 },
  nearMeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
  },

  geoActive: {
    backgroundColor: 'rgba(20,137,122,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(20,137,122,0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  geoActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  geoActiveLabel: {
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.deepTeal,
    flex: 1,
    marginRight: 8,
  },
  geoActiveRemove: {
    fontSize: 12,
    fontWeight: FONTS.weight.bold,
    color: COLORS.crimson,
  },

  locError: {
    fontSize: 12,
    color: COLORS.crimson,
    marginTop: 6,
    lineHeight: 16,
  },

  checkGroup: {
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkBoxOn: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  checkMark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: FONTS.weight.medium,
    color: COLORS.textPrimary,
  },

  clearBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(220,20,60,0.3)',
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.crimson,
  },

  applyBtnWrap: { marginTop: SPACING.md },
  applyBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: FONTS.weight.bold,
  },

  // OptionsModal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: 8,
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionRowActive: {
    backgroundColor: 'rgba(20,137,122,0.06)',
  },
  optionText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weight.medium,
  },
  optionTextActive: {
    color: COLORS.deepTeal,
    fontWeight: FONTS.weight.bold,
  },
  optionCheck: {
    fontSize: 14,
    color: COLORS.teal,
    fontWeight: FONTS.weight.bold,
  },
  optionsEmpty: {
    padding: 16,
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 13,
  },
});
