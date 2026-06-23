"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uiTokens as t } from "@/components/ui/tokens";
import { exitProjectKnowledgeGraphView } from "@/lib/project-graph/projectKnowledgeGraphClose";

export function ProjectKnowledgeGraphCloseButton(p: {
  readonly projectId: string;
  readonly onClose?: () => void;
}) {
  const router = useRouter();
  const exit = useCallback(() => {
    if (p.onClose) {
      p.onClose();
      return;
    }
    exitProjectKnowledgeGraphView(router, p.projectId);
  }, [p.onClose, p.projectId, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit]);

  return (
    <button
      type="button"
      onClick={exit}
      aria-label="닫기"
      title="닫기"
      style={{
        minWidth: 44,
        minHeight: 44,
        padding: "8px 14px",
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.bgPage,
        fontSize: 13,
        fontWeight: 700,
        color: t.textSecondary,
        cursor: "pointer",
      }}
    >
      닫기
    </button>
  );
}
