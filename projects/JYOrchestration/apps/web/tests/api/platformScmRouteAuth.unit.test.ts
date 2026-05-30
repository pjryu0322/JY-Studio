import { describe, expect, it } from "vitest";
import {
  PLATFORM_SCM_EXECUTE_PERMISSION,
  PLATFORM_SCM_MERGE_PERMISSION,
} from "@/lib/prototype/platformScmRouteAuth";

describe("platformScmRouteAuth", () => {
  it("execute route requires canApplyGit, not canViewProject", () => {
    expect(PLATFORM_SCM_EXECUTE_PERMISSION).toBe("canApplyGit");
    expect(PLATFORM_SCM_EXECUTE_PERMISSION).not.toBe("canViewProject");
  });

  it("merge route requires canApplyGit, not canViewProject", () => {
    expect(PLATFORM_SCM_MERGE_PERMISSION).toBe("canApplyGit");
    expect(PLATFORM_SCM_MERGE_PERMISSION).not.toBe("canViewProject");
  });
});
