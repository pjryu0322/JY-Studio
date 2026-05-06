# Service Design Harness Status

## Working

- `prototype-chat/turn`: `runHarness()` is executed and used to gate/route responses (confirmed in source).
- Advisory calls exist (`runOptionalAdvisoryCalls`), but they are **sequential** (not multicall).

## Partial

- SingleChat UI is partially integrated across requirements stages (ideation/service-flow/feature-planning) via a shared composer.
- Feature-planning message mirroring exists (SingleChat timeline mirrors user/AI turns into `requirementsConversation`).
- `serviceDesignHarness` metadata (`serviceDesignStage`, `mentionedAI`) is propagated through several request bodies, but **this does not guarantee `runHarness()` is executed** in those paths.

## Not Implemented

- `runHarness()` is **not confirmed** as a common runtime for `ideation`, `service-flow`, and `feature-planning` stage APIs.
- Member mapping UI is not connected to runtime `runHarness()` routing/authority decisions.
- True multicall advisory is not implemented.

## Do Not Claim as Done

- SingleChat UI is partially integrated.
- Feature-planning message mirroring exists.
- `runHarness` is confirmed in `prototype-chat/turn`.
- `runHarness` is not yet confirmed as common runtime for ideation/service-flow/feature-planning.
- Advisory call is sequential, not multicall.
- Member mapping UI is not connected to runtime harness.

