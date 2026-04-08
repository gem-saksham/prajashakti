import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';

// ── Shared primitives — match web exactly ────────────────────────────────────

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Toggle({ on, onChange }) {
  return (
    <Switch
      value={on}
      onValueChange={onChange}
      trackColor={{ false: 'rgba(0,0,0,0.15)', true: COLORS.teal }}
      thumbColor="#fff"
      ios_backgroundColor="rgba(0,0,0,0.15)"
    />
  );
}

function Row({ label, value, action, isLast }) {
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {action ?? null}
    </View>
  );
}

function ActionBtn({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.actionBtn} activeOpacity={0.75}>
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function PrimaryActionBtn({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.primaryActionBtn} activeOpacity={0.85}>
      <Text style={styles.primaryActionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({ onClose }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>⚠️</Text>
          <Text style={styles.modalTitle}>Delete Account</Text>
          <Text style={styles.modalBody}>
            This feature is not yet available. Your account and all your civic contributions are
            safe.
          </Text>
          <Text style={styles.modalNote}>Contact support if you need assistance.</Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.modalBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { show } = useToast();

  const [deleteOpen, setDeleteOpen] = useState(false);

  // Notifications — matches web exactly
  const [notifArea, setNotifArea] = useState(true);
  const [notifSupport, setNotifSupport] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifMilestones, setNotifMilestones] = useState(false);
  const [quietHours, setQuietHours] = useState(false);

  // Privacy
  const [showProfile, setShowProfile] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  function comingSoon() {
    show({ message: 'Coming soon!', type: 'info' });
  }

  const maskedPhone = user?.phone
    ? `+91 ${user.phone.slice(0, 5)} ${'•'.repeat(Math.max(0, user.phone.length - 5))}`
    : '—';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Account ── */}
        <Section title="Account">
          <Row label="Phone" value={maskedPhone} />
          <Row
            label="Email"
            value={user?.email ?? 'Not added'}
            action={<ActionBtn label={user?.email ? 'Edit' : 'Add'} onPress={comingSoon} />}
          />
          <Row
            label="Google"
            value={user?.googleId ? 'Linked' : 'Not linked'}
            action={!user?.googleId ? <ActionBtn label="Link" onPress={comingSoon} /> : null}
            isLast
          />
        </Section>

        {/* ── Verification ── */}
        <Section title="Verification">
          <Row
            label="Aadhaar"
            value={user?.isVerified ? 'Verified ✓' : 'Not verified — required for issue filing'}
            action={
              !user?.isVerified ? (
                <PrimaryActionBtn label="Verify Now" onPress={comingSoon} />
              ) : null
            }
            isLast
          />
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <Row
            label="New issues in my area"
            action={<Toggle on={notifArea} onChange={setNotifArea} />}
          />
          <Row
            label="Someone supports my issue"
            action={<Toggle on={notifSupport} onChange={setNotifSupport} />}
          />
          <Row
            label="Comments on my issues"
            action={<Toggle on={notifComments} onChange={setNotifComments} />}
          />
          <Row
            label="Campaign milestones"
            action={<Toggle on={notifMilestones} onChange={setNotifMilestones} />}
          />
          <Row
            label="Quiet hours"
            value="10 PM – 7 AM"
            action={<Toggle on={quietHours} onChange={setQuietHours} />}
            isLast
          />
        </Section>

        {/* ── Privacy ── */}
        <Section title="Privacy">
          <Row
            label="Show my profile publicly"
            action={<Toggle on={showProfile} onChange={setShowProfile} />}
          />
          <Row
            label="Show my location"
            action={<Toggle on={showLocation} onChange={setShowLocation} />}
          />
          <Row
            label="Show my activity"
            action={<Toggle on={showActivity} onChange={setShowActivity} />}
            isLast
          />
        </Section>

        {/* ── About ── */}
        <Section title="About">
          <Row label="App version" value="1.0.0" />
          <Row label="Phase" value="1 — Foundation" />
          <View style={[styles.row, styles.rowBorder, { justifyContent: 'center' }]}>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' }}>
              Made with ❤️ for India
            </Text>
          </View>
          <Row
            label="Privacy Policy"
            action={
              <TouchableOpacity onPress={() => Linking.openURL('https://prajashakti.in/privacy')}>
                <Text style={styles.linkText}>View →</Text>
              </TouchableOpacity>
            }
          />
          <Row
            label="Terms of Service"
            action={
              <TouchableOpacity onPress={() => Linking.openURL('https://prajashakti.in/terms')}>
                <Text style={styles.linkText}>View →</Text>
              </TouchableOpacity>
            }
            isLast
          />
        </Section>

        {/* ── Danger Zone ── */}
        <Section title="Danger Zone">
          <View style={styles.dangerInner}>
            <Text style={styles.dangerNote}>
              Once deleted, your account and all civic contributions cannot be recovered.
            </Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => setDeleteOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteBtnText}>Delete my account</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      {deleteOpen ? <DeleteModal onClose={() => setDeleteOpen(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  section: { gap: 0 },
  sectionHeader: {
    paddingHorizontal: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 52,
    gap: SPACING.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  rowLeft: { flex: 1 },
  rowLabel: {
    fontSize: 14,
    fontWeight: FONTS.weight.medium,
    color: COLORS.textPrimary,
  },
  rowValue: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  actionBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(20,137,122,0.4)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  actionBtnText: {
    color: COLORS.teal,
    fontSize: 12,
    fontWeight: FONTS.weight.semibold,
  },
  primaryActionBtn: {
    backgroundColor: COLORS.deepTeal,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    flexShrink: 0,
  },
  primaryActionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: FONTS.weight.bold,
  },
  linkText: {
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.teal,
  },
  dangerInner: {
    padding: SPACING.lg,
  },
  dangerNote: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: 14,
  },
  deleteBtn: {
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(220,20,60,0.3)',
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.crimson,
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  logoutText: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.crimson,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 28,
    maxWidth: 340,
    width: '100%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.crimson,
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalNote: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalBtn: {
    width: '100%',
    padding: 12,
    backgroundColor: COLORS.deepTeal,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: FONTS.weight.bold,
  },
});
