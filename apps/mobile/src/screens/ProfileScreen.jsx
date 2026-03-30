import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 36 }}>👤</Text>
        </View>
        <Text style={styles.title}>Profile coming in Sprint 1</Text>
        <Text style={styles.subtitle}>Days 10-13 will build the full profile with avatar, bio, location, and reputation score.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F0' },
  header: { backgroundColor: '#0D4F4F', padding: 16, paddingTop: 48 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22 },
});
