import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../utils/api';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { pickFromGallery, takePhoto } from '../services/imagePicker';
import ScreenHeader from '../components/ScreenHeader';
import Input from '../components/Input';
import Avatar from '../components/Avatar';
import ActionSheet from '../components/ActionSheet';
import LocationPicker from '../components/LocationPicker';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';

export default function EditProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const { show } = useToast();
  const { uploadAvatar, removeAvatar, isUploading, progress } = useAvatarUpload();

  // ── Form state ────────────────────────────────────────────────────────────

  const [original, setOriginal] = useState(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // ── Load current profile ──────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const data = await profileApi.getMe();
        const profile = data.user ?? data;
        setOriginal(profile);
        setName(profile.name ?? '');
        setBio(profile.bio ?? '');
        if (profile.district) {
          setLocation({
            displayName: profile.district + (profile.state ? `, ${profile.state}` : ''),
            lat: profile.locationLat,
            lng: profile.locationLng,
            district: profile.district,
            state: profile.state,
            pincode: profile.pincode,
          });
        }
      } catch (e) {
        console.error('[EditProfile] load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Unsaved changes detection ─────────────────────────────────────────────

  const hasChanges = useCallback(() => {
    if (!original) return false;
    const locChanged =
      location?.displayName !==
      (original.district
        ? original.district + (original.state ? `, ${original.state}` : '')
        : null);
    return name !== (original.name ?? '') || bio !== (original.bio ?? '') || locChanged;
  }, [original, name, bio, location]);

  const confirmDiscard = useCallback(() => {
    if (!hasChanges()) return true;
    Alert.alert('Discard changes?', 'You have unsaved changes. Are you sure you want to go back?', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
    return false;
  }, [hasChanges, navigation]);

  // Android hardware back button
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (hasChanges()) {
          confirmDiscard();
          return true; // prevent default
        }
        return false;
      });
      return () => sub.remove();
    }, [hasChanges, confirmDiscard]),
  );

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!hasChanges() || saving) return;
    setSaving(true);
    try {
      const patch = {
        name: name.trim(),
        bio: bio.trim(),
        ...(location
          ? {
              district: location.district ?? location.displayName,
              state: location.state ?? '',
              locationLat: location.lat,
              locationLng: location.lng,
              pincode: location.pincode ?? '',
            }
          : {
              district: null,
              state: null,
              locationLat: null,
              locationLng: null,
              pincode: null,
            }),
      };
      const { user: updated } = await profileApi.updateProfile(patch);
      updateUser(updated);
      show({ message: 'Profile updated!', type: 'success' });
      navigation.goBack();
    } catch (err) {
      const msg = err?.error?.message ?? 'Could not save. Please try again.';
      show({ message: msg, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  // ── Avatar actions ────────────────────────────────────────────────────────

  const avatarActions = [
    {
      icon: '📷',
      label: 'Take Photo',
      onPress: async () => {
        const img = await takePhoto();
        if (img) {
          const url = await uploadAvatar(img);
          if (url) setOriginal((p) => ({ ...p, avatarUrl: url }));
        }
      },
    },
    {
      icon: '🖼️',
      label: 'Choose from Gallery',
      onPress: async () => {
        const img = await pickFromGallery();
        if (img) {
          const url = await uploadAvatar(img);
          if (url) setOriginal((p) => ({ ...p, avatarUrl: url }));
        }
      },
    },
    ...(original?.avatarUrl
      ? [
          {
            icon: '🗑️',
            label: 'Remove Photo',
            destructive: true,
            onPress: async () => {
              await removeAvatar();
              setOriginal((p) => ({ ...p, avatarUrl: null }));
            },
          },
        ]
      : []),
  ];

  // ── Validation ────────────────────────────────────────────────────────────

  const nameErr =
    name.length > 0 && name.trim().length < 2 ? 'Name must be at least 2 characters' : null;
  const canSave = hasChanges() && !nameErr && name.trim().length >= 2;

  if (loading) {
    return (
      <View style={[styles.flex, styles.center]}>
        <Spinner />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ActionSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Change Photo"
        actions={avatarActions}
      />

      <ScreenHeader
        title="Edit Profile"
        onBack={() => confirmDiscard() !== false && !hasChanges() && navigation.goBack()}
        right={
          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave || saving}
            style={styles.saveBtn}
          >
            {saving ? (
              <Spinner size={18} color={COLORS.teal} />
            ) : (
              <Text style={[styles.saveBtnText, (!canSave || saving) && styles.saveBtnDisabled]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {isUploading && (
              <View style={styles.uploadRing}>
                <Text style={styles.uploadPct}>{progress}%</Text>
              </View>
            )}
            <Avatar uri={original?.avatarUrl} name={name || user?.name} size={120} />
          </View>
          <TouchableOpacity
            style={styles.changePhotoBtn}
            onPress={() => setPickerVisible(true)}
            disabled={isUploading}
            activeOpacity={0.7}
          >
            <Text style={styles.changePhotoText}>
              {isUploading ? `Uploading… ${progress}%` : 'Change Photo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form fields */}
        <View style={styles.form}>
          <Input
            label="Your name"
            placeholder="Arjun Sharma"
            value={name}
            onChangeText={setName}
            error={nameErr}
            maxLength={100}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Input
            label="Bio"
            placeholder="Tell citizens who you are and what you care about…"
            value={bio}
            onChangeText={setBio}
            error={null}
            maxLength={500}
            showCount
            multiline
            numberOfLines={4}
            inputStyle={styles.bioInput}
            returnKeyType="default"
          />

          <LocationPicker value={location} onChange={setLocation} />
        </View>
      </ScrollView>

      {/* Sticky save button */}
      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity
          style={[styles.savePrimary, (!canSave || saving) && styles.savePrimaryDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <Spinner size={20} color="#fff" />
          ) : (
            <Text style={styles.savePrimaryText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.pageBg },
  center: { alignItems: 'center', justifyContent: 'center' },

  scroll: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    gap: SPACING.lg,
  },

  // Header save button
  saveBtn: { paddingHorizontal: 4 },
  saveBtnText: { fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold, color: COLORS.teal },
  saveBtnDisabled: { color: COLORS.textMuted },

  // Avatar
  avatarSection: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  uploadRing: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: COLORS.teal,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPct: {
    position: 'absolute',
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.teal,
  },
  changePhotoBtn: { paddingVertical: 6, paddingHorizontal: 16 },
  changePhotoText: {
    fontSize: FONTS.size.md,
    color: COLORS.teal,
    fontWeight: FONTS.weight.semibold,
  },

  // Form
  form: { gap: SPACING.lg },
  bioInput: { height: 100, textAlignVertical: 'top' },

  // Sticky footer
  stickyFooter: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.pageBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  savePrimary: {
    backgroundColor: COLORS.deepTeal,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  savePrimaryDisabled: { backgroundColor: 'rgba(13,79,79,0.35)' },
  savePrimaryText: {
    color: '#fff',
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.bold,
  },
});
