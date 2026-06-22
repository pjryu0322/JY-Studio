"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { StructureGraphReflectionBadge, StructureLifecycleBadge } from "@/components/project-structure/StructureLifecycleBadge";
import { StructureExplainabilitySection } from "@/components/project-structure/StructureExplainabilitySection";
import {
  patchStructureEdit,
  postStructureApprove,
  postStructureMerge,
  postStructureReject,
} from "@/lib/project-structure/structureReviewApi";
import type { StructureCandidateRow, StructureConflictRow } from "@/lib/project-structure/structureReviewUiTypes";
import {
  candidateCanMerge,
  conflictsForCandidate,
  pickDefaultMergeTargetId,
  resolveGraphReflectionStatus,
} from "@/lib/project-structure/structureReviewViewModel";

const btn: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${t.border}`,
  cursor: "pointer",
  background: t.bgPage,
};

export function StructureCandidateDetailPanel({
  projectId,
  candidate,
  conflicts,
  candidates,
  onRefresh,
}: {
  readonly projectId: string;
  readonly candidate: StructureCandidateRow | null;
  readonly conflicts: readonly StructureConflictRow[];
  readonly candidates: readonly StructureCandidateRow[];
  readonly onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!candidate) {
    return (
      <div style={{ padding: 24, color: t.textMuted, fontSize: 14 }}>왼쪽에서 후보를 선택하세요.</div>
    );
  }

  const reflection = resolveGraphReflectionStatus(candidate);
  const relatedConflicts = conflictsForCandidate(candidate.id, conflicts);
  const canMerge = candidateCanMerge(candidate.id, conflicts);
  const defaultMergeTarget = pickDefaultMergeTargetId(candidate.id, conflicts);
  const isCandidate = candidate.lifecycleStatus === "CANDIDATE";

  const startEdit = () => {
    setTitle(candidate.title);
    setSummary(candidate.summary);
    setEditing(true);
    setActionError(null);
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      setEditing(false);
      onRefresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16, overflow: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <StructureLifecycleBadge status={candidate.lifecycleStatus} />
        <StructureGraphReflectionBadge status={reflection} />
        <span style={{ fontSize: 12, color: t.textMuted }}>{candidate.nodeType}</span>
      </div>

      {editing ? (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontSize: 15, fontWeight: 700, padding: 8, borderRadius: 8, border: `1px solid ${t.border}` }}
          />
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={8}
            style={{ fontSize: 13, padding: 10, borderRadius: 8, border: `1px solid ${t.border}`, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy}
              style={{ ...btn, background: t.primary, color: "#fff", borderColor: t.primary }}
              onClick={() =>
                void run(() => patchStructureEdit(projectId, { candidateId: candidate.id, title, summary }))
              }
            >
              저장
            </button>
            <button type="button" disabled={busy} style={btn} onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 style={{ margin: 0, fontSize: 18, color: t.textPrimary }}>{candidate.title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {candidate.summary || "—"}
          </p>
        </>
      )}

      <dl style={{ margin: 0, fontSize: 12, color: t.textMuted, display: "grid", gap: 6 }}>
        <div>
          <dt style={{ fontWeight: 700, display: "inline" }}>Source Event: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{candidate.sourceEventId ?? "—"}</dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700, display: "inline" }}>Graph Node: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{candidate.approvedGraphNodeId ?? "—"}</dd>
        </div>
      </dl>

      {relatedConflicts.length > 0 ? (
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            border: `1px solid ${t.borderCaution}`,
            background: t.surfaceCaution,
            fontSize: 12,
          }}
        >
          <strong style={{ color: t.textCautionStrong }}>Conflict</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {relatedConflicts.map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <StructureExplainabilitySection candidate={candidate} />

      {actionError ? <p style={{ color: t.danger, fontSize: 12, margin: 0 }}>{actionError}</p> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "auto", paddingTop: 8 }}>
        <button
          type="button"
          disabled={busy || !isCandidate}
          style={{ ...btn, background: "#ecfdf5", borderColor: "#a7f3d0", color: t.success }}
          onClick={() => void run(() => postStructureApprove(projectId, [candidate.id]))}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy || !isCandidate}
          style={{ ...btn, color: t.danger }}
          onClick={() => void run(() => postStructureReject(projectId, [candidate.id]))}
        >
          Reject
        </button>
        <button type="button" disabled={busy} style={btn} onClick={startEdit}>
          Edit
        </button>
        <button
          type="button"
          disabled={busy || !canMerge || !defaultMergeTarget}
          title={canMerge ? "충돌이 있는 경우에만 병합할 수 있습니다" : "충돌 없음"}
          style={btn}
          onClick={() => {
            if (!defaultMergeTarget) return;
            const source = candidate.id;
            const target = defaultMergeTarget;
            void run(() => postStructureMerge(projectId, source, target));
          }}
        >
          Merge
        </button>
      </div>

      {canMerge && defaultMergeTarget ? (
        <p style={{ fontSize: 11, color: t.textMuted, margin: 0 }}>
          병합 대상: {candidates.find((c) => c.id === defaultMergeTarget)?.title ?? defaultMergeTarget}
        </p>
      ) : null}
    </div>
  );
}
