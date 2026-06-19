import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectDataStoreSettingsPanel } from "@/components/planning/ProjectDataStoreSettingsPanel";
import { defaultPlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";

describe("ProjectDataStoreSettingsPanel", () => {
  it("renders datastore checkbox outside status table pattern", () => {
    const planningDb = {
      settings: {
        ...defaultPlanningDatabaseSettingsV1(),
        enabled: true,
        usageMode: "ENABLED_JYPROJECTS_SCHEMA" as const,
        usageSelectionCommitted: true,
        projectDbStatus: "PLANNED" as const,
      },
      busy: null,
      setDatabaseUsageEnabled: vi.fn(),
    };
    const html = renderToStaticMarkup(
      createElement(ProjectDataStoreSettingsPanel, { planningDb: planningDb as never, canEdit: true }),
    );
    expect(html).toContain("project-data-store-settings-panel");
    expect(html).toContain("project-data-store-usage-checkbox");
    expect(html).toContain("프로젝트 데이터 저장소");
    expect(html).not.toContain("prototype-env-database-usage-checkbox");
  });
});
