# Shared configuration (`packages/config`)

Centralised tooling configuration consumed across the monorepo. Currently houses the ESLint preset.

## Structure

```
packages/config/
  eslint/
    node.cjs        # ESLint config extending TypeScript + Next.js rules
```

## Usage

Each workspace extends the preset via its local `.eslintrc.cjs`:

```js
module.exports = {
  root: true,
  extends: ['../../packages/config/eslint/node.cjs'],
};
```

Update this folder whenever adding shared tooling (Prettier, Stylelint, etc.). Document new presets in the relevant app/package README so contributors know how to enable them.
