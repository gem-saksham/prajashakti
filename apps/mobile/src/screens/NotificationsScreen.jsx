import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { COLORS } from '../theme';

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Alerts" />
      <EmptyState
        icon="🔔"
        title="No alerts yet"
        subtitle="You'll be notified when officials respond to issues you support, and when campaigns reach milestones."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },
});
