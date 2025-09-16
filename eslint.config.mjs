// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['dist', 'node_modules', 'eslint.config.mjs'] },

  js.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      // import hygiene
      'import/order': ['error', { 'newlines-between': 'always' }],

      // prefer type-only imports
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // unused code
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'unused-imports/no-unused-imports': 'error',

      // relaxed while API is in flux
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Test files: enable Jest globals
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      // nothing special here; just the globals
    },
  },

  // keep Prettier last
  prettier,
];
