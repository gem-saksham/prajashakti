import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import FeedScreen from './src/screens/FeedScreen';
import CreateIssueScreen from './src/screens/CreateIssueScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const COLORS = {
  deepTeal: '#0D4F4F',
  teal: '#14897A',
  crimson: '#DC143C',
  bg: '#F4F5F0',
  white: '#FFFFFF',
  textMuted: '#888888',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.deepTeal,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: 'rgba(0,0,0,0.08)',
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Issues',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📢</Text>,
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateIssueScreen}
        options={{
          tabBarLabel: 'Report',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>➕</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  // TODO (Day 12): Add auth state management
  const isLoggedIn = false;

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={COLORS.deepTeal} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
