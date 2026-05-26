import { codeAgentProviderLabel } from "@/lib/prototype/codeAgentProvider";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildDataModelDraftMarkdown,
  buildDbIntegrationDecisionMarkdown,
  buildStorageStrategyMarkdown,
  shouldIncludeDataModelDraftArtifact,
  shouldIncludeDbIntegrationDecisionArtifact,
  shouldIncludeStorageStrategyArtifact,
  type ImplementationDbStrategyV1,
} from "@/lib/prototype/implementationDbStrategy";
import { formatImplementationSlotsReadinessSummary } from "@/lib/prototype/implementationSlots";
import type { ImplementationSlotsV1 } from "@/lib/prototype/implementationSlots";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import {
  formatWorkPlanDraftMarkdown,
  type ImplementationWorkPlanDraftV1,
} from "@/lib/prototype/implementationWorkPlanDraft";
import {
  IMPLEMENTATION_SEED_GAP_LABELS,
  type ImplementationSeedV1,
} from "@/lib/requirements/implementationSeed";
import type { ArtifactStage } from "@/lib/prototype/artifactHubStage";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ImplementationArtifactType =
  | "implementation-readiness-report"
  | "implementation-seed"
  | "implementation-work-plan-draft"
  | "implementation-task-plan"
  | "code-agent-work-instruction"
  | "wip-result-report"
  | "developer-review-result"
  | "refactor-request-report"
  | "scm-official-commit-ready"
  | "review-criteria-summary"
  | "security-criteria-summary"
  | "db-integration-decision"
  | "data-model-draft"
  | "storage-strategy"
  | "api-db-mapping"
  | "migration-plan"
  | "data-security-policy"
  | "backup-retention-policy";

export type DerivedImplementationArtifactStatus = "draft" | "ready" | "blocked" | "completed";

export type DerivedImplementationArtifact = Readonly<{
  id: string;
  type: ImplementationArtifactType;
  stage: ArtifactStage;
  title: string;
  body: string;
  source: readonly string[];
  status: DerivedImplementationArtifactStatus;
  createdAt: string;
  updatedAt: string;
}>;

const TYPE_LABELS: Record<ImplementationArtifactType, string> = {
  "implementation-readiness-report": "구현 준비도 점검서",
  "implementation-seed": "Implementation Seed",
  "implementation-work-plan-draft": "구현 작업안 초안",
  "implementation-task-plan": "구현 작업안",
  "code-agent-work-instruction": "Code Agent 작업 지시서",
  "wip-result-report": "WIP 작업 결과 보고서",
  "developer-review-result": "AI개발자 검토 결과",
  "refactor-request-report": "리팩토링 요청서",
  "scm-official-commit-ready": "SCM 공식 반영 준비서",
  "review-criteria-summary": "검수 기준서",
  "security-criteria-summary": "보안 점검 기준서",
  "db-integration-decision": "DB 연동 판단서",
  "data-model-draft": "데이터 모델 초안",
  "storage-strategy": "저장 전략서",
  "api-db-mapping": "API-DB 매핑표",
  "migration-plan": "Migration 계획서",
  "data-security-policy": "데이터 보안 기준서",
  "backup-retention-policy": "백업·복구 기준서",
};

export function implementationArtifactTypeLabel(type: ImplementationArtifactType): string {
  return TYPE_LABELS[type] ?? type;
}

function mdSection(title: string, lines: readonly string[]): string {
  const body = lines.filter(Boolean).join("\n");
  return body ? `## ${title}\n\n${body}\n` : "";
}

