"use client";

import { LabelTag } from "@/components/ui/LabelTag";
import { WORKSPACE_SECTION_META, type WorkspaceSectionKey } from "@/components/project-spec/workspaceSectionMeta";

/** 워크스페이스 추적 라벨은 `workspaceSectionMeta`의 `fullLabel`만 사용합니다. */
export function WorkspaceLabelBadge({ section }: { section: WorkspaceSectionKey }) {
  return <LabelTag label={WORKSPACE_SECTION_META[section].fullLabel} />;
}
