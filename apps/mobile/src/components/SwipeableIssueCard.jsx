/**
 * SwipeableIssueCard — wraps IssueCard with left/right swipe actions.
 *
 *   Swipe right  → Support (teal)
 *   Swipe left   → Share   (orange)
 *
 * Uses react-native-gesture-handler's Swipeable. On activation, the handler
 * fires Medium haptic, then the corresponding callback, then resets.
 */
import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Share, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import IssueCard from './IssueCard';
import { COLORS, FONTS, RADIUS } from '../theme';

function LeftAction({ dragX, supported }) {
  const scale = dragX.interpolate({
    inputRange: [0, 80, 160],
    outputRange: [0.4, 1, 1],
    extrapolate: 'clamp',
  });
  return (
    <View style={[styles.actionLeft, { backgroundColor: COLORS.teal }]}>
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        <Text style={styles.actionIcon}>🤝</Text>
        <Text style={styles.actionText}>{supported ? 'Unsupport' : 'Support'}</Text>
      </Animated.View>
    </View>
  );
}

function RightAction({ dragX }) {
  const scale = dragX.interpolate({
    inputRange: [-160, -80, 0],
    outputRange: [1, 1, 0.4],
    extrapolate: 'clamp',
  });
  return (
    <View style={[styles.actionRight, { backgroundColor: COLORS.orange }]}>
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        <Text style={styles.actionIcon}>🔗</Text>
        <Text style={styles.actionText}>Share</Text>
      </Animated.View>
    </View>
  );
}

export default function SwipeableIssueCard({ issue, supported, onSupport, onPress }) {
  const swipeRef = useRef(null);

  const handleLeftOpen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSupport?.(issue.id);
    setTimeout(() => swipeRef.current?.close(), 120);
  }, [issue.id, onSupport]);

  const handleRightOpen = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const url = `prajashakti://issues/${issue.id}`;
    const webUrl = `https://prajashakti.in/issues/${issue.id}`;
    try {
      await Share.share({
        title: issue.title,
        message: `${issue.title}\n\nSupport this civic issue on PrajaShakti:\n${webUrl}\n\n(Open in app: ${url})`,
      });
    } catch {
      // user cancelled — noop
    }
    setTimeout(() => swipeRef.current?.close(), 120);
  }, [issue.id, issue.title]);

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(_progress, dragX) => <LeftAction dragX={dragX} supported={supported} />}
      renderRightActions={(_progress, dragX) => <RightAction dragX={dragX} />}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') handleLeftOpen();
        else if (direction === 'right') handleRightOpen();
      }}
    >
      <IssueCard issue={issue} supported={supported} onSupport={onSupport} onPress={onPress} />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionLeft: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
    marginRight: -RADIUS.lg,
    flex: 1,
  },
  actionRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    borderTopRightRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    marginLeft: -RADIUS.lg,
    flex: 1,
  },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
  },
});
