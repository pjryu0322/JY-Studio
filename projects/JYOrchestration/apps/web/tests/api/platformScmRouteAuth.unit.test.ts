import { describe, expect, it } from "vitest";
import {
  PLATFORM_SCM_DENIED_ROLES,
  PLATFORM_SCM_ALLOWED_ROLES,
  PLATFORM_SCM_EXECUTE_PERMISSION,
  PLATFORM_SCM_MERGE_PERMISSION,
  PLATFORM_SCM_ROLE_MATRIX,
  canPermissionsExecutePlatformScm,
  canRoleExecutePlatformScm,
  evaluatePlatformScmPermissionGate,
  filterPlatformScmNextActions,
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

  it("OWNER and EDITOR can execute platform SCM; REVIEWER and VIEWER cannot", () => {
    expect(PLATFORM_SCM_ALLOWED_ROLES).toEqual(["OWNER", "EDITOR"]);
    expect(PLATFORM_SCM_DENIED_ROLES).toEqual(["REVIEWER", "VIEWER"]);
    expect(canRoleExecutePlatformScm("OWNER")).toBe(true);
    expect(canRoleExecutePlatformScm("EDITOR")).toBe(true);
    expect(canRoleExecutePlatformScm("REVIEWER")).toBe(false);
    expect(canRoleExecutePlatformScm("VIEWER")).toBe(false);
    expect(PLATFORM_SCM_ROLE_MATRIX.OWNER).toBe(true);
    expect(PLATFORM_SCM_ROLE_MATRIX.EDITOR).toBe(true);
    expect(PLATFORM_SCM_ROLE_MATRIX.REVIEWER).toBe(false);
    expect(PLATFORM_SCM_ROLE_MATRIX.VIEWER).toBe(false);
  });

  it("canPermissionsExecutePlatformScm mirrors canApplyGit permission", () => {
    expect(canPermissionsExecutePlatformScm({ canApplyGit: true })).toBe(true);
    expect(canPermissionsExecutePlatformScm({ canApplyGit: false })).toBe(false);
    expect(canPermissionsExecutePlatformScm(null)).toBe(false);
  });

  it("filterPlatformScmNextActions removes SCM execute CTAs for viewers", () => {
    const filtered = filterPlatformScmNextActions(
      [
        { actionId: "REQUEST_CODE_AGENT_WIP", label: "SCM 반영 요청" },
        { actionId: "RUN_PLATFORM_SCM_MERGE", label: "PR Merge 실행" },
        { actionId: "RUN_FINAL_SCM", label: "최종 SCM 반영 실행" },
        { actionId: "SHOW_SCM_CHECK", label: "SCM 반영 기준 보기" },
      ],
      false,
    );
    expect(filtered.map((entry) => entry.label)).toEqual(["SCM 반영 기준 보기"]);
  });

  it("evaluatePlatformScmPermissionGate blocks when canApplyGit is false", () => {
    const gate = evaluatePlatformScmPermissionGate(false);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.message).toContain("OWNER");
    expect(gate.message).toContain("REVIEWER");
  });
});
