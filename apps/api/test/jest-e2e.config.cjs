/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  setupFiles: ['<rootDir>/setup-env.ts'],
  // Test the shared engine from source so no rebuild is needed between edits.
  moduleNameMapper: { '^@finance/shared$': '<rootDir>/../../../packages/shared/src/index.ts' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
};
