"use client";

import { useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { ImplementationPlanningReadinessCardVM } from "@/lib/prototype/implementationPlanningReadinessUi";
import { formatCodeTaskFeedbackSummaryLine } from "@/lib/prototype/implementationCodeTaskFeedbackUi";

function toneColor(tone: "ok" | "warn"): string {
  return tone === "ok" ? "#15803d" : "#b45309";
}

function toneBackground(tone: "ok" | "warn"): string {
  return tone === "ok" ? "#f0fdf4" : "#fffbeb";
}

export function ImplementationPlanningReadinessCard({
  vm,
}: {
  readonly vm: ImplementationPlanningReadinessCardVM;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <section
      aria-label="구현준비 확인"
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        background: toneBackground(vm.overallTone),
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 12, fontWeight: 900, color: t.textPrimary }}>구현준비 확인</strong>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: toneColor(vm.overallTone),
            border: `1px solid ${toneColor(vm.overallTone)}`,
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          {vm.overallLabel}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 6,
          fontSize: 11,
          color: t.textPrimary,
        }}
      >
        <div>Process Task: {vm.parentTaskCount}</div>
        <div>CodeTask: {vm.codeTaskCount}</div>
        <div>WorkItem: {vm.workItemCount}</div>
        <div>Validation: {vm.validationStatus === "passed" ? "통과" : vm.validationStatus === "failed" ? "실패" : "미확인"}</div>
        <div>
          CodeTask 품질:{" "}
          {vm.qualityStatus === "passed"
            ? "통과"
            : vm.qualityStatus === "warning"
              ? `경고 ${vm.qualityWarningCount}개`
              : vm.qualityStatus === "failed"
                ? "실패"
                : "미확인"}
        </div>
        <div>위험 CodeTask: {vm.riskyCodeTaskIds.length}개</div>
        <div>Preflight: {vm.preflightStatus === "passed" ? "통과" : vm.preflightStatus === "failed" ? "실패" : "미확인"}</div>
        <div>{vm.llmRefinementLabel}</div>
        <div>구현단계 진입: {vm.executionReady ? "가능" : "불가"}</div>
      </div>

      {vm.feedbackSummary ? (
        <div style={{ fontSize: 11, color: t.textPrimary, lineHeight: 1.5 }}>
          {formatCodeTaskFeedbackSummaryLine(vm.feedbackSummary)}
        </div>
      ) : null}

      {vm.attentionItems.length ? (
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
          <strong style={{ color: t.textPrimary }}>주의 항목</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {vm.attentionItems.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {vm.supplementReasons.length ? (
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
          <strong style={{ color: t.textPrimary }}>보완 필요 사유</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {vm.supplementReasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {vm.advancedTasks.length ? (
        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            style={{
              border: `1px solid ${t.border}`,
              background: "#fff",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              color: t.textPrimary,
            }}
          >
            {advancedOpen ? "고급 보기 닫기" : "고급 보기"}
          </button>
          {advancedOpen ? (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {vm.advancedTasks.map((task) => (
                <div
                  key={task.codeTaskId}
                  style={{
                    border: `1px solid ${t.border}`,
                    borderRadius: 8,
                    padding: "6px 8px",
                    background: "#fff",
                    fontSize: 10.5,
                    lineHeight: 1.45,
                    color: t.textPrimary,
                  }}
                >
                  <div>
                    <strong>{task.title}</strong> · {task.changeType} · {task.status}
                  </div>
                  <div>
                    parent={task.parentTaskId} · code={task.codeTaskId}
                  </div>
                  {task.parentTaskDependencies.length ? (
                    <div>parent deps: {task.parentTaskDependencies.join(", ")}</div>
                  ) : null}
                  {task.codeTaskDependencies.length ? (
                    <div>code deps: {task.codeTaskDependencies.join(", ")}</div>
                  ) : null}
                  {task.candidateFileHints.length ? (
                    <div>hints: {task.candidateFileHints.slice(0, 3).join(", ")}</div>
                  ) : null}
                  {task.llmRationale ? <div>rationale: {task.llmRationale}</div> : null}
                  {task.qualityIssues?.length ? (
                    <div>
                      quality:{" "}
                      {task.qualityIssues
                        .slice(0, 3)
                        .map((issue) => `${issue.issueCode}(${issue.severity})`)
                        .join(", ")}
                    </div>
                  ) : null}
                </div>
              ))}
              {vm.feedbackTaskRows?.length ? (
                <div style={{ marginTop: 4, fontSize: 10.5, color: t.textMuted }}>
                  <strong style={{ color: t.textPrimary }}>CodeTask 실행 feedback</strong>
                  {vm.feedbackTaskRows.map((row) => (
                    <div
                      key={`feedback-${row.codeTaskId}`}
                      style={{
                        marginTop: 4,
                        border: `1px solid ${t.border}`,
                        borderRadius: 8,
                        padding: "6px 8px",
                        background: "#fff",
                        color: t.textPrimary,
                      }}
                    >
                      <div>
                        {row.codeTaskId} · {row.status}
                      </div>
                      {row.lastFailureReason ? <div>failure: {row.lastFailureReason}</div> : null}
                      {row.lastCauseLayer ? <div>cause: {row.lastCauseLayer}</div> : null}
                      {row.lastCommitSha ? <div>commit: {row.lastCommitSha}</div> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
