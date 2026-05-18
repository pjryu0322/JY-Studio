"use client";

import type { Dispatch, SetStateAction } from "react";
import type { SpecWorkspaceSnapshot } from "@/components/project-spec/api";
import type { ProjectSpecVersionRecord } from "@/components/project-spec/types";
import { WorkspaceSectionHeader } from "@/components/project-spec/WorkspaceSectionHeader";
import { formatTestedAt } from "@/components/project-spec/format";
import { parseMarkdownToSections } from "@/lib/project-spec/parseMarkdownSections";
import { specResponseSourceLabel } from "@/lib/project-spec/specResponseSourceLabel";
import { specWsPanelConfirmed } from "@/components/project-spec/projectSpecWorkspaceStyles";

type SpecVersionCompareChoice = "A" | "B";

export type ProjectSpecWorkspaceConfirmedSpecSectionProps = Readonly<{
  snapshotProject: SpecWorkspaceSnapshot["project"] | undefined;
  specVersions: ProjectSpecVersionRecord[];
  compareVersionLeft: ProjectSpecVersionRecord | undefined;
  compareVersionRight: ProjectSpecVersionRecord | undefined;
  versionCompareIds: readonly string[];
  setVersionCompareIds: Dispatch<SetStateAction<string[]>>;
  setVersionSelectedSections: Dispatch<SetStateAction<Record<string, SpecVersionCompareChoice>>>;
  versionShowDiffOnly: boolean;
  setVersionShowDiffOnly: Dispatch<SetStateAction<boolean>>;
  versionSelectedSections: Record<string, SpecVersionCompareChoice>;
  toggleVersionCompareId: (id: string) => void;
  canEdit: boolean;
  actionBusy: string | null;
  specEditOpen: boolean;
  setSpecEditOpen: Dispatch<SetStateAction<boolean>>;
  specDraftMarkdown: string;
  setSpecDraftMarkdown: Dispatch<SetStateAction<string>>;
  onAppendManualSpec: () => void | Promise<void>;
  onRefineSpec: () => void | Promise<void>;
  onRollbackSpec: (versionId: string) => void | Promise<void>;
}>;