export function formatImplementationSeedMarkdown(seed: ImplementationSeedV1): string {
  const gapLines = seed.gaps.map((g) => `- [${g.severity}] ${g.label}: ${g.reason}`);
  return [
    "# Implementation Seed",
    "",
    `준비도: ${Math.round(seed.readiness.score * 100)}% (${seed.readiness.ready ? "ready" : "not ready"})`,
    `상태: ${seed.lifecycleStatus}`,
    "",
    mdSection("프로세스별 구현 항목", seed.processImplementationItems.map((p, i) => `${i + 1}. ${p.processName}`)),
    mdSection(
      "화면별 구현 항목",
      seed.screenImplementationItems.map((s, i) => `${i + 1}. ${s.screenName}`),
    ),
    mdSection(
      "액터별 기능/권한",
      seed.actorCapabilityMatrix.map((a, i) => `${i + 1}. ${a.actor}`),
    ),
    mdSection("공통 상세기능", seed.commonDetailFeatures.map((c) => `- ${c.name}`)),
    mdSection("데이터 엔티티", seed.dataModelSeed.entities.map((e) => `- ${e}`)),
    mdSection(
      "부족 항목",
      gapLines.length
        ? gapLines
        : seed.readiness.missing.map((k) => `- ${IMPLEMENTATION_SEED_GAP_LABELS[k]}`),
    ),
  ].join("\n");
}

