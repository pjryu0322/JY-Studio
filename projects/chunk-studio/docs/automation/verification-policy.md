# Verification Policy (Chunk Studio)

## Scope

This policy applies to `projects/chunk-studio`.

## Canonical Rule

- Current working commit is `HEAD`.
- `docs/automation/remote-verification.json` stores `HEAD~1`.
- Verification match is `true` when:
  - `remote-verification.json` (`verificationMeta.commit`) == `git rev-parse HEAD~1`

## Why `HEAD` Cannot Be Used

`remote-verification.json` is committed as part of the repository state.  
If the file tries to self-reference the same commit that contains it (`HEAD`), the value is inherently unstable during commit creation and causes self-referential mismatch.

## Why `HEAD~1` Is Used

`HEAD~1` points to the immediately previous fixed commit and avoids self-reference during verification generation.  
This provides a deterministic and repeatable baseline for automation checks.

## Source of Truth

`docs/automation/remote-verification.json` is the single source of truth for verification metadata used by automation.

## Required Phase Gate (Every Major Phase)

Run all of the following:

1. `npm run lint`
2. `npm run build`
3. `scripts/verify-source` (`verify-source.sh` delegates to `verify-source.mjs`)

