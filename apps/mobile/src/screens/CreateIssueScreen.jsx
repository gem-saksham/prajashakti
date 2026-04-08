import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { COLORS } from '../theme';

export default function CreateIssueScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Report an Issue" />
      <EmptyState
        icon="🚨"
        title="Issue creation coming in Day 12+"
        subtitle="Full form with camera, location picker, category selection, and AI-assisted drafting."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },
});
