import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function CreateIssueScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report an Issue</Text>
      </View>
      <View style={styles.body}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🚨</Text>
        <Text style={styles.title}>Issue creation coming in Sprint 2</Text>
        <Text style={styles.subtitle}>Days 23-27 will build the full issue creation form with camera, location, and AI drafting.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F0' },
  header: { backgroundColor: '#0D4F4F', padding: 16, paddingTop: 48 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22 },
});