export function buildDerivedImplementationArtifacts(input: {
  readonly projectId: string;
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
  readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  readonly implementationSlotsV1?: ImplementationSlotsV1 | null;
  readonly implementationDbStrategyV1?: ImplementationDbStrategyV1 | null;
  readonly projectArtifacts?: readonly import("@/lib/requirements/projectArtifactTypes").ProjectArtifact[];
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly nowIso?: string;
}): readonly DerivedImplementationArtifact[] {
  const now = input.nowIso ?? new Date().toISOString();
  const out: DerivedImplementationArtifact[] = [];
  const plan = input.implementationTaskPlanV1;
  const seed = input.implementationSeedV1;
  const draft = input.implementationWorkPlanDraftV1;
  const slots = input.implementationSlotsV1;
  const workItems = input.cursorWorkItemsV1 ?? [];
  const wip = input.codeAgentWipExecutionV1;

  if (seed) {
    out.push({
      id: `impl-artifact-readiness-${seed.createdAt}`,
      type: "implementation-readiness-report",
      stage: "implementation",
      title: TYPE_LABELS["implementation-readiness-report"],
      body: [
        "# 구현 준비도 점검서",
        "",
        `- 준비도: ${Math.round(seed.readiness.score * 100)}%`,
        `- ready: ${seed.readiness.ready}`,
        `- lifecycle: ${seed.lifecycleStatus}`,
        "",
        ...(seed.readiness.missing.length
          ? ["## 부족 항목", ...seed.readiness.missing.map((k) => `- ${IMPLEMENTATION_SEED_GAP_LABELS[k]}`)]
          : ["## 상태", "- Implementation Seed Gate 충족"]),
      ].join("\n"),
      source: ["implementationSeedV1"],
      status: seed.readiness.ready ? "ready" : "blocked",
      createdAt: seed.createdAt,
      updatedAt: seed.updatedAt,
    });
    out.push({
      id: `impl-artifact-seed-${seed.createdAt}`,
      type: "implementation-seed",
      stage: "implementation",
      title: TYPE_LABELS["implementation-seed"],
      body: formatImplementationSeedMarkdown(seed),
      source: ["implementationSeedV1"],
      status: seed.lifecycleStatus === "confirmed" ? "ready" : "draft",
      createdAt: seed.createdAt,
      updatedAt: seed.updatedAt,
    });
  }

  if (draft?.implementationScope.length && !plan?.items.length) {
    out.push({
      id: `impl-artifact-work-plan-draft-${draft.createdAt}`,
      type: "implementation-work-plan-draft",
      stage: "implementation",
      title: TYPE_LABELS["implementation-work-plan-draft"],
      body: formatWorkPlanDraftMarkdown(draft),
      source: ["implementationWorkPlanDraftV1"],
      status: draft.status === "confirmed" ? "ready" : "draft",
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    });
  }

  if (plan?.items.length) {
    const taskLines = plan.items.map(
      (it, i) =>
        `${i + 1}. **${it.title}** (${it.priority}) — ${it.status}${it.blockers.length ? ` · 차단: ${it.blockers.join(", ")}` : ""}`,
    );
    const criteria = plan.items.flatMap((it) => it.acceptanceCriteria).slice(0, 12);
    const security = plan.items.flatMap((it) => it.securityChecks).slice(0, 12);
    out.push({
      id: `impl-artifact-task-plan-${plan.createdAt}`,
      type: "implementation-task-plan",
      stage: "implementation",
      title: TYPE_LABELS["implementation-task-plan"],
      body: [
        "# 구현 작업안",
        "",
        mdSection("구현 task", taskLines),
        mdSection("검수 기준 요약", criteria.map((c) => `- ${c}`)),
        mdSection("보안 기준 요약", security.map((c) => `- ${c}`)),
        slots ? formatImplementationSlotsReadinessSummary(slots) : "",
        "",
        `준비 상태: ${plan.readiness.ready ? "ready" : "미완료"} (${plan.readiness.missing.join(", ") || "없음"})`,
      ].join("\n"),
      source: ["implementationTaskPlanV1", "implementationSlotsV1"],
      status: plan.readiness.ready ? "ready" : "draft",
      createdAt: plan.createdAt,
      updatedAt: slots?.updatedAt ?? plan.createdAt,
    });

    const acceptanceAll = plan.items.every((i) => i.acceptanceCriteria.length > 0);
    if (acceptanceAll) {
      out.push({
        id: `impl-artifact-review-criteria-${plan.createdAt}`,
        type: "review-criteria-summary",
        stage: "review",
        title: TYPE_LABELS["review-criteria-summary"],
        body: [
          "# 검수 기준서",
          "",
          ...plan.items.flatMap((it) =>
            it.acceptanceCriteria.map((c) => `- **${it.title}**: ${c}`),
          ),
        ].join("\n"),
        source: ["implementationTaskPlanV1"],
        status: "ready",
        createdAt: plan.createdAt,
        updatedAt: plan.createdAt,
      });
    }

    const securityAll = plan.items.every((i) => i.securityChecks.length > 0);
    if (securityAll) {
      out.push({
        id: `impl-artifact-security-criteria-${plan.createdAt}`,
        type: "security-criteria-summary",
        stage: "review",
        title: TYPE_LABELS["security-criteria-summary"],
        body: [
          "# 보안 점검 기준서",
          "",
          ...plan.items.flatMap((it) =>
            it.securityChecks.map((c) => `- **${it.title}**: ${c}`),
          ),
        ].join("\n"),
        source: ["implementationTaskPlanV1"],
        status: "ready",
        createdAt: plan.createdAt,
        updatedAt: plan.createdAt,
      });
    }
  }

  if (workItems.length) {
    const blocks = workItems.map((w, i) => {
      const prompt = w.prompt?.trim() || "(prompt 없음)";
      return [
        `### ${i + 1}. ${w.title}`,
        `- workItemId: ${w.id}`,
        `- taskId: ${w.taskId}`,
        `- 상태: ${w.blocked ? "차단" : "실행 가능"}`,
        `- 테스트: ${w.testCommands.join(" · ") || "—"}`,
        "",
        prompt.slice(0, 6000),
        w.prompt && w.prompt.length > 6000 ? "\n\n…(이하 생략)" : "",
      ].join("\n");
    });
    out.push({
      id: `impl-artifact-work-instruction-${workItems[0]?.id ?? now}`,
      type: "code-agent-work-instruction",
      stage: "implementation",
      title: TYPE_LABELS["code-agent-work-instruction"],
      body: ["# Code Agent 작업 지시서", "", ...blocks].join("\n\n"),
      source: ["cursorWorkItemsV1"],
      status: workItems.some((w) => w.blocked) ? "blocked" : "ready",
      createdAt: plan?.createdAt ?? now,
      updatedAt: now,
    });
  }

  if (wip?.commits.length) {
    const commitBlocks = wip.commits.map((c, i) =>
      [
        `### WIP commit ${i + 1}`,
        `- provider: ${codeAgentProviderLabel(c.provider)}`,
        `- branch: ${c.branchName}`,
        `- message: ${c.commitMessage}`,
        `- 변경 파일: ${c.changedFiles.join(", ") || "—"}`,
        `- diff 요약: ${c.diffSummary.join(" / ") || "—"}`,
        `- 테스트: ${c.testResults.join(" / ") || "—"}`,
        `- 미해결: ${c.unresolvedIssues.join(" / ") || "없음"}`,
      ].join("\n"),
    );
    out.push({
      id: `impl-artifact-wip-report-${wip.requestedAt}`,
      type: "wip-result-report",
      stage: "implementation",
      title: TYPE_LABELS["wip-result-report"],
      body: ["# WIP 작업 결과 보고서", "", ...commitBlocks].join("\n\n"),
      source: ["codeAgentWipExecutionV1.commits"],
      status: "completed",
      createdAt: wip.commits[0]?.createdAt ?? wip.requestedAt,
      updatedAt: wip.commits[wip.commits.length - 1]?.createdAt ?? wip.requestedAt,
    });
  }

  if (wip?.developerReview) {
    const dr = wip.developerReview;
    out.push({
      id: `impl-artifact-dev-review-${dr.reviewedAt}`,
      type: "developer-review-result",
      stage: "implementation",
      title: TYPE_LABELS["developer-review-result"],
      body: [
        "# AI개발자 검토 결과",
        "",
        `- 상태: ${dr.status}`,
        `- 요약: ${dr.summary}`,
        "",
        mdSection("발견 사항", dr.findings.map((f) => `- ${f}`)),
        mdSection("요청 조치", dr.requestedActions.map((a) => `- ${a}`)),
      ].join("\n"),
      source: ["codeAgentWipExecutionV1.developerReview"],
      status: dr.status === "approved" ? "completed" : dr.status === "rejected" ? "blocked" : "ready",
      createdAt: dr.reviewedAt,
      updatedAt: dr.reviewedAt,
    });
  }

  if (wip?.refactorRequests.length) {
    const lines = wip.refactorRequests.map(
      (r) => `- ${r.id}: ${r.reason} (${r.status}) — ${r.instructions.slice(0, 500)}`,
    );
    out.push({
      id: `impl-artifact-refactor-${wip.refactorRequests[0]?.id ?? now}`,
      type: "refactor-request-report",
      stage: "implementation",
      title: TYPE_LABELS["refactor-request-report"],
      body: ["# 리팩토링 요청서", "", ...lines].join("\n"),
      source: ["codeAgentWipExecutionV1.refactorRequests"],
      status: "ready",
      createdAt: wip.refactorRequests[0]?.requestedAt ?? now,
      updatedAt: now,
    });
  }

  if (wip && (wip.status === "developer_approved" || wip.status === "scm_commit_pending")) {
    out.push({
      id: `impl-artifact-scm-ready-${wip.requestedAt}`,
      type: "scm-official-commit-ready",
      stage: "scm",
      title: TYPE_LABELS["scm-official-commit-ready"],
      body: [
        "# SCM 공식 반영 준비서",
        "",
        `- WIP branch: \`${wip.branchName}\``,
        `- provider: ${codeAgentProviderLabel(wip.provider)}`,
        `- 실행 상태: ${wip.status}`,
        `- work items: ${wip.workItems.join(", ") || "—"}`,
        `- commits: ${wip.commits.length}건`,
        "",
        "공식 push/PR/merge는 SCM이 담당합니다.",
      ].join("\n"),
      source: ["codeAgentWipExecutionV1"],
      status: wip.status === "scm_commit_pending" ? "ready" : "completed",
      createdAt: wip.requestedAt,
      updatedAt: wip.developerReview?.reviewedAt ?? wip.requestedAt,
    });
  }

  const dbStrategy = input.implementationDbStrategyV1;
  const projectArtifacts = input.projectArtifacts ?? [];

  if (
    slots &&
    shouldIncludeDbIntegrationDecisionArtifact({ slots, dbStrategy })
  ) {
    out.push({
      id: `impl-artifact-db-decision-${slots.updatedAt}`,
      type: "db-integration-decision",
      stage: "implementation",
      title: TYPE_LABELS["db-integration-decision"],
      body: buildDbIntegrationDecisionMarkdown({
        slots,
        projectArtifacts,
        plan: plan ?? null,
      }),
      source: ["implementationSlotsV1", "implementationDbStrategyV1"],
      status: "ready",
      createdAt: slots.createdAt,
      updatedAt: slots.updatedAt,
    });
  }

  if (slots && shouldIncludeDataModelDraftArtifact({ slots, dbStrategy })) {
    out.push({
      id: `impl-artifact-data-model-${slots.updatedAt}`,
      type: "data-model-draft",
      stage: "implementation",
      title: TYPE_LABELS["data-model-draft"],
      body: buildDataModelDraftMarkdown({ slots, plan: plan ?? null }),
      source: ["implementationSlotsV1", "implementationDbStrategyV1"],
      status: "draft",
      createdAt: slots.createdAt,
      updatedAt: slots.updatedAt,
    });
  }

  if (slots && shouldIncludeStorageStrategyArtifact({ slots, dbStrategy })) {
    out.push({
      id: `impl-artifact-storage-${slots.updatedAt}`,
      type: "storage-strategy",
      stage: "implementation",
      title: TYPE_LABELS["storage-strategy"],
      body: buildStorageStrategyMarkdown(slots),
      source: ["implementationSlotsV1", "implementationDbStrategyV1"],
      status: "ready",
      createdAt: slots.createdAt,
      updatedAt: slots.updatedAt,
    });
  }

  return out;
}

