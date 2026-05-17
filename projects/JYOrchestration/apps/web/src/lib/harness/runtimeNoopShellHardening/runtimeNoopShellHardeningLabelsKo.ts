/**
 * H33 ? no-op shell hardening overlay·?? **??? ??**(read-only).
 */

import type {
  RuntimeNoopShellHardeningContractVerificationStatus,
  RuntimeNoopShellHardeningMode,
  RuntimeNoopShellHardeningPreflightReadiness,
  RuntimeNoopShellHardeningReadiness,
} from "./runtimeNoopShellHardeningTypes";

export const RUNTIME_NOOP_SHELL_HARDENING_SECTION_DISCLAIMER_KO =
  "? ??? ?? no-op shell execution? ???, no-op execution shell hardening? shell contract verification? ???? read-only metadata???.";

export const RUNTIME_NOOP_SHELL_HARDENING_OVERLAY_FOOTER_KO =
  "actual no-op shell execution·execution shell execution·runtime adapter invocation·execution·routing·queue control·rollback·prompt ??? ????.";

export const RUNTIME_NOOP_SHELL_HARDENING_READINESS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellHardeningReadiness, string>
> = {
  not_ready: "???",
  hardening_metadata_ready: "hardening ?? ??",
  watch: "??",
  blocked: "??",
};

export const RUNTIME_NOOP_SHELL_HARDENING_MODE_LABEL_KO: Readonly<Record<RuntimeNoopShellHardeningMode, string>> = {
  disabled: "???(??)",
  contract_verification_only: "?? ???",
  blocked: "??",
};

export const RUNTIME_NOOP_SHELL_HARDENING_PREFLIGHT_READINESS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellHardeningPreflightReadiness, string>
> = {
  not_ready: "???",
  ready_metadata: "?? ??",
  watch: "??",
  blocked: "??",
};

export const RUNTIME_NOOP_SHELL_HARDENING_CONTRACT_VERIFICATION_STATUS_LABEL_KO: Readonly<
  Record<RuntimeNoopShellHardeningContractVerificationStatus, string>
> = {
  verified_metadata: "???(??)",
  partial: "??",
  failed: "??",
};

export const RUNTIME_NOOP_SHELL_HARDENING_EMPTY_HINT_KO = {
  contract: "shell hardening contract ? ??",
  contractFinding: "contract verification finding ??",
  inputEnvelope: "input envelope ? ??",
  outputEnvelope: "output envelope ? ??",
  guard: "safety guard ? ??",
  boundaryViolation: "boundary violation ??",
  blocker: "hardening blocker ??",
  preflightChecklist: "preflight checklist ? ??",
  recommendation: "recommendation ??",
} as const;
