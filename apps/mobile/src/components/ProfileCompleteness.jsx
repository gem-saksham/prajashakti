import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';

/**
 * Profile completeness card with animated progress bar and suggestion pills.
 * Hidden when score >= 100.
 *
 * @param {{
 *   score:         number,        // 0–100
 *   suggestions:   string[],
 *   onPillPress:   (suggestion: string) => void,
 * }} props
 */
export default function ProfileCompleteness({ score = 0, suggestions = [], onPillPress }) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: score / 100,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [score]);

  if (score >= 100) return null;

  const barColor = score < 40 ? COLORS.crimson : score < 70 ? COLORS.orange : COLORS.teal;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.heading}>Complete your profile</Text>
        <Text style={styles.score}>{score}%</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: barColor,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Suggestion pills */}
      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
          style={styles.pillsScroll}
        >
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.pill}
              onPress={() => onPillPress?.(s)}
              activeOpacity={0.7}
            >
              <Text style={styles.pillText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textPrimary,
  },
  score: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.bold,
    color: COLORS.deepTeal,
  },
  track: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 99,
  },
  pillsScroll: {
    marginHorizontal: -SPACING.lg,
  },
  pills: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
  },
  pill: {
    backgroundColor: 'rgba(13,79,79,0.07)',
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pillText: {
    fontSize: FONTS.size.sm,
    color: COLORS.deepTeal,
    fontWeight: FONTS.weight.medium,
  },
});
