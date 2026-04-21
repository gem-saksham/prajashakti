import { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { storyApi } from '../../utils/api.js';
import StoryCard from './StoryCard.jsx';
import { useToast } from '../Toast.jsx';

const MAX_CHARS = 1000;

export default function StoriesSection({ issueId, initialStoryCount = 0 }) {
  const { user } = useAuth();
  const { showToast } = useToast();

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
          // detect if current user already has an anonymous story
          if (user) {
            const allStories = replace ? res.data : [...stories, ...res.data];
            const alreadyAnon = allStories.some((s) => s.isAnonymous && s.author?.id === user.id);
            if (alreadyAnon) setHasPostedAnon(true);
          }
        }
      } catch {
        showToast('Failed to load stories', 'error');
      } finally {
        setLoadingList(false);
      }
    },
    [issueId, showToast],
  );

  function handleToggle() {
    if (!loaded && !loadingList) loadPage(1, true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (content.trim().length < 10) {
      showToast('Story must be at least 10 characters', 'error');
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
        showToast('Story posted!', 'success');
      }
    } catch (err) {
      showToast(err?.message ?? 'Failed to post story', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHelpful(storyId) {
    try {
      const res = await storyApi.toggleHelpful(issueId, storyId);
      if (res.success) return res.data;
    } catch {
      showToast('Failed to vote', 'error');
    }
    return null;
  }

  async function handleRemove(storyId) {
    try {
      await storyApi.remove(issueId, storyId);
      setStories((prev) => prev.filter((s) => s.id !== storyId));
      setStoryCount((c) => Math.max(0, c - 1));
      showToast('Story removed', 'success');
    } catch {
      showToast('Failed to remove story', 'error');
    }
  }

  const hasMore = pagination && page < pagination.totalPages;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div
        onClick={() => {
          setExpanded(false);
          handleToggle();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0D4F4F' }}>
            📖 Ground Reality Stories
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>
            {storyCount} {storyCount === 1 ? 'story' : 'stories'} from citizens on the ground
          </p>
        </div>
        {loaded && (
          <span style={{ fontSize: 12, color: '#14897A', fontWeight: 500 }}>
            {loadingList ? 'Loading…' : 'refresh'}
          </span>
        )}
      </div>

      {/* Share form toggle */}
      {user ? (
        expanded ? (
          <form
            onSubmit={handleSubmit}
            style={{
              background: 'rgba(20,137,122,0.04)',
              border: '1.5px solid rgba(20,137,122,0.2)',
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share what you've witnessed on the ground — your direct experience, observations, or evidence about this issue…"
              maxLength={MAX_CHARS}
              rows={4}
              style={{
                resize: 'vertical',
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                outline: 'none',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11,
                  color: content.length > MAX_CHARS * 0.9 ? '#DC143C' : '#888',
                }}
              >
                {content.length}/{MAX_CHARS}
              </span>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: hasPostedAnon ? '#aaa' : '#555',
                  cursor: hasPostedAnon ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  disabled={hasPostedAnon}
                  style={{ accentColor: '#14897A' }}
                />
                Post anonymously
                {hasPostedAnon && <span style={{ fontSize: 11, color: '#aaa' }}>(used)</span>}
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={submitting || content.trim().length < 10}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: submitting ? 'wait' : 'pointer',
                  opacity: content.trim().length < 10 ? 0.5 : 1,
                }}
              >
                {submitting ? 'Posting…' : 'Post Story'}
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1.5px solid rgba(0,0,0,0.12)',
                  background: 'transparent',
                  fontSize: 14,
                  cursor: 'pointer',
                  color: '#555',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => {
              setExpanded(true);
              if (!loaded) loadPage(1, true);
            }}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              width: '100%',
              border: '1.5px dashed rgba(20,137,122,0.4)',
              background: 'rgba(20,137,122,0.04)',
              color: '#14897A',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            ✍️ Share your ground reality story…
          </button>
        )
      ) : (
        <p
          style={{ margin: 0, fontSize: 13, color: '#888', textAlign: 'center', padding: '12px 0' }}
        >
          Sign in to share your story about this issue.
        </p>
      )}

      {/* Stories list */}
      {loaded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {stories.length === 0 && !loadingList && (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: '#888',
                textAlign: 'center',
                padding: '20px 0',
              }}
            >
              No stories yet. Be the first to share ground reality.
            </p>
          )}
          {stories.map((s) => (
            <StoryCard
              key={s.id}
              story={s}
              issueId={issueId}
              onHelpful={handleHelpful}
              onRemove={handleRemove}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => loadPage(page + 1)}
              disabled={loadingList}
              style={{
                padding: '10px',
                borderRadius: 10,
                border: '1.5px solid rgba(0,0,0,0.12)',
                background: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                color: '#0D4F4F',
                fontWeight: 500,
              }}
            >
              {loadingList
                ? 'Loading…'
                : `Load more stories (${pagination.total - stories.length} remaining)`}
            </button>
          )}
        </div>
      )}

      {!loaded && !loadingList && (
        <button
          onClick={() => loadPage(1, true)}
          style={{
            padding: '10px',
            borderRadius: 10,
            border: '1.5px solid rgba(0,0,0,0.12)',
            background: '#fff',
            fontSize: 14,
            cursor: 'pointer',
            color: '#0D4F4F',
            fontWeight: 500,
          }}
        >
          Load stories
        </button>
      )}
      {loadingList && (
        <p style={{ margin: 0, fontSize: 13, color: '#888', textAlign: 'center' }}>
          Loading stories…
        </p>
      )}
    </div>
  );
}
