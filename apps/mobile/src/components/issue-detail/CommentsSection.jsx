/**
 * CommentsSection (mobile) — scaffold placeholder matching web.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '../../theme';

export default function CommentsSection({ commentCount = 0 }) {
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>💬</Text>
      <Text style={styles.title}>
        {commentCount > 0
          ? `${commentCount} comment${commentCount !== 1 ? 's' : ''}`
          : 'No comments yet'}
      </Text>
      <Text style={styles.sub}>Comments coming in a future update</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emoji: { fontSize: 20, marginBottom: 6 },
  title: { fontSize: 14, fontWeight: FONTS.weight.semibold, color: '#555' },
  sub: { fontSize: 12, color: '#888', marginTop: 4 },
});
