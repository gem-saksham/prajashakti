import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../theme';

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

// ─── Toast types ──────────────────────────────────────────────────────────────

const TYPE_STYLES = {
  success: { bg: COLORS.success, icon: '✓' },
  error: { bg: COLORS.error, icon: '✕' },
  info: { bg: COLORS.teal, icon: 'ℹ' },
  warning: { bg: COLORS.orange, icon: '!' },
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();

  const show = useCallback(({ message, type = 'info', duration = 3000 }) => {
    const id = ++idRef.current;
    const anim = new Animated.Value(0);

    setToasts((prev) => [...prev, { id, message, type, anim }]);

    // Slide in
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

    // Auto-dismiss
    setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      });
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={[styles.container, { top: insets.top + SPACING.md }]} pointerEvents="box-none">
        {toasts.map(({ id, message, type, anim }) => {
          const { bg, icon } = TYPE_STYLES[type] ?? TYPE_STYLES.info;
          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [-60, 0],
          });
          return (
            <Animated.View
              key={id}
              style={[
                styles.toast,
                { backgroundColor: bg, transform: [{ translateY }], opacity: anim },
              ]}
            >
              <Text style={styles.icon}>{icon}</Text>
              <Text style={styles.message} numberOfLines={3}>
                {message}
              </Text>
              <TouchableOpacity onPress={() => dismiss(id)} hitSlop={8}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 9999,
    gap: 8,
    pointerEvents: 'box-none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    gap: 10,
    ...SHADOWS.md,
  },
  icon: {
    color: '#fff',
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.bold,
    width: 20,
    textAlign: 'center',
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    lineHeight: 18,
  },
  close: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FONTS.size.sm,
  },
});
