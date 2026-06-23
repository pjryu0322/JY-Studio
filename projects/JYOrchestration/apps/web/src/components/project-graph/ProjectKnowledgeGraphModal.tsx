"use client";

import { Suspense } from "react";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import { ProjectKnowledgeGraphWorkspace } from "@/components/project-graph/ProjectKnowledgeGraphWorkspace";
import { uiTokens as t } from "@/components/ui/tokens";

export function ProjectKnowledgeGraphModal(p: {
  readonly open: boolean;
  readonly projectId: string;
  readonly sourceMessageId?: string | null;
  readonly onClose: () => void;
}) {
  const pid = p.projectId.trim();
  if (!p.open || !pid) return null;

  return (
    <PrototypePreviewDraggableShell
      open={p.open}
      onClose={p.onClose}
      title="프로젝트 지식 그래프"
      modalWidth="min(1180px, calc(100vw - 24px))"
    >
      <div
        data-testid="project-knowledge-graph-modal-body"
        style={{ display: "flex", flexDirection: "column", minHeight: "min(78vh, 720px)", flex: 1 }}
      >
        <p style={{ margin: "0 0 12px", fontSize: 12, color: t.textMuted, lineHeight: 1.45 }}>
          Event Store에서 투영된 구조와 생성 Activity를 확인합니다. 노드를 선택한 뒤 드래그하면 해당 노드만 이동합니다.
        </p>
        <Suspense fallback={<p style={{ fontSize: 13, color: t.textMuted }}>그래프 UI 준비 중…</p>}>
          <ProjectKnowledgeGraphWorkspace
            projectId={pid}
            variant="modal"
            initialSourceMessageId={p.sourceMessageId ?? null}
          />
        </Suspense>
      </div>
    </PrototypePreviewDraggableShell>
  );
}
