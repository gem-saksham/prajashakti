/**
 * StoryCard (mobile) — mirrors apps/web/src/components/issue-detail/StoryCard.jsx.
 *
 * Anonymous stories show a gray "?" avatar, named stories show a teal gradient
 * avatar with the first letter. Helpful vote toggle + Remove (own, non-anon only).
 */
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getDevHost, API_URL } from '../../utils/config';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function resolveMediaUri(url) {
  if (!url) return null;
  if (url.startsWith('http')) {
    const m = url.match(/^http:\/\/(?:localhost|127\.0\.0\.1):4566\/[^/?]+\/([^?]+)/);
    if (m) {
      const host = getDevHost();
      if (host && host !== 'localhost') {
        return `http://${host}:3000/api/v1/media/${m[1]}`;
      }
    }
    return url;
  }
  return `${API_URL}/media/${url.replace(/^\//, '')}`;
}

export default function StoryCard({ story, onHelpful, onRemove }) {
  const { user } = useAuth();
  const [voted, setVoted] = useState(story.userVotedHelpful ?? false);
  const [count, setCount] = useState(story.helpfulCount ?? 0);
  const [loading, setLoading] = useState(false);

  const isOwn = user && !story.isAnonymous && story.author?.id === user.id;

  async function handleHelpful() {
    if (!user || loading) return;
    setLoading(true);
    try {
      const result = await onHelpful(story.id);
      if (result) {
        setVoted(result.userVoted);
        setCount(result.helpfulCount);
      }
    } finally {
      setLoading(false);
    }
  }

  const firstChar = story.isAnonymous ? '?' : (story.author?.name?.[0] ?? '?').toUpperCase();

  return (
    <View style={styles.card}>
      {/* Author row */}
      <View style={styles.authorRow}>
        {story.isAnonymous ? (
          <View style={[styles.avatar, styles.avatarAnon]}>
            <Text style={styles.avatarText}>{firstChar}</Text>
          </View>
        ) : (
          <LinearGradient
            colors={['#0D4F4F', '#14897A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{firstChar}</Text>
          </LinearGradient>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.authorName} numberOfLines={1}>
            {story.isAnonymous ? 'Anonymous Citizen' : (story.author?.name ?? 'Citizen')}
          </Text>
          <Text style={styles.authorTime}>{timeAgo(story.createdAt)}</Text>
        </View>
        {story.isAnonymous ? (
          <View style={styles.anonTag}>
            <Text style={styles.anonTagText}>Anonymous</Text>
          </View>
        ) : null}
      </View>

      {/* Content */}
      <Text style={styles.content}>{story.content}</Text>

      {/* Photos */}
      {story.photos?.length > 0 ? (
        <View style={styles.photoWrap}>
          {story.photos.map((p, i) => (
            <Image
              key={i}
              source={{ uri: resolveMediaUri(p.url) }}
              style={styles.photo}
              resizeMode="cover"
            />
          ))}
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={handleHelpful}
          disabled={!user || loading}
          activeOpacity={0.75}
          style={[styles.helpfulBtn, voted && styles.helpfulBtnActive]}
        >
          <Text style={[styles.helpfulText, voted && styles.helpfulTextActive]}>
            👍 Helpful · {count}
          </Text>
        </TouchableOpacity>
        {isOwn ? (
          <TouchableOpacity
            onPress={() => onRemove(story.id)}
            activeOpacity={0.75}
            style={styles.removeBtn}
          >
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAnon: { backgroundColor: 'rgba(0,0,0,0.1)' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: FONTS.weight.bold },
  authorName: { fontSize: 13, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary },
  authorTime: { fontSize: 11, color: '#888' },
  anonTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: RADIUS.pill,
  },
  anonTagText: { fontSize: 11, color: '#888' },

  content: { fontSize: 14, lineHeight: 22, color: '#333' },

  photoWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: {
    width: 96,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#f0f0ee',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  helpfulBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  helpfulBtnActive: { borderColor: COLORS.teal, backgroundColor: 'rgba(20,137,122,0.08)' },
  helpfulText: { fontSize: 13, color: '#555' },
  helpfulTextActive: { color: COLORS.teal, fontWeight: FONTS.weight.semibold },

  removeBtn: {
    marginLeft: 'auto',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(220,20,60,0.2)',
  },
  removeText: { fontSize: 12, color: COLORS.crimson },
});
