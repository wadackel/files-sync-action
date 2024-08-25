import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginImport from 'eslint-plugin-import';
import configPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/'],
  },

  {
    plugins: {
      import: pluginImport,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'error',
      'no-nested-ternary': 'error',
      'import/named': 'off',
      'import/namespace': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/prefer-default-export': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/no-unresolved': 'off',
    },
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/array-type': 'error',
      '@typescript-eslint/no-use-before-define': 'error',
      'import/order': [
        'error',
        {
          'newlines-between': 'never',
        },
      ],
    },
  },

  {
    files: ['scripts/**/*'],
    rules: {
      'no-console': 'off',
    },
  },

  configPrettier,
);
