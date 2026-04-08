import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';

/**
 * Native-feeling bottom sheet action menu.
 *
 * @param {{
 *   visible:  boolean,
 *   onClose:  () => void,
 *   title?:   string,
 *   actions:  Array<{ label: string, icon?: string, onPress: () => void, destructive?: boolean }>,
 * }} props
 */
export default function ActionSheet({ visible, onClose, title, actions = [] }) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function handleAction(action) {
    onClose();
    // Small delay so the sheet closes before the action fires
    setTimeout(() => action.onPress(), 250);
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + SPACING.sm },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Optional title */}
        {title ? <Text style={styles.title}>{title}</Text> : null}

        {/* Action items */}
        {actions.map((action, index) => {
          const isLast = index === actions.length - 1;
          return (
            <TouchableOpacity
              key={action.label}
              style={[styles.action, !isLast && styles.actionBorder]}
              onPress={() => handleAction(action)}
              activeOpacity={0.6}
            >
              {action.icon ? <Text style={styles.actionIcon}>{action.icon}</Text> : null}
              <Text style={[styles.actionLabel, action.destructive && styles.actionDestructive]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Cancel — always last, separated */}
        <TouchableOpacity
          style={[styles.action, styles.cancelAction]}
          onPress={onClose}
          activeOpacity={0.6}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 4,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  actionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionIcon: {
    fontSize: 20,
    width: 28,
  },
  actionLabel: {
    fontSize: FONTS.size.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weight.medium,
  },
  actionDestructive: {
    color: COLORS.crimson,
  },
  cancelAction: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    justifyContent: 'center',
  },
  cancelLabel: {
    fontSize: FONTS.size.lg,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.semibold,
    textAlign: 'center',
    width: '100%',
  },
});
