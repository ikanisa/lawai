const { createConfig } = require('./shared.cjs');

function createDenoConfig(options = {}) {
  const {
    extraExtends = [],
    extraIgnore = [],
    overrides = [],
    rules = {},
  } = options;

  return createConfig({
    env: { browser: false },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      ...extraExtends,
    ],
    ignore: ['deno.lock', '**/fixtures/**', ...extraIgnore],
    overrides,
    parserOptions: {
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      ...rules,
    },
    globals: {
      Deno: 'readonly',
      Response: 'readonly',
      Request: 'readonly',
      console: 'readonly',
      fetch: 'readonly',
    },
  });
}

module.exports = createDenoConfig;
