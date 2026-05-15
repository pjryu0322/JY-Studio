import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { executionRoutingSafetyStatusRank } from "@/lib/harness/executionRouting/executionRoutingSafetyTypes";
import {
  MESSAGE_EXPLAINABILITY_DISCLAIMER,
  messageExplainabilitySectionTitle,
} from "@/lib/overlay-ui/messageExplainabilityUiAdapter";
import type {
  MessageExplainabilityRiskLevel,
  MessageExplainabilitySection,
  MessageExplainabilityViewModel,
} from "@/lib/harness/explainability/messageExplainabilityTypes";

const MODE = "read_only_explainability" as const;

const RISK_RANK: Readonly<Record<MessageExplainabilityRiskLevel, number>> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function maxRisk(a: MessageExplainabilityRiskLevel, b: MessageExplainabilityRiskLevel): MessageExplainabilityRiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function rolePerspectiveLabel(perspective: string): string {
  const p = perspective.trim().toLowerCase();
  if (p.includes("architect") || p.includes("설계")) return "설계 관점";
  if (p.includes("designer") || p.includes("ux")) return "UX·화면 관점";
  if (p.includes("analyst") || p.includes("분석")) return "분석·흐름 관점";
  if (p.includes("security") || p.includes("보안")) return "보안·검토 관점";
  if (p.includes("planner") || p.includes("기획")) return "기획 관점";
  return "AI 역할 관점";
}

function extractHasRenderableFields(x: ExtractedOverlayPromptTraceMetadata | null | undefined): boolean {
  if (!x || typeof x !== "object") return false;
  for (const v of Object.values(x)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length > 0) return true;
    if (typeof v === "object" && Object.keys(v as object).length > 0) return true;
  }
  return false;
}

