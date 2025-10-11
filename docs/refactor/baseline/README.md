# Baseline Snapshot – 2025-02-07

This directory records the “known good” state of the system before the repo-wide refactor.
Populate the sections below once the baseline measurements are taken.

## Build & Bundle

- `pnpm build` output: _pending_
- Bundle analysis (`nextjs-bundle-analyzer` / `next build --analyze`): _pending_

## Frontend Vitals

- Lighthouse HTML/JSON report: _pending_ (`docs/refactor/baseline/lighthouse.html`)
- Web Vitals dashboard link: _pending_

## Backend / Edge Latency

- API ping (curl `-w` template): _pending_ (`docs/refactor/baseline/api-latency.txt`)
- Edge worker deploy latency: _pending_

## Dependency Snapshot

- `pnpm list --depth 0` saved to `dependency-tree.txt`
- `depcheck` JSON saved to `depcheck.json`
- `ts-prune` output saved to `ts-prune.txt`

## Feature Flags & Env Vars

| Flag / Env Var | Location | Notes | Action |
| -------------- | -------- | ----- | ------ |
| _example_      | _path_   | _context_ | _remove / keep_ |

## Notes

- Record any anomalies or TODOs for Stage 1 here.

