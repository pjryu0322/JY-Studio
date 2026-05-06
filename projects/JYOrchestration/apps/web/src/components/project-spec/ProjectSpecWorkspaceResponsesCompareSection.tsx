"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ProjectSpecResponseRecord } from "@/components/project-spec/types";
import { WorkspaceSectionHeader } from "@/components/project-spec/WorkspaceSectionHeader";
import { formatTestedAt } from "@/components/project-spec/format";
import { getSpecCandidateDisplayScore } from "@/lib/project-spec/specCandidatePayload";
import { parseMarkdownToSections } from "@/lib/project-spec/parseMarkdownSections";
import { summarizeMarkdownSectionDiff } from "@/lib/project-spec/specCompareSummary";
import { specWsPanelWhite } from "@/components/project-spec/projectSpecWorkspaceStyles";

type SpecCompareSectionChoice = "A" | "B";

export type ProjectSpecWorkspaceResponsesCompareSectionProps = Readonly<{
  responses: ProjectSpecResponseRecord[] | undefined;
  compareIds: readonly string[];
  canEdit: boolean;
  actionBusy: string | null;
  chosenSpecResponseId: string | null;
  setChosenSpecResponseId: Dispatch<SetStateAction<string | null>>;
  onConfirmResponse: (r: ProjectSpecResponseRecord) => void | Promise<void>;
  compareLeft: ProjectSpecResponseRecord | undefined;
  compareRight: ProjectSpecResponseRecord | undefined;
  setCompareIds: Dispatch<SetStateAction<string[]>>;
  setSelectedSections: Dispatch<SetStateAction<Record<string, SpecCompareSectionChoice>>>;
  setShowDiffOnly: Dispatch<SetStateAction<boolean>>;
  specCompareMode: "full" | "section";
  setSpecCompareMode: Dispatch<SetStateAction<"full" | "section">>;
  showDiffOnly: boolean;
  selectedSections: Record<string, SpecCompareSectionChoice>;
  expandedId: string | null;
  setExpandedId: Dispatch<SetStateAction<string | null>>;
  toggleCompareId: (id: string) => void;
  fullCompareLeftRef: RefObject<HTMLPreElement | null>;
  fullCompareRightRef: RefObject<HTMLPreElement | null>;
  syncFullCompareScroll: (source: "left" | "right") => void;
  specQuickBadgesById: Map<string, string[]>;
  confirmedId: string | null;
  onConfirmMerged: (
    mergedMarkdown: string,
    responseAId: string,
    responseBId: string
  ) => void | Promise<void>;
}>;

