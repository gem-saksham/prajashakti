import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { COLORS } from '../theme';

export default function IssueDetailScreen({ navigation, route }) {
  const title = route.params?.title ?? 'Issue Detail';

  return (
    <View style={styles.container}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <EmptyState
        icon="🔍"
        title="Issue detail coming soon"
        subtitle="Full escalation timeline, evidence wall, supporter rally, and RTI generator will be built here."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },
});
