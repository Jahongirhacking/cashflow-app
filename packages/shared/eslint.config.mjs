import { baseConfig } from '@finance/config/eslint/base.mjs';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // node:test's describe/it return promises that the runner tracks itself.
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    files: ['**/*.mjs'],
    ...(await import('typescript-eslint')).default.configs.disableTypeChecked,
  },
];
