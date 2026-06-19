import { describe, expect, it } from "vitest";
import {
  JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME,
  JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME,
} from "@/lib/planning/platformDatabaseRoles";
import { buildPlanningHandoffForImplementation, buildPlanningDataSlotsDraft } from "@/lib/planning/planningDataSlotsV1";
import { defaultPlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import { readyPlatformSchemaSettings } from "./platformManagedProjectDatabase.unit.test";

describe("platform database role split", () => {
  it("exposes canonical database role names", () => {
    expect(JYORCHESTRATION_PLATFORM_MANAGEMENT_DATABASE_NAME).toBe("jyorchestration");
    expect(JYPROJECTS_GENERATED_PROJECT_DATA_DATABASE_NAME).toBe("jyprojects");
  });

  it("includes both database roles in implementation handoff when DB usage is on", () => {
    const settings = readyPlatformSchemaSettings();
    const slots = buildPlanningDataSlotsDraft({
      repositoryName: "aiproject",
      projectId: "p1",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: settings,
    });
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "aiproject",
      planningDataSlots: slots,
      planningDatabaseSettings: settings,
    });
    expect(handoff.implementationDataPlan.platformManagementDatabaseName).toBe("jyorchestration");
    expect(handoff.implementationDataPlan.generatedProjectDataDatabaseName).toBe("jyprojects");
  });

  it("sets platform management DB only when JSON sample path is selected", () => {
    const settings = defaultPlanningDatabaseSettingsV1();
    const slots = buildPlanningDataSlotsDraft({
      repositoryName: "aiproject",
      projectId: "p1",
      orchestration: null,
      definitions: [],
      planningDatabaseSettings: {
        ...settings,
        enabled: false,
        usageMode: "DISABLED_JSON_SAMPLE",
        usageSelectionCommitted: true,
      },
    });
    const handoff = buildPlanningHandoffForImplementation({
      projectId: "p1",
      repositoryName: "aiproject",
      planningDataSlots: slots,
      planningDatabaseSettings: {
        ...settings,
        enabled: false,
        usageMode: "DISABLED_JSON_SAMPLE",
        usageSelectionCommitted: true,
      },
    });
    expect(handoff.implementationDataPlan.platformManagementDatabaseName).toBe("jyorchestration");
    expect(handoff.implementationDataPlan.generatedProjectDataDatabaseName).toBeNull();
  });
});
