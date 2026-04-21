import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useDraftDrainer } from '../hooks/useDraftDrainer';
import { useNotificationDeepLink } from '../hooks/useNotificationDeepLink';
import SplashScreen from '../screens/SplashScreen';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';

const linking = {
  prefixes: ['prajashakti://', 'https://prajashakti.in'],
  config: {
    screens: {
      FeedTab: {
        screens: {
          Feed: 'feed',
          IssueDetail: 'issues/:id',
        },
      },
      NotificationsTab: 'alerts',
      CreateTab: 'create',
      ProfileTab: {
        screens: {
          Profile: 'profile',
        },
      },
    },
  },
};

export default function RootNavigator() {
  const { isLoading, isLoggedIn } = useAuth();
  const navigationRef = useRef(null);
  useDraftDrainer();
  useNotificationDeepLink();

  // Hook for consumers to navigate from a notification payload.
  // Pattern: if a push notification arrives with `{ issueId }` in data,
  // call navigateToIssue(issueId). Wiring to expo-notifications happens
  // in a separate hook when that module is introduced.
  useEffect(() => {
    globalThis.__navigateToIssue = (issueId) => {
      if (!issueId || !navigationRef.current) return;
      navigationRef.current.navigate('FeedTab', {
        screen: 'IssueDetail',
        params: { id: issueId },
      });
    };
    return () => {
      delete globalThis.__navigateToIssue;
    };
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      {isLoggedIn ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
