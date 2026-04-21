/**
 * FeedScreen — mirrors web IssuesPage:
 *   ScreenHeader → [search + sort] → filter chips → FlatList of IssueCards
 *
 * Infinite scroll via onEndReached. Pull-to-refresh via RefreshControl.
 * Supported IDs persist in AsyncStorage via useSupportedIds.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import ScreenHeader from '../components/ScreenHeader';
import SkeletonCard from '../components/SkeletonCard';
import SwipeableIssueCard from '../components/SwipeableIssueCard';
import OfflineBanner from '../components/OfflineBanner';
import FilterChips from '../components/issue/FilterChips';
import SortDropdown from '../components/issue/SortDropdown';
import IssueSearchBar from '../components/issue/IssueSearchBar';
import FilterPanel from '../components/issue/FilterPanel';
import FilterSummaryBar from '../components/issue/FilterSummaryBar';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { useIssueFilters } from '../hooks/useIssueFilters';
import { useInfiniteIssues } from '../hooks/useInfiniteIssues';
import { useSupportedIds } from '../hooks/useSupportedIds';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

export default function FeedScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { show } = useToast();

  const { filters, updateFilters, clearFilters, activeCount } = useIssueFilters();
  const supported = useSupportedIds();

  const {
    issues,
    total,
    isLoading,
    isRefreshing,
    isFetchingNextPage,
    isError,
    hasNextPage,
    refetch,
    fetchNextPage,
  } = useInfiniteIssues(filters);

  const [supporting, setSupporting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSupport = useCallback(
    async (issueId) => {
      if (!user) {
        show({ message: 'Please log in to support issues', type: 'warning' });
        return;
      }
      if (supporting) return;
      setSupporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const wasSupported = supported.has(issueId);
      const ok = await supported.toggle(issueId);
      setSupporting(false);
      if (!ok) {
        show({ message: "Couldn't update support. Please try again.", type: 'error' });
        return;
      }
      // Milestone detection — trigger success haptic when crossing a threshold
      if (!wasSupported) {
        const issue = issues.find((i) => i.id === issueId);
        const count = (issue?.supporterCount ?? 0) + 1;
        const milestones = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
        if (milestones.includes(count)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    },
    [user, supporting, supported, show, issues],
  );

  const handleOpenIssue = useCallback(
    (issueId) => {
      navigation.navigate('IssueDetail', { id: issueId });
    },
    [navigation],
  );

  const handleRefresh = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    refetch();
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }) => (
      <SwipeableIssueCard
        issue={item}
        supported={supported.has(item.id)}
        onSupport={handleSupport}
        onPress={handleOpenIssue}
      />
    ),
    [supported, handleSupport, handleOpenIssue],
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const hasFilters = activeCount > 0;

  return (
    <View style={styles.container}>
      <ScreenHeader title="प्रजाशक्ति" subtitle="POWER OF THE CITIZENS" />
      <OfflineBanner />

      {/* Filter bar (search + sort + chips) */}
      <View style={styles.filterBar}>
        <View style={styles.searchRow}>
          <IssueSearchBar value={filters.search} onChange={(q) => updateFilters({ search: q })} />
          <SortDropdown value={filters.sort} onChange={(s) => updateFilters({ sort: s })} />
        </View>

        <FilterChips filters={filters} onUpdate={updateFilters} />

        <FilterSummaryBar filters={filters} onUpdate={updateFilters} onClear={clearFilters} />

        {/* Count + more-filters row */}
        <View style={styles.countRow}>
          <TouchableOpacity
            onPress={() => setShowAdvanced(true)}
            activeOpacity={0.7}
            style={styles.moreBtn}
          >
            <Text style={styles.moreBtnText}>
              ▼ More filters{hasFilters ? ` (${activeCount})` : ''}
            </Text>
          </TouchableOpacity>
          <Text style={styles.countText}>
            {isLoading ? '…' : `${total.toLocaleString('en-IN')} issues`}
          </Text>
        </View>
      </View>

      <FilterPanel
        visible={showAdvanced}
        onClose={() => setShowAdvanced(false)}
        filters={filters}
        onUpdate={updateFilters}
      />

      <FlatList
        data={issues}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
          issues.length === 0 && { flex: 1 },
        ]}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage && !isLoading) fetchNextPage();
        }}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.teal}
            colors={[COLORS.teal]}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: SPACING.md }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : isError ? (
            <ErrorState onRetry={refetch} />
          ) : (
            <EmptyState
              hasFilters={hasFilters}
              onClear={clearFilters}
              onCreateIssue={() => navigation.getParent()?.navigate('CreateTab')}
            />
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={COLORS.teal} />
            </View>
          ) : !hasNextPage && issues.length > 0 ? (
            <Text style={styles.endMarker}>— {total.toLocaleString('en-IN')} issues total —</Text>
          ) : null
        }
      />
    </View>
  );
}

const ItemSeparator = () => <View style={{ height: SPACING.md }} />;

// ── Empty / error states ─────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear, onCreateIssue }) {
  if (hasFilters) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateEmoji}>🔍</Text>
        <Text style={styles.stateTitle}>No issues match your filters</Text>
        <Text style={styles.stateSub}>Try removing some filters or searching a wider area.</Text>
        <TouchableOpacity activeOpacity={0.85} onPress={onClear}>
          <LinearGradient
            colors={['#0D4F4F', '#14897A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stateBtn}
          >
            <Text style={styles.stateBtnText}>Clear all filters</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.stateWrap}>
      <Text style={styles.stateEmoji}>📢</Text>
      <Text style={styles.stateTitle}>No issues yet</Text>
      <Text style={styles.stateSub}>Be the first to raise a civic issue in your area.</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={onCreateIssue}>
        <LinearGradient
          colors={['#DC143C', '#c01234']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.stateBtn}
        >
          <Text style={styles.stateBtnText}>🚩 Report the first issue</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function ErrorState({ onRetry }) {
  return (
    <View style={styles.stateWrap}>
      <Text style={styles.stateEmoji}>⚠️</Text>
      <Text style={styles.stateTitle}>Couldn't load issues</Text>
      <Text style={styles.stateSub}>Check your connection and try again.</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={onRetry} style={styles.stateRetryBtn}>
        <Text style={styles.stateRetryBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },
  filterBar: {
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: 'rgba(244,245,240,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    gap: 8,
    zIndex: 50,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.lg,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: 2,
  },
  clearLink: { fontSize: 12, fontWeight: FONTS.weight.bold, color: COLORS.crimson },
  countText: { fontSize: 12, color: '#888', fontWeight: FONTS.weight.semibold },
  moreBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(13,79,79,0.25)',
    backgroundColor: 'rgba(13,79,79,0.04)',
  },
  moreBtnText: {
    fontSize: 12,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.deepTeal,
  },

  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  footerLoader: { paddingVertical: SPACING.lg, alignItems: 'center' },
  endMarker: {
    textAlign: 'center',
    paddingVertical: SPACING.lg,
    color: '#aaa',
    fontSize: 13,
    fontWeight: FONTS.weight.medium,
  },

  stateWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: SPACING.lg,
    gap: 10,
  },
  stateEmoji: { fontSize: 52, marginBottom: 2 },
  stateTitle: {
    fontSize: 18,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  stateSub: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  stateBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: RADIUS.sm,
  },
  stateBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.weight.bold },
  stateRetryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.deepTeal,
  },
  stateRetryBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.weight.semibold },
});
