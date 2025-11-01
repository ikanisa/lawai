# Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) to automate versioning, changelog generation, and publishing of public packages.

- Run `pnpm changeset` to create a new changeset describing the changes in your PR.
- Run `pnpm version-packages` locally if you need to preview version bumps.
- Publishing is handled automatically from the `main` branch via GitHub Actions.
