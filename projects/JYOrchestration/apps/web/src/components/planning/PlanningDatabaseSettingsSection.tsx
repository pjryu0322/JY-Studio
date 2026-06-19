"use client";

import {
  isDatabaseUsageEnabledMode,
  resolveDatabaseUsageMode,
} from "@/lib/planning/planningDatabaseUsageMode";
import {
  projectDatabaseUserInlineStatusCopy,
  projectDatabaseUserSectionHeadline,
} from "@/lib/planning/projectDatabaseUserDisplay";
import type { usePlanningDatabaseSettings } from "@/components/planning/usePlanningDatabaseSettings";

type PlanningDbState = ReturnType<typeof usePlanningDatabaseSettings>;

type Props = Readonly<{
  readonly planningDb: PlanningDbState;
}>;

export function PlanningDatabaseSettingsSection({ planningDb }: Props) {
  const { settings, busy, saveMessage } = planningDb;
  const usageMode = resolveDatabaseUsageMode(settings);
  const dbUsageEnabled = isDatabaseUsageEnabledMode(usageMode) && settings.enabled;
  const inlineCopy = projectDatabaseUserInlineStatusCopy(settings);

  return (
    <div data-testid="planning-database-settings-section" style={{ maxWidth: 720 }}>
      <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b" }}>
        현재 상태: {projectDatabaseUserSectionHeadline(settings)}
      </p>
      {usageMode === "UNSELECTED" ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          위 표에서 「데이터베이스 사용」을 선택해 주세요. 사용하지 않으면 JSON 샘플데이터로 구현단계를 진행합니다.
        </p>
      ) : null}
      {inlineCopy ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#334155", lineHeight: 1.55 }}>{inlineCopy}</p>
      ) : null}
      {dbUsageEnabled ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          플랫폼 데이터 저장소를 사용합니다. Quick Design 확정 후 필요한 데이터 구조와 샘플데이터가 자동 생성됩니다.
        </p>
      ) : null}
      {busy === "save" ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }} role="status">
          저장 중…
        </p>
      ) : null}
      {saveMessage && busy !== "save" ? (
        <p style={{ marginTop: 10, fontSize: 12, color: "#334155", lineHeight: 1.5 }} role="status">
          {saveMessage}
        </p>
      ) : null}
    </div>
  );
}
