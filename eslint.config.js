import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.*/**',
      'checkpoints/**',
      'test-results/**',
      'src/generated/**',
    ],
  },
  {
    files: ['src/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', 'world-source/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node,
        urchinDebug: 'readonly', fakePad: 'writable', iterationPad: 'writable',
        reviewPad: 'writable', panelPad: 'writable', feedbackPad: 'writable', voyagePad: 'writable',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
];
