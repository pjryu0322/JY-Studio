import { describe, expect, it } from "vitest";
import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";
import {
  dataBranchFileBoundaryNeedsSanitize,
  sanitizeDataBranchGroupFileBoundary,
} from "@/lib/prototype/codeTaskDataBoundaryNormalization";
import {
  isLegacyMockCodeTaskId,
  resolveCanonicalCodeTaskForQueuedRun,
} from "@/lib/prototype/codeTaskCanonicalId";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const SAMPLE = "CODE-DATA-SAMPLE-001";
const MOCK = "CODE-DEV-MOCK-001-001";

function dataTask(codeTaskId: string, title: string): ImplementationCodeTaskV1 {
  return {
    codeTaskId,
    parentTaskId: "DEV-SAMPLE-DATA-001",
    title,
    description: "",
    changeType: "feature",
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    candidateFiles: [],
    branchPlan: {
      branchGroup: "data",
      workBranch: "wip/data/sample-data",
      baseBranch: "wip/foundation/app-shell",
      executionMode: "sequential",
    },
  };
}

describe("P3-M59 data boundary and queued target", () => {
  it("removes foundation files from data ownedFiles", () => {
    const boundary = {
      version: CODE_TASK_FILE_BOUNDARY_VERSION,
      expectedFiles: ["src/data/sample/*", "src/components/WorkspaceShell.*"],
      ownedFiles: ["src/data/sample/*", "src/styles/workspace.*"],
      forbiddenFiles: [],
    };
    expect(dataBranchFileBoundaryNeedsSanitize(boundary)).toBe(true);
    const out = sanitizeDataBranchGroupFileBoundary(boundary);
    expect(out.removedFiles).toContain("src/components/WorkspaceShell.*");
    expect(out.boundary.ownedFiles).toEqual(["src/data/sample/*"]);
    expect(out.boundary.forbiddenFiles.some((p) => p.includes("WorkspaceShell"))).toBe(true);
  });

  it("blocks data boundary with no data files after sanitize", () => {
    const boundary = {
      version: CODE_TASK_FILE_BOUNDARY_VERSION,
      expectedFiles: ["src/components/WorkspaceShell.*"],
      ownedFiles: ["app/index.html"],
      forbiddenFiles: [],
    };
    const out = sanitizeDataBranchGroupFileBoundary(boundary);
    expect(out.blocked?.code).toBe("blocked_data_boundary_has_no_data_files");
  });

  it("repairs legacy mock queued id to canonical sample-data task", () => {
    const tasks = [dataTask(SAMPLE, "샘플 데이터 생성")];
    const resolved = resolveCanonicalCodeTaskForQueuedRun({
      queuedCodeTaskId: MOCK,
      codeTasks: tasks,
      workBranch: "wip/data/sample-data",
      branchGroup: "data",
    });
    expect(resolved.status).toBe("repaired");
    if (resolved.status === "repaired") {
      expect(resolved.toCodeTaskId).toBe(SAMPLE);
      expect(resolved.reason).toBe("data_branch_singleton_match");
    }
  });

  it("blocks mock id when multiple data tasks exist", () => {
    const tasks = [
      dataTask(SAMPLE, "샘플 A"),
      dataTask("CODE-DEV-DATA-002", "샘플 B"),
    ];
    const resolved = resolveCanonicalCodeTaskForQueuedRun({
      queuedCodeTaskId: MOCK,
      codeTasks: tasks,
      workBranch: "wip/data/sample-data",
    });
    expect(resolved.status).toBe("blocked_mock_id");
  });

  it("detects legacy mock code task id prefix", () => {
    expect(isLegacyMockCodeTaskId(MOCK)).toBe(true);
    expect(isLegacyMockCodeTaskId(SAMPLE)).toBe(false);
  });
});
