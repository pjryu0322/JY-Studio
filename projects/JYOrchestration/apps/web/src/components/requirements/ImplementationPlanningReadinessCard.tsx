"use client";

import { useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { ImplementationPlanningReadinessCardVM } from "@/lib/prototype/implementationPlanningReadinessUi";

function statusToneColor(tone: ImplementationPlanningReadinessCardVM["statusTone"]): string {
  if (tone === "ok") return "#15803d";
  if (tone === "warn") return "#b45309";
  return "#b91c1c";
}

function statusToneBackground(tone: ImplementationPlanningReadinessCardVM["statusTone"]): string {
  if (tone === "ok") return "#f0fdf4";
  if (tone === "warn") return "#fffbeb";
  return "#fef2f2";
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
        background: statusToneBackground(vm.statusTone),
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
            color: statusToneColor(vm.statusTone),
            border: `1px solid ${statusToneColor(vm.statusTone)}`,
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          {vm.statusLabel}
          {vm.warningCount > 0 ? " · 주의 항목 있음" : ""}
        </span>
      </div>

      <div style={{ fontSize: 11, color: t.textPrimary, lineHeight: 1.55 }}>
        <div style={{ fontWeight: 800 }}>{vm.executionReady ? "구현단계 진입 가능" : "구현단계 진입 불가"}</div>
        <div style={{ marginTop: 2, color: t.textMuted }}>{vm.summaryMessage}</div>
        {vm.warningCount > 0 ? (
          <div style={{ marginTop: 4, color: t.textMuted }}>주의 항목 {vm.warningCount}개</div>
        ) : null}
        {!vm.executionReady && vm.supplementReasons.length ? (
          <div style={{ marginTop: 4, color: t.textMuted }}>
            보완 필요: {vm.supplementReasons[0]}
          </div>
        ) : null}
      </div>

      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>{vm.detailHint}</div>

      {vm.hasDetails ? (
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
            {advancedOpen ? "상세 로그 닫기" : "상세 로그 보기"}
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
              <div
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
                <div style={{ fontWeight: 900 }}>내부 실행 요약 (로그용)</div>
                <div>Process Task: {vm.parentTaskCount}</div>
                <div>CodeTask: {vm.codeTaskCount}</div>
                <div>WorkItem: {vm.workItemCount}</div>
                <div>
                  Validation:{" "}
                  {vm.validationStatus === "passed"
                    ? "통과"
                    : vm.validationStatus === "failed"
                      ? "실패"
                      : "미확인"}
                </div>
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
                <div>
                  Preflight:{" "}
                  {vm.preflightStatus === "passed"
                    ? "통과"
                    : vm.preflightStatus === "failed"
                      ? "실패"
                      : "미확인"}
                </div>
                <div>{vm.llmRefinementLabel}</div>
                <div>구현단계 진입: {vm.executionReady ? "가능" : "불가"}</div>
              </div>

              {vm.attentionItems.length ? (
                <div style={{ fontSize: 10.5, color: t.textMuted }}>
                  <strong style={{ color: t.textPrimary }}>주의 항목</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {vm.attentionItems.slice(0, 6).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {vm.supplementReasons.length ? (
                <div style={{ fontSize: 10.5, color: t.textMuted }}>
                  <strong style={{ color: t.textPrimary }}>보완 필요 사유</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {vm.supplementReasons.slice(0, 6).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
