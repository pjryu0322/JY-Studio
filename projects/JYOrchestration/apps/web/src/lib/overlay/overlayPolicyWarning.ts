import {
  shouldAllowCursorCapability,
  shouldEnableContextAssembly,
  shouldEnableKnowledgeHints,
} from "@/lib/overlay/overlayPolicy";
import type { AiIdentityContract } from "@/lib/overlay/aiIdentityContract";
import {
  groupOverlayPolicyWarningsByCode,
  groupOverlayPolicyWarningsByRole,
  groupOverlayPolicyWarningsBySource,
} from "@/lib/overlay/overlayPolicyWarningSummary";
import { resolveAiIdentityContract } from "@/lib/overlay/overlayRuntimeResolver";

export type OverlayPolicyWarningSeverity = "info" | "warning" | "critical";

export type OverlayPolicyWarning = Readonly<{
  code: string;
  severity: OverlayPolicyWarningSeverity;
  message: string;
  roleKey?: string | null;
  source: "singlechat" | "review-harness" | "diagnostic" | "unknown";
  enforcement: "not_applied";
}>;

const WARNING_SOURCES = new Set<OverlayPolicyWarning["source"]>(["singlechat", "review-harness", "diagnostic", "unknown"]);
const WARNING_SEVERITIES = new Set<OverlayPolicyWarningSeverity>(["info", "warning", "critical"]);

/** 진단 API `overlayPolicyWarningSummary.warnings` 등에 넣을 샘플 상한 */
export const OVERLAY_POLICY_WARNINGS_MAX_API_SUMMARY = 50;

/** 타임라인·API 응답에 넣을 policy warning 최대 개수 */
export const OVERLAY_POLICY_WARNINGS_MAX_TIMELINE = 20;

/** `enforcement: "not_applied"` 고정 행(진단·SingleChat·Harness 공통). */
function overlayPolicyWarningRow(input: Readonly<{
  code: string;
  severity: OverlayPolicyWarningSeverity;
  message: string;
  source: OverlayPolicyWarning["source"];
  roleKey?: string | null;
}>): OverlayPolicyWarning {
  const rk = input.roleKey;
  const roleKey =
    rk === null || rk === undefined ? undefined : String(rk).trim().slice(0, 120) || undefined;
  return {
    code: input.code,
    severity: input.severity,
    message: input.message,
    source: input.source,
    enforcement: "not_applied",
    ...(roleKey ? { roleKey } : {}),
  };
}

export function buildOverlayPolicyWarnings(input: Readonly<{
  roleKey: string | null | undefined;
  source: OverlayPolicyWarning["source"];
  cursorRequested?: boolean;
  knowledgeHintsExpected?: boolean;
  contextAssemblyExpected?: boolean;
}>): readonly OverlayPolicyWarning[] {
  const rk = String(input.roleKey ?? "").trim() || null;
  const id = rk ? resolveAiIdentityContract(rk) : null;
  const out: OverlayPolicyWarning[] = [];

  if (rk && !id) {
    out.push(
      overlayPolicyWarningRow({
        code: "OVERLAY_ROLE_UNRESOLVED",
        severity: "warning",
        message: `Overlay contract identity could not be resolved for role key "${rk}".`,
        roleKey: rk,
        source: input.source,
      })
    );
  }

  if (input.cursorRequested && rk && id && !shouldAllowCursorCapability(rk)) {
    out.push(
      overlayPolicyWarningRow({
        code: "OVERLAY_CURSOR_CAPABILITY_NOT_ALLOWED",
        severity: "warning",
        message:
          "Cursor capability is not allowed for this overlay identity (recorded for diagnostics only; not enforced).",
        roleKey: rk,
        source: input.source,
      })
    );
  }

  const knExpected = Boolean(input.knowledgeHintsExpected);
  if (knExpected && rk && !shouldEnableKnowledgeHints(rk)) {
    out.push(
      overlayPolicyWarningRow({
        code: "OVERLAY_KNOWLEDGE_HINT_DISABLED",
        severity: "info",
        message: "Knowledge activation hints are disabled by overlay policy for this role.",
        roleKey: rk,
        source: input.source,
      })
    );
  }

  const ctxExpected = Boolean(input.contextAssemblyExpected);
  if (ctxExpected && rk && !shouldEnableContextAssembly(rk)) {
    out.push(
      overlayPolicyWarningRow({
        code: "OVERLAY_CONTEXT_ASSEMBLY_DISABLED",
        severity: "info",
        message: "Context assembly trace metadata is minimized by overlay policy for this role.",
        roleKey: rk,
        source: input.source,
      })
    );
  }

  return out;
}

export function buildWorkspaceCatalogUnmappedWarnings(
  unmappedCatalogKeys: readonly string[]
): readonly OverlayPolicyWarning[] {
  return unmappedCatalogKeys.map((key) =>
    overlayPolicyWarningRow({
      code: "OVERLAY_WORKSPACE_CATALOG_UNMAPPED",
      severity: "warning",
      message: `Workspace AI catalog key "${key}" has no overlay identity mapping.`,
      roleKey: key,
      source: "diagnostic",
    })
  );
}

export function buildProjectAgentUnresolvedDiagnosticWarnings(
  rows: ReadonlyArray<{
    readonly catalogKey: string | null;
    readonly aiOrchestrationRole: string | null;
    readonly displayName: string;
  }>
): readonly OverlayPolicyWarning[] {
  return rows.map((row) =>
    overlayPolicyWarningRow({
      code: "OVERLAY_PROJECT_AGENT_UNRESOLVED",
      severity: "warning",
      message: `Selected agent "${row.displayName}" could not be resolved to overlay identity (catalog=${row.catalogKey ?? "—"}, role=${row.aiOrchestrationRole ?? "—"}).`,
      roleKey: row.aiOrchestrationRole ?? row.catalogKey,
      source: "diagnostic",
    })
  );
}

