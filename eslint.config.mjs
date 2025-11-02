import tseslint from 'typescript-eslint';

const ignores = [
  '**/dist/**',
  '**/.next/**',
  '**/node_modules/**',
  '**/out/**',
  '**/.turbo/**',
  '**/coverage/**',
];

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
