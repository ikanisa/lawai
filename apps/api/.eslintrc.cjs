module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: __dirname + '/tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: false, allowTernary: false, allowTaggedTemplates: false }],
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off',
        'no-unused-expressions': ['error', { allowShortCircuit: false, allowTernary: false, allowTaggedTemplates: false }],
      },
    },
  ],
  ignorePatterns: ['dist'],
};
