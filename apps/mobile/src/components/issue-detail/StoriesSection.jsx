/**
 * StoriesSection (mobile) — mirrors web/src/components/issue-detail/StoriesSection.jsx.
 *
 * Lazy load stories (Load button → page 1), expandable share form with
 * textarea + char counter + anonymous checkbox. Anonymous is disabled after
 * the user has already posted one anonymous story for this issue (enforced
 * server-side; we hydrate hasPostedAnon from the fetched list).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { storyApi } from '../../utils/api';
import StoryCard from './StoryCard';

const MAX_CHARS = 1000;

export default function StoriesSection({ issueId, initialStoryCount = 0 }) {
  const { user } = useAuth();
  const { show } = useToast();

  const [stories, setStories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [page, setPage] = useState(1);

  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [storyCount, setStoryCount] = useState(initialStoryCount);
  const [hasPostedAnon, setHasPostedAnon] = useState(false);

  const loadPage = useCallback(
    async (p = 1, replace = false) => {
      setLoadingList(true);
      try {
        const res = await storyApi.list(issueId, p, 10);
        if (res.success) {
          setStories((prev) => (replace ? res.data : [...prev, ...res.data]));
          setPagination(res.pagination);
          setPage(p);
          setLoaded(true);
          if (user) {
            const alreadyAnon = (replace ? res.data : [...stories, ...res.data]).some(
              (s) => s.isAnonymous && s.author?.id === user.id,
            );
            if (alreadyAnon) setHasPostedAnon(true);
          }
        }
      } catch {
        show({ message: 'Failed to load stories', type: 'error' });
      } finally {
        setLoadingList(false);
      }
    },
    [issueId, user, stories, show],
  );

  async function handleSubmit() {
    if (content.trim().length < 10) {
      show({ message: 'Story must be at least 10 characters', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await storyApi.create(issueId, {
        content: content.trim(),
        is_anonymous: isAnonymous,
      });
      if (res.success) {
        setStories((prev) => [res.data, ...prev]);
        setStoryCount((c) => c + 1);
        if (isAnonymous) setHasPostedAnon(true);
        setContent('');
        setIsAnonymous(false);
        setExpanded(false);
        if (!loaded) setLoaded(true);
        show({ message: 'Story posted!', type: 'success' });
      }
    } catch (err) {
      show({ message: err?.message ?? 'Failed to post story', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHelpful(storyId) {
    try {
      const res = await storyApi.toggleHelpful(issueId, storyId);
      if (res.success) return res.data;
    } catch {
      show({ message: 'Failed to vote', type: 'error' });
    }
    return null;
  }

  async function handleRemove(storyId) {
    try {
      await storyApi.remove(issueId, storyId);
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      setStoryCount((c) => Math.max(0, c - 1));
      show({ message: 'Story removed', type: 'success' });
    } catch {
      show({ message: 'Failed to remove story', type: 'error' });
    }
  }

  const hasMore = pagination && page < pagination.totalPages;
  const remaining = pagination ? pagination.total - stories.length : 0;

  return (
    <View style={{ gap: 16 }}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>📖 Ground Reality Stories</Text>
          <Text style={styles.headerSub}>
            {storyCount} {storyCount === 1 ? 'story' : 'stories'} from citizens on the ground
          </Text>
        </View>
        {loaded ? (
          <TouchableOpacity onPress={() => loadPage(1, true)} disabled={loadingList}>
            <Text style={styles.refreshText}>{loadingList ? 'Loading…' : 'refresh'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Share form */}
      {user ? (
        expanded ? (
          <View style={styles.form}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Share what you've witnessed on the ground — your direct experience, observations, or evidence about this issue…"
              placeholderTextColor="#aaa"
              maxLength={MAX_CHARS}
              multiline
              style={styles.textarea}
              autoFocus
            />
            <View style={styles.formControls}>
              <Text
                style={[
                  styles.charCount,
                  content.length > MAX_CHARS * 0.9 && { color: COLORS.crimson },
                ]}
              >
                {content.length}/{MAX_CHARS}
              </Text>
              <TouchableOpacity
                activeOpacity={hasPostedAnon ? 1 : 0.7}
                onPress={() => !hasPostedAnon && setIsAnonymous((v) => !v)}
                style={styles.anonRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    isAnonymous && styles.checkboxOn,
                    hasPostedAnon && styles.checkboxDisabled,
                  ]}
                >
                  {isAnonymous ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={[styles.anonLabel, hasPostedAnon && { color: '#aaa' }]}>
                  Post anonymously
                </Text>
                {hasPostedAnon ? <Text style={styles.anonUsed}>(used)</Text> : null}
              </TouchableOpacity>
            </View>
            <View style={styles.formActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSubmit}
                disabled={submitting || content.trim().length < 10}
                style={{ flex: 1 }}
              >
                <LinearGradient
                  colors={['#0D4F4F', '#14897A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.submitBtn,
                    (submitting || content.trim().length < 10) && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.submitBtnText}>{submitting ? 'Posting…' : 'Post Story'}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setExpanded(false)}
                activeOpacity={0.8}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setExpanded(true);
              if (!loaded) loadPage(1, true);
            }}
            style={styles.expandBtn}
          >
            <Text style={styles.expandBtnText}>✍️ Share your ground reality story…</Text>
          </TouchableOpacity>
        )
      ) : (
        <Text style={styles.signInHint}>Sign in to share your story about this issue.</Text>
      )}

      {/* Stories list */}
      {loaded ? (
        <View style={{ gap: 12 }}>
          {stories.length === 0 && !loadingList ? (
            <Text style={styles.emptyText}>
              No stories yet. Be the first to share ground reality.
            </Text>
          ) : null}
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} onHelpful={handleHelpful} onRemove={handleRemove} />
          ))}
          {hasMore ? (
            <TouchableOpacity
              onPress={() => loadPage(page + 1)}
              disabled={loadingList}
              activeOpacity={0.8}
              style={styles.loadMoreBtn}
            >
              <Text style={styles.loadMoreText}>
                {loadingList ? 'Loading…' : `Load more stories (${remaining} remaining)`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {!loaded && !loadingList ? (
        <TouchableOpacity
          onPress={() => loadPage(1, true)}
          activeOpacity={0.8}
          style={styles.loadMoreBtn}
        >
          <Text style={styles.loadMoreText}>Load stories</Text>
        </TouchableOpacity>
      ) : null}
      {loadingList && !loaded ? (
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <ActivityIndicator color={COLORS.teal} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: FONTS.weight.bold, color: COLORS.deepTeal },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  refreshText: { fontSize: 12, color: COLORS.teal, fontWeight: FONTS.weight.medium },

  form: {
    backgroundColor: 'rgba(20,137,122,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(20,137,122,0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textPrimary,
    backgroundColor: '#fff',
  },
  formControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  charCount: { fontSize: 11, color: '#888' },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.3)',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  checkboxDisabled: { borderColor: '#ccc' },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: FONTS.weight.bold },
  anonLabel: { fontSize: 13, color: '#555' },
  anonUsed: { fontSize: 11, color: '#aaa' },

  formActions: { flexDirection: 'row', gap: 8 },
  submitBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.weight.semibold },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, color: '#555' },

  expandBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    width: '100%',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(20,137,122,0.4)',
    backgroundColor: 'rgba(20,137,122,0.04)',
  },
  expandBtnText: {
    color: COLORS.teal,
    fontSize: 14,
    fontWeight: FONTS.weight.medium,
  },
  signInHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 12,
  },

  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadMoreBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    color: COLORS.deepTeal,
    fontWeight: FONTS.weight.medium,
  },
});
