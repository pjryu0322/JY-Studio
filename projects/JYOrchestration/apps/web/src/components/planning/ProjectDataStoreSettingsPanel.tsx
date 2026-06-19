"use client";

import {
  isDatabaseUsageEnabledMode,
  resolveDatabaseUsageMode,
} from "@/lib/planning/planningDatabaseUsageMode";
import {
  applyPlanningDatabaseUsageToggle,
  type usePlanningDatabaseSettings,
} from "@/components/planning/usePlanningDatabaseSettings";

type PlanningDbState = ReturnType<typeof usePlanningDatabaseSettings>;

type Props = Readonly<{
  readonly planningDb: PlanningDbState;
  readonly canEdit: boolean;
}>;

export function ProjectDataStoreSettingsPanel({ planningDb, canEdit }: Props) {
  const { settings, busy, setDatabaseUsageEnabled } = planningDb;
  const usageMode = resolveDatabaseUsageMode(settings);
  const dbUsageEnabled = isDatabaseUsageEnabledMode(usageMode) && settings.enabled;
  const disabled = !canEdit || busy !== null;

  return (
    <section
      data-testid="project-data-store-settings-panel"
      style={{
        marginTop: 16,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0", fontSize: 13, fontWeight: 900, color: "#0f172a" }}>
        프로젝트 데이터 저장소
      </h3>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          fontSize: 13,
          color: "#334155",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={dbUsageEnabled}
          disabled={disabled}
          data-testid="project-data-store-usage-checkbox"
          onChange={(e) => setDatabaseUsageEnabled(e.target.checked)}
        />
        <span style={{ fontWeight: 700 }}>데이터베이스 사용</span>
      </label>
      {dbUsageEnabled ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          플랫폼 데이터 저장소를 사용합니다. 생성 프로젝트 데이터는 프로젝트별 schema로 관리됩니다. Quick Design 확정
          후 구현단계 table과 seed 데이터가 생성됩니다. 검토단계 전환 시 검토용 schema와 test data가 생성됩니다.
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          데이터베이스를 사용하지 않습니다. 구현단계에서는 JSON 샘플데이터로 화면과 기능 흐름을 확인합니다.
        </p>
      )}
    </section>
  );
}
