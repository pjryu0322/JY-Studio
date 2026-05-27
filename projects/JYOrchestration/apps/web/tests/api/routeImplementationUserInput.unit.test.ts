import { describe, expect, it } from "vitest";
import { routeImplementationUserInput } from "@/lib/prototype/routeImplementationUserInput";

const baseParams = {
  visibleActionLabels: [] as string[],
  envOk: true,
  templatePlanningReady: true,
  implementationSeedReady: true,
  hasWorkUnits: false,
  isPlannerRunning: false,
  plannerCreatePending: false,
  protoBusy: false,
  projectName: "테스트",
  projectDescription: "",
  enableLlmClassifier: false,
};

describe("routeImplementationUserInput", () => {
  it("executes CREATE_WORK_PLAN for natural work plan phrase without LLM", async () => {
    const route = await routeImplementationUserInput({
      ...baseParams,
      text: "구현 작업안 생성해줘",
    });
    expect(route.kind).toBe("execute_action");
    if (route.kind === "execute_action") {
      expect(route.actionId).toBe("CREATE_WORK_PLAN");
    }
  });

  it("blocks CREATE_WORK_PLAN when env is not ready", async () => {
    const route = await routeImplementationUserInput({
      ...baseParams,
      envOk: false,
      text: "구현 작업안 생성해줘",
    });
    expect(route.kind).toBe("gate_blocked");
  });

  it("routes SCM view chip via alias to show_status", async () => {
    const route = await routeImplementationUserInput({
      ...baseParams,
      text: "SCM 점검 결과",
    });
    expect(route.kind).toBe("show_status");
    if (route.kind === "show_status") {
      expect(route.actionId).toBe("SHOW_SCM_CHECK");
    }
  });
});
