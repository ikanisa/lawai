const path = require('node:path');
const { createConfig } = require('./shared.cjs');

function createNextConfig(options = {}) {
  const {
    tsconfigPath,
    extraExtends = [],
    extraIgnore = [],
    overrides = [],
    rules = {},
    typeAware = false,
  } = options;

  if (!tsconfigPath) {
    throw new Error('createNextConfig: tsconfigPath is required');
  }

  const projectDir = path.dirname(path.resolve(tsconfigPath));

  const baseExtends = typeAware
    ? ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended-type-checked']
    : ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended'];

  const defaultRules = {
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'react-hooks/exhaustive-deps': 'off',
    'react-hooks/rules-of-hooks': 'off',
  };

  return createConfig({
    tsconfigPath,
    env: { browser: true, node: true },
    extends: [...baseExtends, ...extraExtends],
    ignore: ['.next', 'out', 'coverage', ...extraIgnore],
    overrides,
    rules: typeAware
      ? {
          '@typescript-eslint/no-floating-promises': 'error',
          ...defaultRules,
          ...rules,
        }
      : { ...defaultRules, ...rules },
    settings: {
      next: {
        rootDir: [projectDir],
      },
    },
    typeAware,
  });
}

module.exports = createNextConfig;