export function derivedImplementationArtifactToHubEntry(
  artifact: DerivedImplementationArtifact,
): ProjectArtifactHubEntry {
  const statusLabel =
    artifact.status === "completed"
      ? "완료"
      : artifact.status === "ready"
        ? "준비됨"
        : artifact.status === "blocked"
          ? "차단"
          : "초안";
  return {
    id: `derived-${artifact.id}`,
    kind: "deliverable",
    artifactType: "deliverable",
    title: artifact.title,
    sourceStage: "implementation",
    createdAt: artifact.createdAt,
    assetId: artifact.id,
    artifactStage: artifact.stage,
    hubSection: "implementation-primary",
    derivedMarkdown: artifact.body,
    implementationArtifactType: artifact.type,
    hubReason: `derived · ${artifact.source.join(", ")}`,
    hubReadinessLabel: statusLabel,
    hubRequired: true,
  };
}

export function derivedHubEntryToDeliverableAsset(
  entry: ProjectArtifactHubEntry,
  projectId: string,
): import("@/lib/requirements/ideationDeliverables").IdeationDeliverableAsset | null {
  const body = String(entry.derivedMarkdown ?? "").trim();
  if (!body) return null;
  const pid = projectId.trim();
  if (!pid) return null;
  return {
    id: entry.assetId,
    projectId: pid,
    type: "full_plan",
    title: entry.title,
    version: 1,
    content: body,
    createdAt: entry.createdAt,
  };
}

export function buildImplementationArtifactsTimelineEntry(input: {
  readonly action: "implementation_artifacts_derived" | "implementation_artifact_hub_opened" | "implementation_artifact_viewed";
  readonly implementationArtifactCount: number;
  readonly planningReferenceCount: number;
  readonly types: readonly string[];
  readonly viewedType?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    responseText: [
      `type=${input.action}`,
      "mode=implementation",
      `implementationArtifactCount=${input.implementationArtifactCount}`,
      `planningReferenceCount=${input.planningReferenceCount}`,
      `types=${input.types.join("|") || "none"}`,
      ...(input.viewedType ? [`viewedType=${input.viewedType}`] : []),
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}
