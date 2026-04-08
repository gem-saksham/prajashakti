import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedStack from './FeedStack';
import ProfileStack from './ProfileStack';
import CreateIssueScreen from '../screens/CreateIssueScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { COLORS, FONTS } from '../theme';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'FeedTab', icon: '📢', label: 'Feed' },
  { name: 'CreateTab', icon: '➕', label: 'Create', isCreate: true },
  { name: 'NotificationsTab', icon: '🔔', label: 'Alerts' },
  { name: 'ProfileTab', icon: '👤', label: 'Profile' },
];

function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[index];
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (tab.isCreate) {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              {/* crimson circle — exact match to web */}
              <View style={styles.createCircle}>
                <Text style={styles.createIcon}>{tab.icon}</Text>
              </View>
              <Text style={[styles.label, { color: COLORS.crimson }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={[styles.tabItem, focused && styles.tabItemActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.icon, !focused && styles.iconInactive]}>{tab.icon}</Text>
            <Text
              style={[
                styles.label,
                {
                  color: focused ? COLORS.deepTeal : COLORS.textMuted,
                  fontWeight: focused ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="FeedTab" component={FeedStack} />
      <Tab.Screen name="CreateTab" component={CreateIssueScreen} />
      <Tab.Screen name="NotificationsTab" component={NotificationsScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 3,
    borderTopWidth: 3,
    borderTopColor: 'transparent',
  },
  // Active tab gets a deep teal top border — exact match to web
  tabItemActive: {
    borderTopColor: COLORS.deepTeal,
  },
  icon: {
    fontSize: 22,
    lineHeight: 24,
  },
  iconInactive: {
    opacity: 0.55,
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
  },
  createCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.crimson,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    marginBottom: -2,
    shadowColor: COLORS.crimson,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  createIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
});
