/**
 * Jest setup file for mobile tests.
 * Mocks native modules that aren't available in the Node test environment.
 */

// AsyncStorage — mock the whole native module
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-constants — provide a minimal hostUri for config.js
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: { hostUri: '10.0.2.2:8081', extra: {} },
  },
}));

// expo-linear-gradient — render as a plain View in tests
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

// react-native-safe-area-context — already mocked per-file but provide global fallback
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
}));

// Silence console.warn in tests unless needed
global.console.warn = jest.fn();
