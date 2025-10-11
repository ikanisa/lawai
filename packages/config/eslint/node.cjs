const path = require('node:path');

function createNodeConfig(options = {}) {
  const {
    tsconfigPath,
    extraExtends = [],
    extraIgnore = [],
    overrides = {},
  } = options;

  if (!tsconfigPath) {
    throw new Error('createNodeConfig: tsconfigPath is required');
  }

  return {
    root: true,
    env: {
      es2022: true,
      node: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: path.resolve(tsconfigPath),
    },
    plugins: ['@typescript-eslint'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', ...extraExtends],
    ignorePatterns: ['dist', 'build', ...extraIgnore],
    ...overrides,
  };
}

module.exports = createNodeConfig;