export function ProjectSpecWorkspaceResponsesCompareSection({
  responses,
  compareIds,
  canEdit,
  actionBusy,
  chosenSpecResponseId,
  setChosenSpecResponseId,
  onConfirmResponse,
  compareLeft,
  compareRight,
  setCompareIds,
  setSelectedSections,
  setShowDiffOnly,
  specCompareMode,
  setSpecCompareMode,
  showDiffOnly,
  selectedSections,
  expandedId,
  setExpandedId,
  toggleCompareId,
  fullCompareLeftRef,
  fullCompareRightRef,
  syncFullCompareScroll,
  specQuickBadgesById,
  confirmedId,
  onConfirmMerged,
}: ProjectSpecWorkspaceResponsesCompareSectionProps) {
  return (
    <div style={specWsPanelWhite}>
        <WorkspaceSectionHeader section="aiResponsesCompare" marginBottom={8} />
        <p style={{ margin: "0 0 14px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          여러 AI <strong>후보 중 하나를 선택</strong>해 공식 실행 계획으로 확정하는 단계입니다. 두 응답을 「비교」에 넣으면 기본은{" "}
          <strong>전체 문서</strong> 나란히 보기이며, 섹션 단위 비교는 보조 모드로 전환할 수 있습니다.
        </p>

        {responses?.length ? (
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1e3a8a" }}>결정</div>
            <span style={{ fontSize: 12, color: "#1e40af" }}>
              후보 카드에서 「이 응답 선택」 후 아래 버튼으로 확정하세요.
            </span>
            <button
              type="button"
              data-testid="spec-workspace-confirm-selected-spec"
              disabled={!canEdit || !chosenSpecResponseId || Boolean(actionBusy?.startsWith("confirm"))}
              onClick={() => {
                const r = responses.find((x) => x.id === chosenSpecResponseId);
                if (r) {
                  void onConfirmResponse(r);
                }
              }}
              style={{
                marginLeft: "auto",
                padding: "10px 18px",
                borderRadius: 8,
                border: chosenSpecResponseId ? "2px solid #1d4ed8" : "1px solid #93c5fd",
                background: chosenSpecResponseId ? "#2563eb" : "#e2e8f0",
                color: chosenSpecResponseId ? "#fff" : "#64748b",
                fontWeight: 900,
                fontSize: 13,
                cursor:
                  !canEdit || !chosenSpecResponseId || actionBusy?.startsWith("confirm") ? "not-allowed" : "pointer",
              }}
            >
              선택한 응답 확정
            </button>
          </div>
        ) : null}

        {actionBusy?.startsWith("confirm") ? (
          <p
            role="status"
            data-testid="spec-workspace-inline-confirm-spec"
            data-ui-label="[F-1-3-3-s] Inline — confirm / merge execution plan"
            style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}
          >
            실행 계획 확정을 처리하는 중입니다. 완료되면 Task 초안이 자동으로 맞춰질 수 있습니다.
          </p>
        ) : null}

        {compareLeft && compareRight ? (
          <div
            data-testid="spec-workspace-compare-panel"
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 10,
              border: "2px solid #0ea5e9",
              background: "#f0f9ff",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>응답 비교</strong>
              <button
                type="button"
                data-testid="spec-workspace-compare-clear"
                onClick={() => {
                  setCompareIds([]);
                  setSelectedSections({});
                  setShowDiffOnly(false);
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
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 16,
                marginBottom: 12,
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 800, color: "#0c4a6e" }}>Compare Mode:</span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="spec-compare-mode"
                  checked={specCompareMode === "full"}
                  onChange={() => setSpecCompareMode("full")}
                />
                Full Compare
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="spec-compare-mode"
                  checked={specCompareMode === "section"}
                  onChange={() => setSpecCompareMode("section")}
                />
                Section Compare
              </label>
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
                <div style={{ fontWeight: 800, marginBottom: 4 }}>Candidate A</div>
                <div>모델: {compareLeft.model}</div>
                {(() => {
                  const s = getSpecCandidateDisplayScore(compareLeft);
                  return (
                    <div style={{ fontSize: 11, color: "#0f172a", marginTop: 4, fontWeight: 700 }}>
                      문서 점수: {s.total}
                      <div style={{ fontWeight: 600, marginTop: 4 }}>
                        · Completeness: {s.completeness}
                        <br />· Structure: {s.structure}
                        <br />· Execution Ready: {s.executionReadiness}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                  토큰: 입력 {compareLeft.promptTokens ?? "-"} / 출력 {compareLeft.completionTokens ?? "-"} / 총{" "}
                  {compareLeft.totalTokens ?? "-"}
                </div>
                <div>시간: {formatTestedAt(compareLeft.createdAt)}</div>
                <div>
                  ID: <code>{compareLeft.id.slice(0, 10)}…</code>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>Candidate B</div>
                <div>모델: {compareRight.model}</div>
                {(() => {
                  const s = getSpecCandidateDisplayScore(compareRight);
                  return (
                    <div style={{ fontSize: 11, color: "#0f172a", marginTop: 4, fontWeight: 700 }}>
                      문서 점수: {s.total}
                      <div style={{ fontWeight: 600, marginTop: 4 }}>
                        · Completeness: {s.completeness}
                        <br />· Structure: {s.structure}
                        <br />· Execution Ready: {s.executionReadiness}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                  토큰: 입력 {compareRight.promptTokens ?? "-"} / 출력 {compareRight.completionTokens ?? "-"} / 총{" "}
                  {compareRight.totalTokens ?? "-"}
                </div>
                <div>시간: {formatTestedAt(compareRight.createdAt)}</div>
                <div>
                  ID: <code>{compareRight.id.slice(0, 10)}…</code>
                </div>
              </div>
            </div>
            {specCompareMode === "full" ? (
              (() => {
                const diffSummary = summarizeMarkdownSectionDiff(
                  compareLeft.responseMarkdown,
                  compareRight.responseMarkdown
                );
                const sL = getSpecCandidateDisplayScore(compareLeft);
                const sR = getSpecCandidateDisplayScore(compareRight);
                return (
                  <>
                    <div
                      style={{
                        marginBottom: 12,
                        padding: 12,
                        background: "#fff",
                        borderRadius: 8,
                        border: "1px solid #bae6fd",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 6, color: "#0c4a6e" }}>변경 요약</div>
                      <div style={{ fontSize: 13, color: "#0c4a6e" }}>
                        + Added: {diffSummary.added} sections · ~ Modified: {diffSummary.modified} sections · - Removed:{" "}
                        {diffSummary.removed} sections
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
                          전체 문서 · A (문서 점수 {sL.total})
                        </div>
                        <pre
                          ref={fullCompareLeftRef}
                          onScroll={() => syncFullCompareScroll("left")}
                          style={{
                            margin: 0,
                            maxHeight: 440,
                            overflow: "auto",
                            padding: 10,
                            borderRadius: 8,
                            border: "1px solid #93c5fd",
                            background: "#fff",
                            fontSize: 12,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            fontFamily: "ui-monospace, monospace",
                            color: "#0f172a",
                          }}
                        >
                          {compareLeft.responseMarkdown}
                        </pre>
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 13, color: "#0f172a" }}>
                          전체 문서 · B (문서 점수 {sR.total})
                        </div>
                        <pre
                          ref={fullCompareRightRef}
                          onScroll={() => syncFullCompareScroll("right")}
                          style={{
                            margin: 0,
                            maxHeight: 440,
                            overflow: "auto",
                            padding: 10,
                            borderRadius: 8,
                            border: "1px solid #93c5fd",
                            background: "#fff",
                            fontSize: 12,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            fontFamily: "ui-monospace, monospace",
                            color: "#0f172a",
                          }}
                        >
                          {compareRight.responseMarkdown}
                        </pre>
                      </div>
                    </div>
                  </>
                );
              })()
            ) : null}
            {specCompareMode === "section" ? (() => {
              const a = parseMarkdownToSections(compareLeft.responseMarkdown).sections;
              const b = parseMarkdownToSections(compareRight.responseMarkdown).sections;

              const mapA = new Map(a.map((s) => [s.key, s]));
              const mapB = new Map(b.map((s) => [s.key, s]));

              const orderedKeys = [
                ...a.map((s) => s.key),
                ...b
                  .map((s) => s.key)
                  .filter((k) => !mapA.has(k)),
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

              const filtered = showDiffOnly ? items.filter((x) => x.isDifferent) : items;

              const adoptAll = (choice: "A" | "B") => {
                const next: Record<string, "A" | "B"> = {};
                for (const k of orderedKeys) {
                  next[k] = choice;
                }
                setSelectedSections(next);
              };

              const mergedMarkdown = orderedKeys
                .map((key) => {
                  const it = items.find((x) => x.key === key);
                  if (!it) return "";
                  const chosen = selectedSections[key] ?? "A";
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
                        checked={showDiffOnly}
                        onChange={(e) => setShowDiffOnly(e.target.checked)}
                      />
                      차이만 보기
                    </label>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button
                        type="button"
                        data-testid="spec-workspace-compare-adopt-all-a"
                        onClick={() => adoptAll("A")}
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
                        응답 A 전체 채택
                      </button>
                      <button
                        type="button"
                        data-testid="spec-workspace-compare-adopt-all-b"
                        onClick={() => adoptAll("B")}
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
                        응답 B 전체 채택
                      </button>
                    </div>
                  </div>

                  {filtered.map((it) => {
                    const chosen = selectedSections[it.key] ?? "A";
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

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 10,
                            alignItems: "start",
                          }}
                        >
                          <div
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              background: chosen === "A" ? "rgba(59,130,246,0.10)" : "#f8fafc",
                              color: "#0f172a",
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
                              color: "#0f172a",
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
                            data-testid={`spec-workspace-compare-adopt-${it.key}-a`}
                            onClick={() => setSelectedSections((prev) => ({ ...prev, [it.key]: "A" }))}
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
                            data-testid={`spec-workspace-compare-adopt-${it.key}-b`}
                            onClick={() => setSelectedSections((prev) => ({ ...prev, [it.key]: "B" }))}
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
                      병합 결과 미리보기
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.65,
                        color: "#0f172a",
                        whiteSpace: "pre-wrap",
                        background: "#fff",
                        borderRadius: 10,
                        border: "1px solid #93c5fd",
                        padding: 12,
                        maxHeight: 240,
                        overflow: "auto",
                      }}
                      data-testid="spec-workspace-merged-preview"
                    >
                      {mergedMarkdown || "(선택된 섹션이 없습니다.)"}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        data-testid="spec-workspace-merged-confirm"
                        disabled={actionBusy === "confirm-merged"}
                        onClick={() => void onConfirmMerged(mergedMarkdown, compareLeft.id, compareRight.id)}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 8,
                          border: "1px solid #2563eb",
                          background: "#2563eb",
                          color: "#fff",
                          fontWeight: 900,
                          cursor: actionBusy === "confirm-merged" ? "wait" : "pointer",
                          fontSize: 13,
                          boxShadow: "0 2px 10px rgba(37,99,235,0.25)",
                        }}
                      >
                        {actionBusy === "confirm-merged" ? "확정 중…" : "이 내용으로 실행 계획 확정"}
                      </button>
                    </div>
                  </div>
                </>
              );
            })() : null}
          </div>
        ) : null}

        {!responses?.length ? (
          <p style={{ color: "#64748b", margin: 0 }}>
            아직 응답이 없습니다. 위에서 계획을 저장한 뒤 「AI 실행 계획 문서 생성」을 실행하세요.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {responses.map((r) => {
              const selected = confirmedId === r.id;
              const expanded = expandedId === r.id;
              const inCompare = compareIds.includes(r.id);
              const isChosen = chosenSpecResponseId === r.id;
              const sc = getSpecCandidateDisplayScore(r);
              const badges = specQuickBadgesById.get(r.id) ?? [];
              const lowScore = sc.completeness < 50 || sc.total < 50;
              return (
                <li
                  key={r.id}
                  data-testid={`spec-workspace-response-${r.id}`}
                  style={{
                    borderRadius: 10,
                    border: isChosen
                      ? "3px solid #2563eb"
                      : inCompare
                        ? "2px solid #0ea5e9"
                        : selected
                          ? "2px solid #22c55e"
                          : "1px solid #e2e8f0",
                    padding: 12,
                    background: isChosen ? "#dbeafe" : inCompare ? "#e0f2fe" : selected ? "#f0fdf4" : "#fafafa",
                    boxShadow: isChosen ? "0 0 0 3px rgba(37,99,235,0.15)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 13, flex: "1 1 200px" }}>
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                        ID {r.id.slice(0, 12)}…
                      </div>
                      <strong>{formatTestedAt(r.createdAt)}</strong>
                      <span style={{ color: "#64748b", marginLeft: 8 }}>
                        {r.provider} / {r.model}
                      </span>
                      {badges.length ? (
                        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {badges.map((b) => (
                            <span
                              key={b}
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: "#fef3c7",
                                color: "#92400e",
                                border: "1px solid #fcd34d",
                              }}
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                        토큰: 입력 {r.promptTokens ?? "-"} / 출력 {r.completionTokens ?? "-"} / 총 {r.totalTokens ?? "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#334155", marginTop: 6, fontWeight: 800 }}>
                        문서 점수: {sc.total}
                      </div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2, lineHeight: 1.5 }}>
                        · Completeness: {sc.completeness}
                        <br />
                        · Structure: {sc.structure}
                        <br />
                        · Execution Ready: {sc.executionReadiness}
                      </div>
                      {lowScore ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#b45309", fontWeight: 700 }}>
                          ⚠ 문서 완성도가 낮습니다(또는 총점이 낮음). 섹션 누락 가능성을 검토하세요.
                        </div>
                      ) : null}
                      {selected ? (
                        <span style={{ display: "inline-block", marginTop: 8, color: "#15803d", fontWeight: 800 }}>
                          현재 공식 실행 계획 출처
                        </span>
                      ) : null}
                      {isChosen ? (
                        <span style={{ display: "inline-block", marginTop: 8, marginLeft: 8, color: "#1d4ed8", fontWeight: 900 }}>
                          선택됨 — 아래 「선택한 응답 확정」을 누르세요
                        </span>
                      ) : null}
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
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={inCompare}
                          onChange={() => toggleCompareId(r.id)}
                          aria-label={`비교에 포함: ${r.id.slice(0, 8)}`}
                        />
                        비교
                      </label>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {expanded ? "접기" : "상세"}
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          data-testid={`spec-workspace-select-spec-${r.id}`}
                          onClick={() => setChosenSpecResponseId(r.id)}
                          disabled={Boolean(actionBusy?.startsWith("confirm"))}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 8,
                            border: isChosen ? "2px solid #1e40af" : "2px solid #3b82f6",
                            background: isChosen ? "#1d4ed8" : "#fff",
                            color: isChosen ? "#fff" : "#1d4ed8",
                            cursor: actionBusy?.startsWith("confirm") ? "not-allowed" : "pointer",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          이 응답 선택
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {expanded ? (
                    <pre
                      style={{
                        margin: "8px 0 0 0",
                        fontSize: 12,
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                        fontFamily: "ui-monospace, monospace",
                        color: "#334155",
                      }}
                    >
                      {r.responseMarkdown}
                    </pre>
                  ) : (
                    <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#334155", lineHeight: 1.45 }}>
                      {`${r.responseMarkdown.slice(0, 160)}${r.responseMarkdown.length > 160 ? "…" : ""}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
