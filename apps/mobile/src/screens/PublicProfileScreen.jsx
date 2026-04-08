import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { COLORS } from '../theme';

export default function PublicProfileScreen({ navigation, route }) {
  const name = route.params?.name ?? 'Citizen';

  return (
    <View style={styles.container}>
      <ScreenHeader title={name} subtitle="Public Profile" onBack={() => navigation.goBack()} />
      <EmptyState
        icon="👤"
        title="Public profile coming soon"
        subtitle="View any citizen's issues, reputation, and activity here."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },
});
