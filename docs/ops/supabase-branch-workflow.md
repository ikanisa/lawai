# Supabase Branch Workflow

Preview environments mirror the application code in Vercel and expect a dedicated Supabase branch. Production continues to use the canonical `main` branch.

## Branch naming

- Preview branches follow the convention `preview-<git-branch>`, where non-alphanumeric characters are replaced with `-` and the value is lowercased.
- The GitHub workflow [`vercel-preview-build.yml`](../../.github/workflows/vercel-preview-build.yml) exports `SUPABASE_BRANCH` and `NEXT_PUBLIC_SUPABASE_BRANCH` so Vercel preview builds target the matching Supabase branch automatically.
- Production builds must keep using the default branch (no `preview-` prefix) to avoid promoting experimental schemas.

## Creating a preview branch

```bash
supabase login
supabase link --project-ref <project-ref>
supabase branch create "preview-my-feature" --source main
```

- Use the `preview-*` name derived from your Git branch (`git rev-parse --abbrev-ref HEAD`).
- Run migrations against the new branch locally:
  ```bash
  SUPABASE_PROJECT_REF=<project-ref> SUPABASE_BRANCH=preview-my-feature pnpm db:migrate
  ```
- After validation, push changes to GitHub. The Vercel preview workflow will inject `SUPABASE_BRANCH` when running `vercel build` so the deployment points at the correct database branch.

## Promoting to production

1. Review the preview branch in Supabase (`supabase branch list`).
2. When the PR is approved, merge to `main`.
3. Run `supabase branch promote preview-my-feature` to push changes into the production branch.
4. Clean up obsolete preview branches with `supabase branch delete` once the deployment is healthy.

## Local hooks & CI guards

- `pnpm lint:sql` keeps all SQL migrations formatted and is executed in CI plus the optional [Lefthook](../../.lefthook.yml) pre-commit hook.
- `pnpm check:migrations` validates migration naming, ordering, and the generated [`db/migrations/manifest.json`](../../db/migrations/manifest.json).
- Always run both commands before promoting a branch to production to avoid manifest drift.
