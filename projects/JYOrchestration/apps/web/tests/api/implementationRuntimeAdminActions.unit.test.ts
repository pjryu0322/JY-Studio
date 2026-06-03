import { describe, expect, it } from "vitest";
import {
  DISABLED_IMPLEMENTATION_RUNTIME_USER_ACTION_MESSAGE,
  isDisabledImplementationRuntimeUserAction,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeAdminActions";

describe("implementationRuntimeAdminActions", () => {
  it("disables recover, force_release, and redispatch for user routes", () => {
    expect(isDisabledImplementationRuntimeUserAction("recover")).toBe(true);
    expect(isDisabledImplementationRuntimeUserAction("force_release")).toBe(true);
    expect(isDisabledImplementationRuntimeUserAction("redispatch")).toBe(true);
    expect(isDisabledImplementationRuntimeUserAction("start_job")).toBe(false);
    expect(DISABLED_IMPLEMENTATION_RUNTIME_USER_ACTION_MESSAGE).toContain("비활성화");
  });
});
