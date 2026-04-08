module.exports = {
  testEnvironment:   'node',
  transform:         {},               // no transform — native ESM via --experimental-vm-modules
  testMatch:         ['**/tests/**/*.test.js'],
  testTimeout:       15000,
  globalSetup:       '<rootDir>/tests/globalSetup.cjs',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',   // entry point, not unit testable
  ],
};
