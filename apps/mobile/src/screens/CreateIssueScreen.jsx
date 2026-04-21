/**
 * CreateIssueScreen — photo-first 4-step wizard.
 *
 * Steps: Capture → Describe → Location → Review
 * Features: autosave draft (24h TTL), resume banner, discard confirm,
 * per-photo upload progress, success overlay with share, offline queue.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING } from '../theme';
import { useIssueDraft } from '../hooks/useIssueDraft';
import { issueApi, photoApi, uploadToS3 } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { enqueueDraft, isOnline } from '../services/draftQueue';
import CaptureStep from '../components/issue/CaptureStep';
import DescribeStep from '../components/issue/DescribeStep';
import LocationStep from '../components/issue/LocationStep';
import ReviewStep from '../components/issue/ReviewStep';
import SubmitOverlay from '../components/issue/SubmitOverlay';

const STEPS = [
  { number: 1, title: 'Capture the evidence', subtitle: 'Photos make issues 3× more actionable' },
  { number: 2, title: "What's happening?", subtitle: 'Title, description, category & urgency' },
  { number: 3, title: 'Where is it?', subtitle: 'Location routes your issue correctly' },
  { number: 4, title: 'Review & publish', subtitle: 'Final look before going live' },
];

function StepDot({ state, number }) {
  const bg =
    state === 'done' ? COLORS.teal : state === 'active' ? COLORS.deepTeal : 'rgba(0,0,0,0.1)';
  const fg = state === 'done' || state === 'active' ? '#fff' : COLORS.textMuted;
  return (
    <View style={[styles.stepDot, { backgroundColor: bg }]}>
      <Text style={[styles.stepDotText, { color: fg }]}>{state === 'done' ? '✓' : number}</Text>
    </View>
  );
}

function ProgressRow({ step, total, onJump }) {
  return (
    <View>
      <View style={styles.stepsRow}>
        {STEPS.map((s) => {
          const state = s.number < step ? 'done' : s.number === step ? 'active' : 'pending';
          const short = s.title.split(' ').slice(0, 2).join(' ');
          const canJump = s.number < step;
          const Wrap = canJump ? TouchableOpacity : View;
          return (
            <Wrap
              key={s.number}
              style={styles.stepCell}
              {...(canJump ? { onPress: () => onJump?.(s.number), activeOpacity: 0.7 } : {})}
            >
              <StepDot state={state} number={s.number} />
              <Text
                style={[
                  styles.stepLabel,
                  state === 'active' && styles.stepLabelActive,
                  state === 'done' && styles.stepLabelDone,
                ]}
                numberOfLines={1}
              >
                {short}
              </Text>
            </Wrap>
          );
        })}
      </View>
      <View style={styles.track}>
        <LinearGradient
          colors={[COLORS.deepTeal, COLORS.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${((step - 1) / (total - 1)) * 100}%` }]}
        />
      </View>
    </View>
  );
}

function ResumeBanner({ onResume, onDiscard }) {
  return (
    <View style={styles.resumeBanner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.resumeTitle}>📝 Resume your draft?</Text>
        <Text style={styles.resumeSub}>You have an unfinished issue from earlier.</Text>
      </View>
      <TouchableOpacity
        style={styles.resumeDiscard}
        onPress={onDiscard}
        activeOpacity={0.7}
        accessibilityLabel="Discard saved draft"
      >
        <Text style={styles.resumeDiscardText}>Discard</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onResume}
        accessibilityLabel="Resume saved draft"
      >
        <LinearGradient
          colors={[COLORS.deepTeal, COLORS.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.resumePrimary}
        >
          <Text style={styles.resumePrimaryText}>Resume →</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

export default function CreateIssueScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { show } = useToast();
  const {
    step,
    setStep,
    draft,
    updateDraft,
    saveDraft,
    clearDraft,
    stepValid,
    hasSavedDraft,
    dismissSavedDraft,
    resumeSavedDraft,
  } = useIssueDraft();

  const [submitState, setSubmitState] = useState(null); // null | 'submitting' | 'success' | 'error'
  const [submittedId, setSubmittedId] = useState(null);
  const [submittedTitle, setSubmittedTitle] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [uploadingPhotos, setUploadingPhotos] = useState([]);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const scrollRef = useRef(null);

  const currentStep = STEPS[step - 1];
  const isLastStep = step === STEPS.length;
  const canProceed = stepValid[step];

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        show({ message: 'Please log in to report an issue', type: 'warning' });
        navigation.navigate('FeedTab');
      }
    }, [user, navigation, show]),
  );

  function scrollTop() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function goNext() {
    if (!canProceed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step < STEPS.length) {
      setStep(step + 1);
      scrollTop();
    }
  }

  function goBack() {
    if (step > 1) {
      setStep(step - 1);
      scrollTop();
    } else {
      setDiscardConfirm(true);
    }
  }

  function jumpToStep(n) {
    if (n < step) {
      setStep(n);
      scrollTop();
    }
  }

  function handleExit() {
    saveDraft();
    navigation.navigate('FeedTab');
  }

  function goHome() {
    setSubmitState(null);
    navigation.navigate('FeedTab');
  }

  function goViewIssue() {
    if (!submittedId) return goHome();
    setSubmitState(null);
    navigation.navigate('FeedTab', {
      screen: 'IssueDetail',
      params: { id: submittedId },
    });
  }

  async function performSubmit() {
    setSubmitError('');
    setSubmitState('submitting');

    const photosWithFiles = (draft.photos || []).filter((p) => p.uri);
    // Seed progress state
    setUploadingPhotos(photosWithFiles.map((p) => ({ ...p, progress: 0, status: 'pending' })));

    try {
      const issueBody = {
        title: draft.title,
        description: draft.description,
        category: draft.category,
        urgency: draft.urgency,
        location_lat: draft.location.lat,
        location_lng: draft.location.lng,
        district: draft.location.district || undefined,
        state: draft.location.state || undefined,
        pincode: draft.location.pincode || undefined,
        formatted_address: draft.location.displayName || undefined,
        is_anonymous: false,
      };
      if (draft.ministryId) issueBody.ministry_id = draft.ministryId;
      if (draft.departmentId) issueBody.department_id = draft.departmentId;
      if (draft.suggestedOfficialIds?.length) {
        issueBody.suggested_official_ids = draft.suggestedOfficialIds;
      }

      const issueRes = await issueApi.create(issueBody);
      const issueId = issueRes.data.id;

      for (const photo of photosWithFiles) {
        const markProgress = (progress, status) => {
          setUploadingPhotos((prev) =>
            prev.map((p) => (p.id === photo.id ? { ...p, progress, status } : p)),
          );
        };
        try {
          markProgress(10, 'pending');
          const urlRes = await photoApi.requestUploadUrl(issueId, photo.type);
          const { uploadUrl, fileKey } = urlRes.data;
          markProgress(40, 'pending');
          await uploadToS3(uploadUrl, {
            uri: photo.uri,
            type: photo.type,
            name: photo.name,
          });
          markProgress(85, 'pending');
          await photoApi.confirm(issueId, fileKey);
          markProgress(100, 'done');
        } catch {
          markProgress(100, 'failed');
          // non-fatal — issue already exists
        }
      }

      setSubmittedId(issueId);
      setSubmittedTitle(draft.title);
      setSubmitState('success');
      clearDraft();
    } catch (err) {
      setSubmitState('error');
      const code = err?.error?.code;
      if (code === 'TOO_MANY_REQUESTS' || err?.status === 429) {
        setSubmitError("You're submitting too quickly. Please wait a moment and try again.");
      } else if (err?.status === 400) {
        setSubmitError(
          err?.error?.message || 'Some fields are invalid. Please check and try again.',
        );
      } else if (err?.status === 401) {
        setSubmitError('Your session expired. Please log in again.');
      } else {
        setSubmitError('Failed to submit. Your draft is saved. Please try again.');
      }
    }
  }

  async function handleSubmit() {
    if (!stepValid[4] || submitState === 'submitting') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const online = await isOnline();
    if (!online) {
      await enqueueDraft(draft);
      show({
        message: "You're offline — we'll publish this when you reconnect.",
        type: 'info',
      });
      clearDraft();
      navigation.navigate('FeedTab');
      return;
    }

    await performSubmit();
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 0, android: 24 })}
    >
      <View style={[styles.pageHeader, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={10}
          style={styles.headerBtn}
          accessibilityLabel="Go back"
        >
          <Text style={styles.headerBtnIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Report an Issue</Text>
        </View>
        <TouchableOpacity
          onPress={handleExit}
          hitSlop={10}
          style={styles.saveExit}
          accessibilityLabel="Save and exit"
        >
          <Text style={styles.saveExitText}>Save &amp; exit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollBody, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {hasSavedDraft && (
          <ResumeBanner onResume={resumeSavedDraft} onDiscard={dismissSavedDraft} />
        )}

        <View style={{ marginBottom: SPACING.xxl }}>
          <ProgressRow step={step} total={STEPS.length} onJump={jumpToStep} />
        </View>

        <View style={{ marginBottom: SPACING.xxl }}>
          <Text style={styles.stepKicker}>
            Step {step} of {STEPS.length}
          </Text>
          <Text style={styles.stepTitle}>{currentStep.title}</Text>
          <Text style={styles.stepSub}>{currentStep.subtitle}</Text>
        </View>

        {step === 1 && <CaptureStep draft={draft} onUpdate={updateDraft} onSkip={goNext} />}
        {step === 2 && (
          <DescribeStep draft={draft} onUpdate={updateDraft} location={draft.location} />
        )}
        {step === 3 && <LocationStep draft={draft} onUpdate={updateDraft} />}
        {step === 4 && <ReviewStep draft={draft} onUpdate={updateDraft} onJumpTo={jumpToStep} />}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {step > 1 && (
          <TouchableOpacity
            onPress={goBack}
            activeOpacity={0.75}
            style={styles.backBtn}
            accessibilityLabel="Previous step"
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        )}

        {!isLastStep ? (
          <TouchableOpacity
            onPress={goNext}
            disabled={!canProceed}
            activeOpacity={0.85}
            style={{ flex: 1 }}
            accessibilityLabel="Next step"
            accessibilityState={{ disabled: !canProceed }}
          >
            {canProceed ? (
              <LinearGradient
                colors={[COLORS.deepTeal, COLORS.teal]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  {step === 1 && (draft.photos || []).length === 0
                    ? 'Skip & Continue →'
                    : 'Next Step →'}
                </Text>
              </LinearGradient>
            ) : (
              <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
                <Text style={styles.primaryBtnTextDisabled}>Next Step →</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canProceed || submitState === 'submitting'}
            activeOpacity={0.85}
            style={{ flex: 1 }}
            accessibilityLabel="Submit issue"
            accessibilityState={{ disabled: !canProceed }}
          >
            {canProceed && submitState !== 'submitting' ? (
              <LinearGradient
                colors={[COLORS.crimson, '#c01234']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>🚩 Publish Issue</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
                <Text style={styles.primaryBtnTextDisabled}>🚩 Publish Issue</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {!!submitState && (
        <SubmitOverlay
          state={submitState}
          photos={uploadingPhotos}
          issueId={submittedId}
          issueTitle={submittedTitle}
          error={submitError}
          onHome={goHome}
          onViewIssue={goViewIssue}
          onRetry={submitState === 'error' ? performSubmit : undefined}
        />
      )}

      {/* Discard confirm */}
      <Modal
        visible={discardConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscardConfirm(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.discardCard}>
            <Text style={styles.discardTitle}>Discard issue?</Text>
            <Text style={styles.discardBody}>
              Your progress will be saved as a draft and you can resume it within 24 hours.
            </Text>
            <View style={styles.discardActions}>
              <TouchableOpacity
                style={styles.discardBtn}
                activeOpacity={0.7}
                onPress={() => {
                  Alert.alert(
                    'Discard draft?',
                    'This will permanently delete your unsaved progress.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => {
                          clearDraft();
                          setDiscardConfirm(false);
                          navigation.navigate('FeedTab');
                        },
                      },
                    ],
                  );
                }}
              >
                <Text style={styles.discardBtnText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                style={{ flex: 1 }}
                onPress={() => {
                  saveDraft();
                  setDiscardConfirm(false);
                  navigation.navigate('FeedTab');
                }}
              >
                <LinearGradient
                  colors={[COLORS.deepTeal, COLORS.teal]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtn}
                >
                  <Text style={styles.saveBtnText}>Save draft</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setDiscardConfirm(false)}
              activeOpacity={0.7}
              style={styles.continueEdit}
            >
              <Text style={styles.continueEditText}>Continue editing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.pageBg },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.pageBg,
  },
  headerBtn: { paddingVertical: 6, paddingRight: 10 },
  headerBtnIcon: { fontSize: 22, color: COLORS.textSecondary },
  headerTitle: {
    fontSize: 20,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.deepTeal,
  },
  saveExit: { paddingVertical: 6, paddingLeft: 10 },
  saveExitText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.semibold,
  },

  scrollBody: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },

  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepCell: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: { fontSize: 13, fontWeight: FONTS.weight.bold },
  stepLabel: {
    fontSize: 10,
    fontWeight: FONTS.weight.medium,
    color: '#aaa',
    textAlign: 'center',
    maxWidth: 72,
  },
  stepLabelActive: { fontWeight: FONTS.weight.bold, color: COLORS.deepTeal },
  stepLabelDone: { color: COLORS.teal },

  track: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 99,
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: '100%', borderRadius: 99 },

  stepKicker: {
    fontSize: 11,
    fontWeight: FONTS.weight.bold,
    letterSpacing: 0.8,
    color: COLORS.teal,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.deepTeal,
    marginBottom: 4,
  },
  stepSub: { fontSize: 13, color: COLORS.textMuted },

  resumeBanner: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: 'rgba(20,137,122,0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SPACING.lg,
  },
  resumeTitle: {
    fontSize: 14,
    fontWeight: FONTS.weight.bold,
    color: COLORS.deepTeal,
    marginBottom: 2,
  },
  resumeSub: { fontSize: 12, color: COLORS.textMuted },
  resumeDiscard: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: COLORS.pageBg,
    borderRadius: 8,
  },
  resumeDiscardText: {
    fontSize: 12,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textMuted,
  },
  resumePrimary: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  resumePrimaryText: {
    fontSize: 12,
    fontWeight: FONTS.weight.bold,
    color: '#fff',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
    paddingTop: 12,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
  },

  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { backgroundColor: 'rgba(0,0,0,0.08)' },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: FONTS.weight.heavy,
  },
  primaryBtnTextDisabled: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: FONTS.weight.heavy,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  discardCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 360,
  },
  discardTitle: {
    fontSize: 16,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  discardBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  discardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  discardBtn: {
    flex: 1,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(220,20,60,0.3)',
    borderRadius: 10,
    alignItems: 'center',
  },
  discardBtnText: {
    fontSize: 14,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.crimson,
  },
  saveBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: FONTS.weight.bold,
    color: '#fff',
  },
  continueEdit: {
    marginTop: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  continueEditText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