export function ProjectSpecWorkspaceConfirmedSpecSection({
  snapshotProject,
  specVersions,
  compareVersionLeft,
  compareVersionRight,
  versionCompareIds,
  setVersionCompareIds,
  setVersionSelectedSections,
  versionShowDiffOnly,
  setVersionShowDiffOnly,
  versionSelectedSections,
  toggleVersionCompareId,
  canEdit,
  actionBusy,
  specEditOpen,
  setSpecEditOpen,
  specDraftMarkdown,
  setSpecDraftMarkdown,
  onAppendManualSpec,
  onRefineSpec,
  onRollbackSpec,
}: ProjectSpecWorkspaceConfirmedSpecSectionProps) {
  return (
    <div style={specWsPanelConfirmed}>
        <WorkspaceSectionHeader section="confirmedSpecVersions" marginBottom={8} />
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#166534", lineHeight: 1.5 }}>
          확정 내용은 버전 행으로만 쌓이며 기존 버전은 수정·삭제되지 않습니다. 「현재」는 활성 포인터이며, 롤백은 과거 버전을 다시 가리킬
          뿐 이력을 지우지 않습니다.
        </p>
        {snapshotProject?.confirmedSpecMarkdown ? (
          <>
            <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#166534" }}>
              활성 버전:{" "}
              {(() => {
                const curId = snapshotProject.currentSpecVersionId;
                const row = curId ? specVersions.find((v) => v.id === curId) : undefined;
                return row ? `v${row.version}` : "(조회 중)";
              })()}
              {" · "}
              확정 시각(해당 버전 생성):{" "}
              {snapshotProject.confirmedSpecAt ? formatTestedAt(snapshotProject.confirmedSpecAt) : "-"}
            </p>
            {canEdit ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  data-testid="spec-workspace-spec-edit-toggle"
                  onClick={() => {
                    setSpecDraftMarkdown(snapshotProject.confirmedSpecMarkdown ?? "");
                    setSpecEditOpen((o) => !o);
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #15803d",
                    background: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {specEditOpen ? "직접 수정 닫기" : "직접 수정"}
                </button>
                <button
                  type="button"
                  data-testid="spec-workspace-spec-ai-refine"
                  disabled={actionBusy === "refine-spec"}
                  onClick={() => void onRefineSpec()}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #15803d",
                    background: "#166534",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: actionBusy === "refine-spec" ? "wait" : "pointer",
                    fontSize: 13,
                  }}
                >
                  {actionBusy === "refine-spec" ? "AI 개선 중…" : "AI로 개선 (현재 확정 실행 계획 기준)"}
                </button>
              </div>
            ) : null}
            {actionBusy === "refine-spec" ? (
              <p
                role="status"
                data-ui-label="[F-1-3-4-s1] Inline — AI refine on confirmed spec"
                style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600, color: "#14532d" }}
              >
                확정된 실행 계획을 기준으로 AI 개선 응답을 받는 중입니다…
              </p>
            ) : null}
            {specEditOpen && canEdit ? (
              <div style={{ marginBottom: 12 }}>
                <textarea
                  data-testid="spec-workspace-spec-edit-textarea"
                  value={specDraftMarkdown}
                  onChange={(e) => setSpecDraftMarkdown(e.target.value)}
                  rows={14}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 12,
                    lineHeight: 1.5,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #86efac",
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    data-testid="spec-workspace-spec-save-new-version"
                    disabled={actionBusy === "append-manual"}
                    onClick={() => void onAppendManualSpec()}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #15803d",
                      background: "#22c55e",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: actionBusy === "append-manual" ? "wait" : "pointer",
                      fontSize: 13,
                    }}
                  >
                    {actionBusy === "append-manual" ? "저장 중…" : "새 버전으로 저장"}
                  </button>
                </div>
                {actionBusy === "append-manual" ? (
                  <p
                    role="status"
                    data-ui-label="[F-1-3-4-s2] Inline — manual spec version append"
                    style={{ margin: "10px 0 0 0", fontSize: 13, fontWeight: 600, color: "#14532d" }}
                  >
                    수정한 실행 계획을 새 버전으로 저장하는 중입니다…
                  </p>
                ) : null}
              </div>
            ) : null}
            <div
              data-testid="spec-workspace-confirmed-spec"
              style={{
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                padding: 12,
                background: "#fff",
                maxHeight: 240,
                overflow: "auto",
              }}
            >
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.5,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {snapshotProject.confirmedSpecMarkdown}
              </pre>
            </div>

            {specVersions.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 800, color: "#14532d" }}>버전 이력</h4>
                {actionBusy?.startsWith("rollback-") ? (
                  <p
                    role="status"
                    data-ui-label="[F-1-3-4-s3] Inline — spec version rollback"
                    style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600, color: "#92400e" }}
                  >
                    활성 실행 계획 버전을 변경(롤백)하는 중입니다…
                  </p>
                ) : null}
                <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#166534" }}>
                  두 버전을 선택하면 아래에서 응답 비교와 동일한 섹션 비교 UI를 사용합니다.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                  {specVersions.map((v) => {
                    const isCurrent = v.id === snapshotProject.currentSpecVersionId;
                    const inVCompare = versionCompareIds.includes(v.id);
                    return (
                      <li
                        key={v.id}
                        data-testid={`spec-workspace-spec-version-${v.version}`}
                        style={{
                          borderRadius: 8,
                          border: inVCompare ? "2px solid #0ea5e9" : "1px solid #bbf7d0",
                          padding: 10,
                          background: inVCompare ? "#e0f2fe" : "#fff",
                          fontSize: 13,
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                          <div>
                            <strong>v{v.version}</strong>
                            {isCurrent ? (
                              <span style={{ marginLeft: 8, color: "#15803d", fontWeight: 800 }}>현재</span>
                            ) : null}
                            <span style={{ marginLeft: 8, color: "#64748b" }}>{specResponseSourceLabel(v.sourceType)}</span>
                            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                              {formatTestedAt(v.createdAt)}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={inVCompare}
                                onChange={() => toggleVersionCompareId(v.id)}
                                aria-label={`버전 비교 v${v.version}`}
                              />
                              비교
                            </label>
                            {canEdit && !isCurrent ? (
                              <button
                                type="button"
                                data-testid={`spec-workspace-spec-rollback-v${v.version}`}
                                disabled={actionBusy?.startsWith("rollback-")}
                                onClick={() => void onRollbackSpec(v.id)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  border: "1px solid #b45309",
                                  background: "#fffbeb",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  cursor: actionBusy?.startsWith("rollback-") ? "wait" : "pointer",
                                }}
                              >
                                이 버전으로 롤백
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {compareVersionLeft && compareVersionRight ? (
              <div
                data-testid="spec-workspace-version-compare-panel"
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 10,
                  border: "2px solid #0ea5e9",
                  background: "#f0f9ff",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <strong style={{ fontSize: 15 }}>버전 비교</strong>
                  <button
                    type="button"
                    data-testid="spec-workspace-version-compare-clear"
                    onClick={() => {
                      setVersionCompareIds([]);
                      setVersionSelectedSections({});
                      setVersionShowDiffOnly(false);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #0369a1",
                      background: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    비교 해제
                  </button>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginBottom: 14,
                    fontSize: 12,
                    color: "#0c4a6e",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>버전 A</div>
                    <div>v{compareVersionLeft.version}</div>
                    <div>{formatTestedAt(compareVersionLeft.createdAt)}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>버전 B</div>
                    <div>v{compareVersionRight.version}</div>
                    <div>{formatTestedAt(compareVersionRight.createdAt)}</div>
                  </div>
                </div>
                {(() => {
                  const a = parseMarkdownToSections(compareVersionLeft.markdown).sections;
                  const b = parseMarkdownToSections(compareVersionRight.markdown).sections;
                  const mapA = new Map(a.map((s) => [s.key, s]));
                  const mapB = new Map(b.map((s) => [s.key, s]));
                  const orderedKeys = [
                    ...a.map((s) => s.key),
                    ...b.map((s) => s.key).filter((k) => !mapA.has(k)),
                  ];
                  const items = orderedKeys.map((key) => {
                    const secA = mapA.get(key);
                    const secB = mapB.get(key);
                    const title = secA?.title ?? secB?.title ?? key;
                    const contentA = secA?.content ?? "";
                    const contentB = secB?.content ?? "";
                    const isDifferent = contentA.trim() !== contentB.trim();
                    return { key, title, contentA, contentB, isDifferent };
                  });
                  const filtered = versionShowDiffOnly ? items.filter((x) => x.isDifferent) : items;
                  const adoptAllV = (choice: "A" | "B") => {
                    const next: Record<string, "A" | "B"> = {};
                    for (const k of orderedKeys) {
                      next[k] = choice;
                    }
                    setVersionSelectedSections(next);
                  };
                  const mergedVersionMarkdown = orderedKeys
                    .map((key) => {
                      const it = items.find((x) => x.key === key);
                      if (!it) return "";
                      const chosen = versionSelectedSections[key] ?? "A";
                      const content = (chosen === "A" ? it.contentA : it.contentB).trim();
                      if (!content) {
                        return it.key === "preamble" ? "" : "";
                      }
                      if (it.key === "preamble") {
                        return content;
                      }
                      return `## ${it.title}\n\n${content}`;
                    })
                    .filter(Boolean)
                    .join("\n\n");
                  return (
                    <>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#0c4a6e", fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            checked={versionShowDiffOnly}
                            onChange={(e) => setVersionShowDiffOnly(e.target.checked)}
                          />
                          차이만 보기
                        </label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            data-testid="spec-workspace-version-compare-adopt-all-a"
                            onClick={() => adoptAllV("A")}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #0369a1",
                              background: "#fff",
                              fontWeight: 700,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            A 전체 채택
                          </button>
                          <button
                            type="button"
                            data-testid="spec-workspace-version-compare-adopt-all-b"
                            onClick={() => adoptAllV("B")}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #0369a1",
                              background: "#fff",
                              fontWeight: 700,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            B 전체 채택
                          </button>
                        </div>
                      </div>
                      {filtered.map((it) => {
                        const chosen = versionSelectedSections[it.key] ?? "A";
                        return (
                          <div
                            key={it.key}
                            style={{
                              marginBottom: 14,
                              padding: 12,
                              borderRadius: 10,
                              border: "1px solid #93c5fd",
                              background: it.isDifferent ? "rgba(255, 200, 0, 0.15)" : "#fff",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 14,
                                color: "#0f172a",
                                padding: "8px 10px",
                                borderTop: "1px solid #cbd5e1",
                                borderBottom: "1px solid #cbd5e1",
                                marginBottom: 12,
                              }}
                            >
                              {it.title}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
                              <div
                                style={{
                                  padding: 10,
                                  borderRadius: 8,
                                  background: chosen === "A" ? "rgba(59,130,246,0.10)" : "#f8fafc",
                                  lineHeight: 1.65,
                                  fontSize: 13,
                                  whiteSpace: "pre-wrap",
                                  border: chosen === "A" ? "1px solid rgba(37,99,235,0.35)" : "1px solid transparent",
                                }}
                              >
                                {it.contentA || "(없음)"}
                              </div>
                              <div
                                style={{
                                  padding: 10,
                                  borderRadius: 8,
                                  background: chosen === "B" ? "rgba(59,130,246,0.10)" : "#f8fafc",
                                  lineHeight: 1.65,
                                  fontSize: 13,
                                  whiteSpace: "pre-wrap",
                                  border: chosen === "B" ? "1px solid rgba(37,99,235,0.35)" : "1px solid transparent",
                                }}
                              >
                                {it.contentB || "(없음)"}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                data-testid={`spec-workspace-version-compare-adopt-${it.key}-a`}
                                onClick={() => setVersionSelectedSections((prev) => ({ ...prev, [it.key]: "A" }))}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: chosen === "A" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                                  background: chosen === "A" ? "#2563eb" : "#e2e8f0",
                                  color: "#fff",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                [A 채택]
                              </button>
                              <button
                                type="button"
                                data-testid={`spec-workspace-version-compare-adopt-${it.key}-b`}
                                onClick={() => setVersionSelectedSections((prev) => ({ ...prev, [it.key]: "B" }))}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: chosen === "B" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                                  background: chosen === "B" ? "#2563eb" : "#e2e8f0",
                                  color: "#fff",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                  fontSize: 12,
                                }}
                              >
                                [B 채택]
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div
                        style={{
                          marginTop: 10,
                          border: "1px solid rgba(59,130,246,0.35)",
                          borderRadius: 12,
                          background: "#eff6ff",
                          padding: 12,
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>
                          섹션 채택 결과 미리보기
                        </div>
                        <div
                          data-testid="spec-workspace-version-merged-preview"
                          style={{
                            fontSize: 13,
                            lineHeight: 1.65,
                            whiteSpace: "pre-wrap",
                            background: "#fff",
                            borderRadius: 10,
                            border: "1px solid #93c5fd",
                            padding: 12,
                            maxHeight: 200,
                            overflow: "auto",
                          }}
                        >
                          {mergedVersionMarkdown || "(선택된 섹션이 없습니다.)"}
                        </div>
                        <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#475569" }}>
                          새 확정 버전으로 저장하려면 위 「직접 수정」에 붙여 넣거나, AI 응답 비교의 병합 확정 흐름을 사용하세요.
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </>
        ) : (
          <p style={{ margin: 0, color: "#166534", fontSize: 14 }}>
            아직 확정된 실행 계획이 없습니다. AI 응답 중 하나를 선택해 확정하면 Task 생성 등의 기준으로 사용할 수 있습니다.
          </p>
        )}
    </div>
  );
}