/** 타임라인·외부 JSON에서 경고 배열 복원. 알 수 없는 severity는 replay 안정화를 위해 `warning`으로 본다. */
export function parseOverlayPolicyWarningsFromUnknown(raw: unknown): readonly OverlayPolicyWarning[] {
  if (!Array.isArray(raw)) return [];
  const out: OverlayPolicyWarning[] = [];
  for (const item of raw.slice(0, OVERLAY_POLICY_WARNINGS_MAX_TIMELINE)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const code = String(r.code ?? "").trim().slice(0, 80);
    const message = String(r.message ?? "").trim().slice(0, 500);
    const severityRaw = r.severity;
    const source = r.source;
    const enforcement = r.enforcement;
    if (!code || !message) continue;
    const severityResolved: OverlayPolicyWarningSeverity = WARNING_SEVERITIES.has(
      severityRaw as OverlayPolicyWarningSeverity
    )
      ? (severityRaw as OverlayPolicyWarningSeverity)
      : "warning";
    if (!WARNING_SOURCES.has(source as OverlayPolicyWarning["source"])) continue;
    if (enforcement !== "not_applied") continue;
    const roleKeyRaw = r.roleKey;
    const roleKey =
      roleKeyRaw === null || roleKeyRaw === undefined
        ? undefined
        : typeof roleKeyRaw === "string"
          ? roleKeyRaw.trim().slice(0, 120) || undefined
          : undefined;
    out.push(
      overlayPolicyWarningRow({
        code,
        severity: severityResolved,
        message,
        roleKey,
        source: source as OverlayPolicyWarning["source"],
      })
    );
  }
  return out;
}

export type OverlayPolicyWarningSummaryWire = Readonly<{
  warningCount: number;
  criticalCount: number;
  infoCount: number;
  warnings: readonly OverlayPolicyWarning[];
  /** 코드별 발생 횟수(진단·리포트용; 전체 입력 배열 기준). */
  byCode: Readonly<Record<string, number>>;
  /** roleKey별 발생 횟수(없으면 `unknown` 버킷). */
  byRole: Readonly<Record<string, number>>;
  /** source별 발생 횟수. */
  bySource: Readonly<Record<string, number>>;
}>;

export function summarizeOverlayPolicyWarnings(warnings: readonly OverlayPolicyWarning[]): OverlayPolicyWarningSummaryWire {
  let warningCount = 0;
  let criticalCount = 0;
  let infoCount = 0;
  for (const w of warnings) {
    if (w.severity === "critical") criticalCount++;
    else if (w.severity === "warning") warningCount++;
    else if (w.severity === "info") infoCount++;
  }
  return {
    warningCount,
    criticalCount,
    infoCount,
    warnings: warnings.slice(0, OVERLAY_POLICY_WARNINGS_MAX_API_SUMMARY),
    byCode: groupOverlayPolicyWarningsByCode(warnings),
    byRole: groupOverlayPolicyWarningsByRole(warnings),
    bySource: groupOverlayPolicyWarningsBySource(warnings),
  };
}

/** 계약 identity 기준으로 hint/context assembly 기대 여부(경고 생성용). */
export function overlayPolicyExpectationFlagsFromIdentity(
  identity: AiIdentityContract | null | undefined
): Readonly<{ knowledgeHintsExpected: boolean; contextAssemblyExpected: boolean }> {
  if (!identity) {
    return { knowledgeHintsExpected: false, contextAssemblyExpected: false };
  }
  return {
    knowledgeHintsExpected: identity.capabilities.includes("knowledge_retrieval"),
    contextAssemblyExpected: identity.capabilities.some(
      (c) => c === "llm_chat" || c === "llm_json_object" || c === "slot_orchestration"
    ),
  };
}

/** SingleChat·Review Harness 공통: policyRoleKey + identity로 경고 목록 생성 */
export function buildOverlayPolicyWarningsForResolvedRole(input: Readonly<{
  policyRoleKey: string | null | undefined;
  source: OverlayPolicyWarning["source"];
  identity: AiIdentityContract | null | undefined;
  cursorRequested?: boolean;
}>): readonly OverlayPolicyWarning[] {
  const { knowledgeHintsExpected, contextAssemblyExpected } = overlayPolicyExpectationFlagsFromIdentity(input.identity);
  return buildOverlayPolicyWarnings({
    roleKey: input.policyRoleKey,
    source: input.source,
    cursorRequested: input.cursorRequested ?? false,
    knowledgeHintsExpected,
    contextAssemblyExpected,
  });
}

/** `GET /api/diagnostics/overlay-runtime` 응답용 경고 합산(읽기 전용). */
export function collateOverlayRuntimeDiagnosticWarnings(input: Readonly<{
  workspaceUnmappedWarnings: readonly OverlayPolicyWarning[];
  unresolvedAgentRows?: ReadonlyArray<{
    readonly catalogKey: string | null;
    readonly aiOrchestrationRole: string | null;
    readonly displayName: string;
  }>;
  timelineWarnings?: readonly OverlayPolicyWarning[] | null | undefined;
}>): readonly OverlayPolicyWarning[] {
  const agents = input.unresolvedAgentRows ?? [];
  const tw = input.timelineWarnings ?? [];
  return [
    ...input.workspaceUnmappedWarnings,
    ...buildProjectAgentUnresolvedDiagnosticWarnings(agents),
    ...tw,
  ];
}
