"use client";

import {
  PROJECT_ARTIFACT_LABELS,
  PROJECT_ARTIFACT_MENU_ORDER,
  type ProjectArtifactType,
} from "@/lib/requirements/projectArtifactTypes";
import { WorkspacePlusMenuDivider } from "@/components/workspace/WorkspacePlusMenu";
import styles from "@/components/workspace/workspacePlusMenu.module.css";

export function WorkspaceArtifactPlusMenuItems({
  disabled,
  onGenerate,
  onPick,
}: {
  readonly disabled?: boolean;
  readonly onGenerate: (type: ProjectArtifactType) => void;
  readonly onPick: () => void;
}) {
  return (
    <>
      <WorkspacePlusMenuDivider />
      <div className={styles.sub} style={{ padding: "6px 12px 4px", fontWeight: 700 }}>
        Artifact 생성
      </div>
      {PROJECT_ARTIFACT_MENU_ORDER.map((type) => (
        <button
          key={type}
          type="button"
          role="menuitem"
          disabled={disabled}
          className={styles.item}
          onClick={() => {
            if (disabled) return;
            onGenerate(type);
            onPick();
          }}
        >
          <span className={styles.title}>{PROJECT_ARTIFACT_LABELS[type]}</span>
        </button>
      ))}
    </>
  );
}
