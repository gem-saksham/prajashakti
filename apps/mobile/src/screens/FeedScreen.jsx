import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function FeedScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>प्रजाशक्ति</Text>
        <Text style={styles.tagline}>POWER OF THE CITIZENS</Text>
      </View>
      <View style={styles.body}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📢</Text>
        <Text style={styles.title}>Feed coming in Sprint 3</Text>
        <Text style={styles.subtitle}>
          Day 1 complete — monorepo initialised, API running, mobile shell ready.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F0' },
  header: { backgroundColor: '#0D4F4F', padding: 16, paddingTop: 48 },
  logo: { fontSize: 24, fontWeight: '800', color: '#fff' },
  tagline: { fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 2, fontWeight: '600' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22 },
});
