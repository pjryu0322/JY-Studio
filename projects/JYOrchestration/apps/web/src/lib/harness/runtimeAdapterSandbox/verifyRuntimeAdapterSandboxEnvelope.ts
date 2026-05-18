/**
 * H26.5 — sandbox input/output envelope·policy·result **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type {
  RuntimeAdapterSandboxEnvelopeVerificationReport,
  RuntimeAdapterSandboxInputEnvelope,
  RuntimeAdapterSandboxOutputEnvelope,
  RuntimeAdapterSandboxPolicy,
  RuntimeAdapterSandboxResultMetadata,
} from "./runtimeAdapterSandboxTypes";

const REQUIRED_INPUT_REFS: readonly { readonly key: string; readonly token: string }[] = [
  { key: "preflightReadiness", token: "preflightreadiness:" },
  { key: "contractReadiness", token: "contractreadiness:" },
  { key: "contractVerification", token: "contractverification:" },
  { key: "invocationGuard", token: "invocationguard:" },
  { key: "controlledPilotReadiness", token: "controlledpilotreadiness:" },
  { key: "approvalReadiness", token: "approvalreadiness:" },
  { key: "rollbackReadiness", token: "rollbackreadiness:" },
  { key: "auditReadiness", token: "auditreadiness:" },
];

const FORBIDDEN_RESULT_TOKENS = [
  "actual adapter invocation",
  "actual execution",
  "provider routing",
  "queue control",
  "rollback execution",
] as const;

function normalizeBlob(parts: readonly string[]): string {
  return parts.join(" ").toLowerCase().replace(/\s+/g, "");
}

export function verifyRuntimeAdapterSandboxEnvelope(input: {
  readonly inputEnvelope: RuntimeAdapterSandboxInputEnvelope;
  readonly outputEnvelope: RuntimeAdapterSandboxOutputEnvelope;
  readonly policy: RuntimeAdapterSandboxPolicy;
  readonly result: RuntimeAdapterSandboxResultMetadata;
}): RuntimeAdapterSandboxEnvelopeVerificationReport {
  const { inputEnvelope, outputEnvelope, policy, result } = input;
  const inputBlob = normalizeBlob(inputEnvelope.envelopeRows);
  const outputBlob = normalizeBlob([
    ...outputEnvelope.acceptedMetadataRows,
    ...outputEnvelope.rejectedMetadataRows,
    ...outputEnvelope.safetyEnvelopeRows,
  ]);
  const resultBlob = normalizeBlob(result.resultRows);
  const policyBlob = normalizeBlob([
    ...policy.forbiddenSandboxOperations,
    ...policy.allowedSandboxMetadataScopes,
  ]);

  const missingInputEnvelopeRefs: string[] = [];
  for (const { key, token } of REQUIRED_INPUT_REFS) {
    if (!inputBlob.includes(token.replace(/:/g, ""))) {
      missingInputEnvelopeRefs.push(`input envelope missing ref: ${key}`);
    }
  }

  const outputEnvelopeAligned =
    outputEnvelope.acceptedMetadataRows.length > 0 &&
    outputEnvelope.safetyEnvelopeRows.some((r) => r.toLowerCase().includes("sandboxinvoked:false")) &&
    outputEnvelope.safetyEnvelopeRows.some((r) => r.toLowerCase().includes("diagnosticonly:true"));

  const policyAligned =
    policy.forbiddenSandboxOperations.length > 0 && policy.allowedSandboxMetadataScopes.length > 0;

  let resultMetadataAligned = result.diagnosticOnly === true;
  for (const forbidden of FORBIDDEN_RESULT_TOKENS) {
    const token = forbidden.replace(/\s+/g, "");
    if (resultBlob.includes(token.replace(/\s+/g, ""))) {
      resultMetadataAligned = false;
    }
  }
  for (const forbidden of policy.forbiddenSandboxOperations) {
    const token = forbidden.toLowerCase().replace(/\s+/g, "");
    if (resultBlob.includes(token) && !policyBlob.includes("forbidden")) {
      resultMetadataAligned = false;
    }
  }

  const findings = mergeSortedUniqueKo([
    ...missingInputEnvelopeRefs.map((m) => `envelope: ${m}`),
    ...(!outputEnvelopeAligned ? ["output envelope not aligned with sandbox safety metadata"] : []),
    ...(!policyAligned ? ["sandbox policy missing forbidden/allowed scopes"] : []),
    ...(!resultMetadataAligned ? ["sandbox result metadata not aligned with policy"] : []),
  ]);

  let verificationStatus: RuntimeAdapterSandboxEnvelopeVerificationReport["verificationStatus"];
  if (missingInputEnvelopeRefs.length > 0 || !outputEnvelopeAligned || !policyAligned || !resultMetadataAligned) {
    verificationStatus =
      missingInputEnvelopeRefs.length >= 3 || !outputEnvelopeAligned || !resultMetadataAligned
        ? "failed"
        : "partial";
  } else {
    verificationStatus = "verified_metadata";
  }

  const recommendations = mergeSortedUniqueKo([
    ...(verificationStatus === "verified_metadata"
      ? ["H26.5: sandbox envelope verified_metadata — H27 전 gate(호출 없음)"]
      : []),
    ...(verificationStatus === "partial"
      ? ["H26.5: sandbox envelope partial — input/output/policy 정합 재검토"]
      : []),
    ...(verificationStatus === "failed" ? ["H26.5: sandbox envelope failed — envelope 정렬 후 재평가"] : []),
  ]);

  return {
    mode: "runtime_adapter_sandbox_envelope_verification_report",
    actualRuntimeOrchestrationEnabled: false,
    actualRuntimeAdapterInvocationEnabled: false,
    actualSandboxInvocationEnabled: false,
    verificationStatus,
    missingInputEnvelopeRefs: mergeSortedUniqueKo(missingInputEnvelopeRefs),
    outputEnvelopeAligned,
    policyAligned,
    resultMetadataAligned,
    findings,
    recommendations,
  };
}
