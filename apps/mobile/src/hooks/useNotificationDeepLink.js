/**
 * useNotificationDeepLink — listens for tapped push notifications and
 * navigates to the referenced issue.
 *
 * Works with two payload shapes:
 *   - `{ url: "prajashakti://issues/abc-123" }`  — handled by React Navigation's
 *     `linking` config automatically, no code needed here.
 *   - `{ issueId: "abc-123" }`  — consumed by this hook, which calls
 *     `globalThis.__navigateToIssue(issueId)` exposed by RootNavigator.
 *
 * Safe to mount before expo-notifications is installed: the module is
 * resolved lazily and absent-module errors are swallowed.
 */
import { useEffect } from 'react';

export function useNotificationDeepLink() {
  useEffect(() => {
    let sub;
    try {
      const Notifications = require('expo-notifications');
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response?.notification?.request?.content?.data;
        const issueId = data?.issueId;
        if (issueId && typeof globalThis.__navigateToIssue === 'function') {
          globalThis.__navigateToIssue(issueId);
        }
      });
    } catch {
      // expo-notifications not installed — deep links still work via the
      // NavigationContainer `linking` config's URL handling.
    }
    return () => {
      try {
        sub?.remove?.();
      } catch {
        /* ignore */
      }
    };
  }, []);
}