export function buildMessageExplainabilityViewModel(input: {
  readonly overlayExtract?: ExtractedOverlayPromptTraceMetadata | null;
}): MessageExplainabilityViewModel {
  const ex = input.overlayExtract ?? null;
  const disclaimer = MESSAGE_EXPLAINABILITY_DISCLAIMER;

  if (!ex || !extractHasRenderableFields(ex)) {
    return {
      mode: MODE,
      hasData: false,
      headline: "",
      summaryLines: [],
      sections: [],
      warningCount: 0,
      riskLevel: "none",
      disclaimer,
    };
  }

  const sections: MessageExplainabilitySection[] = [];
  let overall: MessageExplainabilityRiskLevel = "none";
  let warningCount = 0;

  const pushSection = (s: MessageExplainabilitySection) => {
    if (!String(s.summary).trim()) return;
    sections.push(s);
    overall = maxRisk(overall, s.riskLevel);
  };

  // ── role ─────────────────────────────────────────────────────────────
  const oi = ex.overlayIdentity;
  const odt = ex.overlayOrchestrationDecisionTrace;
  if (oi || odt) {
    const parts: string[] = [];
    if (oi?.perspective) {
      parts.push(`${rolePerspectiveLabel(String(oi.perspective))}에서 응답을 정리했습니다.`);
    } else if (oi?.roleKey) {
      parts.push("역할 기준으로 응답을 정리했습니다.");
    }
    if (odt?.selectedRoleKey) {
      parts.push("오케스트레이션에서 역할 선택 근거가 함께 기록되었습니다.");
    }
    if (!parts.length && odt) {
      parts.push("역할 선택 정보가 기록되었습니다.");
    }
    pushSection({
      type: "role",
      title: messageExplainabilitySectionTitle("role"),
      summary: parts.join(" "),
      riskLevel: "none",
    });
  }

  // ── context ──────────────────────────────────────────────────────────
  const sel = ex.overlaySelectedContextRefs?.length ?? 0;
  const pri = ex.overlayPrioritizedContextRefs?.length ?? 0;
  const planN = ex.overlayContextAssemblyPlan?.length ?? 0;
  if (sel || pri || planN) {
    const bits: string[] = [];
    if (sel) bits.push(`참조 맥락 후보 ${sel}건`);
    if (pri) bits.push(`우선순위 정리 ${pri}건`);
    if (planN) bits.push(`조립 계획 단계 ${planN}건`);
    pushSection({
      type: "context",
      title: messageExplainabilitySectionTitle("context"),
      summary: `${bits.join(", ")}이 반영되었습니다.`,
      riskLevel: "none",
    });
  }

  // ── knowledge ────────────────────────────────────────────────────────
  const kap = ex.knowledgeActivationPlan;
  const hints = ex.overlayKnowledgeActivationHints?.length ?? 0;
  const kapN = kap?.items?.length ?? 0;
  if (kapN || hints) {
    let kr: MessageExplainabilityRiskLevel = "none";
    const wf = kap?.findings?.filter((f) => f.severity === "warning").length ?? 0;
    if (wf) kr = maxRisk(kr, "low");
    const line =
      kapN > 0
        ? `역할·단계 정책에 따라 지식팩 후보 ${kapN}개가 정리되었습니다.`
        : hints > 0
          ? `지식팩 활성화 힌트 ${hints}건이 함께 기록되었습니다.`
          : "";
    pushSection({
      type: "knowledge",
      title: messageExplainabilitySectionTitle("knowledge"),
      summary: line,
      riskLevel: kr,
    });
    overall = maxRisk(overall, kr);
  }

  // ── memory ─────────────────────────────────────────────────────────────
  const mem = ex.memoryRuntimePlan;
  if (mem && (mem.references?.length || mem.findings?.length)) {
    const stale = mem.references?.filter((r) => r.freshness === "stale").length ?? 0;
    const warnFind = mem.findings?.filter((f) => f.severity === "warning").length ?? 0;
    const mr: MessageExplainabilityRiskLevel = stale > 0 || warnFind > 0 ? "medium" : "low";
    const n = mem.references?.length ?? 0;
    const line =
      stale > 0
        ? `기억 후보 ${n}건 중 오래된 후보가 있어 주의가 필요합니다.`
        : n > 0
          ? `기억 후보 ${n}건이 평가·정리되었습니다.`
          : "기억 런타임 진단이 함께 기록되었습니다.";
    pushSection({
      type: "memory",
      title: messageExplainabilitySectionTitle("memory"),
      summary: line,
      riskLevel: mr,
    });
    overall = maxRisk(overall, mr);
  }

  // ── execution ─────────────────────────────────────────────────────────
  const erp = ex.executionRoutingPlan;
  const ers = ex.executionRoutingSafetyReport;
  if (erp || ers) {
    let xr: MessageExplainabilityRiskLevel = "low";
    if (ers) {
      const rank = executionRoutingSafetyStatusRank(ers.status);
      if (rank >= 2) xr = "high";
      else if (rank >= 1) xr = "medium";
      else xr = ers.warningItemCount > 0 ? "low" : "none";
    }
    const items = erp?.items?.length ?? ers?.totalItems ?? 0;
    const line =
      ers && ers.status !== "safe_dry_run"
        ? "실행 capability 안전 점검에서 주의·위험 신호가 일부 보고되었습니다."
        : items > 0
          ? `실행 capability 후보 ${items}건이 dry-run으로 정리되었습니다.`
          : "실행 routing 관련 계획 정보가 기록되었습니다.";
    pushSection({
      type: "execution",
      title: messageExplainabilitySectionTitle("execution"),
      summary: line,
      riskLevel: xr,
    });
    overall = maxRisk(overall, xr);
  }

  // ── review / security harness ─────────────────────────────────────────
  const rsh = ex.reviewSecurityHarnessPlan;
  if (rsh && (rsh.checklist?.length || rsh.findings?.length)) {
    const chk = rsh.checklist?.length ?? 0;
    const crit = rsh.checklist?.filter((c) => c.severity === "critical_candidate").length ?? 0;
    const rr: MessageExplainabilityRiskLevel = crit > 0 ? "high" : "low";
    pushSection({
      type: "review_security",
      title: messageExplainabilitySectionTitle("review_security"),
      summary:
        chk > 0
          ? `검토·보안 기준 후보 ${chk}건이 계획에 포함되었습니다.`
          : "검토·보안 harness 진단이 기록되었습니다.",
      riskLevel: rr,
    });
    overall = maxRisk(overall, rr);
  }

  // ── issue planning + remediation ───────────────────────────────────────
  const rip = ex.reviewSecurityIssuePlanningReport;
  const rlp = ex.remediationLoopPlan;
  if (
    (rip && rip.mode === "dry_run_issue_planning" && (rip.issues?.length || rip.findings?.length)) ||
    (rlp && rlp.mode === "dry_run_remediation_loop" && (rlp.steps?.length || rlp.findings?.length))
  ) {
    const critIssues = rip?.issues?.filter((i) => i.severity === "critical_candidate").length ?? 0;
    const issueN = rip?.issues?.length ?? 0;
    const stepN = rlp?.steps?.length ?? 0;
    const ir: MessageExplainabilityRiskLevel = critIssues > 0 ? "high" : issueN > 0 || stepN > 0 ? "medium" : "low";
    const bits: string[] = [];
    if (issueN) bits.push(`이슈 후보 ${issueN}건`);
    if (stepN) bits.push(`조치 루프 단계 ${stepN}건`);
    pushSection({
      type: "issue_planning",
      title: messageExplainabilitySectionTitle("issue_planning"),
      summary: bits.length ? `${bits.join(", ")}의 계획 정보가 생성되었습니다.` : "이슈·조치 루프 계획 정보가 기록되었습니다.",
      riskLevel: ir,
    });
    overall = maxRisk(overall, ir);
  }

  // ── budget ─────────────────────────────────────────────────────────────
  const bud = ex.overlayContextBudget;
  if (bud && typeof bud === "object" && Object.keys(bud).length > 0) {
    const ov = bud.overflowRisk === "high" ? "medium" : "low";
    pushSection({
      type: "budget",
      title: messageExplainabilitySectionTitle("budget"),
      summary: "맥락 예산·압축 정책 힌트가 함께 기록되었습니다.",
      riskLevel: ov,
    });
    overall = maxRisk(overall, ov);
  }

  // ── warnings (aggregate) ───────────────────────────────────────────────
  const polW = ex.overlayPolicyWarnings?.length ?? 0;
  const confW = ex.overlayConflictWarnings?.length ?? 0;
  const driftW = ex.overlayPolicyDriftWarnings?.length ?? 0;
  const warnTotal = polW + confW + driftW;
  warningCount = warnTotal;
  if (warnTotal > 0) {
    const wr: MessageExplainabilityRiskLevel = confW > 0 || driftW > 0 ? "medium" : "low";
    pushSection({
      type: "warnings",
      title: messageExplainabilitySectionTitle("warnings"),
      summary: `정책·충돌·드리프트 관련 경고 ${warnTotal}건이 태깅되었습니다.`,
      riskLevel: wr,
    });
    overall = maxRisk(overall, wr);
  }

  if (!sections.length) {
    return {
      mode: MODE,
      hasData: false,
      headline: "",
      summaryLines: [],
      sections: [],
      warningCount,
      riskLevel: overall,
      disclaimer,
    };
  }

  const headline = "AI 판단 요약";

  const summaryLinesRaw: string[] = [];
  for (const s of sections) {
    summaryLinesRaw.push(`${s.title}: ${s.summary}`);
  }
  if (warningCount > 0 && !summaryLinesRaw.some((l) => l.startsWith("경고:"))) {
    summaryLinesRaw.push(`경고 태그 ${warningCount}건이 함께 기록되었습니다.`);
  }
  const summaryLines = summaryLinesRaw.slice(0, 5);

  return {
    mode: MODE,
    hasData: true,
    headline,
    summaryLines,
    sections,
    warningCount,
    riskLevel: overall,
    disclaimer,
  };
}
