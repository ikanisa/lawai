const path = require('node:path');

function unique(list) {
  return Array.from(new Set(list));
}

function createConfig(options = {}) {
  const {
    tsconfigPath,
    env = {},
    extends: extendList = [],
    ignore = [],
    parserOptions = {},
    plugins = ['@typescript-eslint'],
    settings = {},
    overrides = [],
    rules = {},
    globals = {},
    typeAware = false,
  } = options;

  if (typeAware && !tsconfigPath) {
    throw new Error('createConfig: tsconfigPath is required when typeAware is enabled');
  }

  if (tsconfigPath && typeof tsconfigPath !== 'string') {
    throw new Error('createConfig: tsconfigPath must be a string when provided');
  }

  const parserConfig = {
    ecmaVersion: 2022,
    sourceType: 'module',
    ...parserOptions,
  };

  if (typeAware && tsconfigPath) {
    const project = path.resolve(tsconfigPath);
    parserConfig.project = project;
    parserConfig.tsconfigRootDir = path.dirname(project);
  }

  const config = {
    root: true,
    env: { es2022: true, ...env },
    parser: '@typescript-eslint/parser',
    parserOptions: parserConfig,
    plugins,
    extends: extendList,
    ignorePatterns: unique(['dist', 'build', 'node_modules', ...ignore]),
    overrides,
    rules,
  };

  if (Object.keys(settings).length > 0) {
    config.settings = settings;
  }

  if (Object.keys(globals).length > 0) {
    config.globals = globals;
  }

  return config;
}

module.exports = { createConfig };
