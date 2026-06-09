import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  ensureGithubIntegrationBranch,
  isValidProjectIntegrationBranchName,
} from "@/lib/prototype/githubIntegrationBranchService";
import { mergeWorkBranchIntoIntegrationBranch } from "@/lib/prototype/githubIntegrationMergeService";
import {
  INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE,
  INTEGRATION_BRANCH_REUSE_USER_MESSAGE,
  toUserSafeIntegrationErrorMessage,
} from "@/lib/prototype/implementationIntegrationErrors";
import {
  integrationPlanHasExistingBranchResumeEvidence,
  integrationPlanHasSuccessfulMerge,
} from "@/lib/prototype/implementationIntegrationPlanMergeStatus";
import { recoverCompletedIntegrationStepsFromPlan } from "@/lib/prototype/implementationIntegrationStepRecovery";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { formatExecutionLogTimelineLabel } from "@/lib/prototype/promptTimelineExecutionLogTabs";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";

import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";

const prototypeDir = join(process.cwd(), "src/lib/prototype");
const REPO = "https://github.com/o/r";
const TOKEN = "gh-test";
const PID = "p035reuse";
const BRANCH = `integration/${PID}-20260609-0124`;

function fetchRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return String((input as Request).url ?? input);
}

function integrationCodeTaskPlan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: PID,
    generatedAt: "2026-06-09T01:00:00.000Z",
    tasks: [
      {
        codeTaskId: "CODE-INT",
        parentTaskId: "DEV-INT",
        title: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
        description: "",
        changeType: "integration",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        branchPlan: {
          branchGroup: "integration",
          workBranch: "wip/integration/final-wiring",
          baseBranch: "main",
          executionMode: "integration_only",
        },
      },
    ],
  } as ImplementationCodeTaskPlanV1;
}

describe.sequential("P3-Runtime-Core-03-5 ensureGithubIntegrationBranch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("1. creates ref when integration branch is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const u = fetchRequestUrl(input);
        if (u.includes(`/git/ref/heads/${encodeURIComponent("main")}`) && !init?.method) {
          return new Response(JSON.stringify({ object: { sha: "base-sha" } }), { status: 200 });
        }
        if (u.includes("/git/ref/heads/integration/") && !init?.method) {
          return new Response("Not Found", { status: 404 });
        }
        if (u.endsWith("/git/refs") && init?.method === "POST") {
          return new Response(JSON.stringify({ ref: `refs/heads/${BRANCH}` }), { status: 201 });
        }
        return new Response("unexpected", { status: 500 });
      }),
    );

    const result = await ensureGithubIntegrationBranch({
      repoUrl: REPO,
      baseBranch: "main",
      projectId: PID,
      githubToken: TOKEN,
      integrationBranch: BRANCH,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("created");
    expect(result.integrationBranch).toBe(BRANCH);
    expect(result.baseCommitSha).toBe("base-sha");
  });

  it("2. returns already_exists when GET finds integration branch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        if (fetchRequestUrl(url).includes("/git/ref/heads/integration/")) {
          return new Response(JSON.stringify({ object: { sha: "existing-head" } }), { status: 200 });
        }
        return new Response("unexpected", { status: 500 });
      }),
    );

    const result = await ensureGithubIntegrationBranch({
      repoUrl: REPO,
      baseBranch: "main",
      projectId: PID,
      githubToken: TOKEN,
      integrationBranch: BRANCH,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("already_exists");
    expect(result.baseCommitSha).toBe("existing-head");
  });

  it("3. maps create ref 422 Reference already exists to already_exists", async () => {
    let integrationRefGets = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const u = fetchRequestUrl(input);
        if (u.includes("/git/ref/heads/integration/") && !init?.method) {
          integrationRefGets += 1;
          if (integrationRefGets === 1) {
            return new Response("Not Found", { status: 404 });
          }
          return new Response(JSON.stringify({ object: { sha: "race-head" } }), { status: 200 });
        }
        if (u.includes("/git/ref/heads/main")) {
          return new Response(JSON.stringify({ object: { sha: "base-sha" } }), { status: 200 });
        }
        if (u.endsWith("/git/refs") && init?.method === "POST") {
          return new Response(
            JSON.stringify({ message: "Reference already exists", status: "422" }),
            { status: 422 },
          );
        }
        return new Response("unexpected", { status: 500 });
      }),
    );

    const result = await ensureGithubIntegrationBranch({
      repoUrl: REPO,
      baseBranch: "main",
      projectId: PID,
      githubToken: TOKEN,
      integrationBranch: BRANCH,
    });
    expect(result.status).toBe("already_exists");
    expect(result.baseCommitSha).toBe("race-head");
  });

  it("4. user-safe messages omit raw 422 JSON", () => {
    const msg = toUserSafeIntegrationErrorMessage(
      new Error(
        'integration branch 생성 실패 HTTP 422: {"message":"Reference already exists","status":"422"}',
      ),
    );
    expect(msg).toBe(INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE);
    expect(msg).not.toContain("422");
    expect(msg).not.toContain("Reference already exists");
  });
});

describe("P3-Runtime-Core-03-5 pipeline wiring", () => {
  it("5–7. implementation pipeline uses ensureGithubIntegrationBranch and continues on reuse", () => {
    const src = readFileSync(join(prototypeDir, "implementationIntegrationPipelineService.ts"), "utf8");
    expect(src).toContain("await ensureGithubIntegrationBranch");
    expect(src).not.toContain("await createGithubIntegrationBranch");
    expect(src).toContain('branchEnsure.status === "already_exists"');
    expect(src).toContain("implementation_integration_branch_reused");
    expect(src).not.toMatch(/final_wiring_failed[\s\S]{0,80}branchEnsure/);
    expect(src).toContain("INTEGRATION_BRANCH_REUSE_USER_MESSAGE");
  });

  it("8. merge treats already_integrated as success path", () => {
    const pipelineSrc = readFileSync(
      join(prototypeDir, "implementationIntegrationPipelineService.ts"),
      "utf8",
    );
    expect(pipelineSrc).toContain('"already_integrated"');
    expect(pipelineSrc).toContain("implementation_codetask_branch_already_integrated");
  });
});

describe.sequential("P3-Runtime-Core-03-5 merge idempotency", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("8b. mergeWorkBranchIntoIntegrationBranch returns already_integrated when merge is up to date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "Already up-to-date" }), { status: 409 }),
      ),
    );
    const result = await mergeWorkBranchIntoIntegrationBranch({
      repoUrl: REPO,
      integrationBranch: BRANCH,
      workBranch: "wip/screen/workspace",
      codeTaskId: "CODE-1",
      commitSha: "abc",
      githubToken: TOKEN,
    });
    expect(result.status).toBe("already_integrated");
  });
});

describe("P3-Runtime-Core-03-5 state recovery", () => {
  const NOW = "2026-06-09T01:00:00.000Z";

  function branchOnlyPlan(): CodeTaskIntegrationPlanV1 {
    return {
      version: "code_task_integration_plan_v1",
      projectId: PID,
      targetRepository: REPO,
      baseBranch: "main",
      integrationBranch: BRANCH,
      createdAt: NOW,
      status: "integrating",
      strategy: "merge",
      included: [
        {
          runId: "r1",
          processTaskId: "DEV-1",
          codeTaskId: "CODE-1",
          title: "T",
          workBranch: "wip/screen/workspace",
          commitSha: "abc",
          order: 1,
        },
      ],
      excluded: [],
    };
  }

  it("9. branch evidence recovers integration_branch step only", () => {
    const plan = branchOnlyPlan();
    expect(integrationPlanHasExistingBranchResumeEvidence(plan)).toBe(true);
    expect(integrationPlanHasSuccessfulMerge(plan)).toBe(true);
    const steps = buildDefaultIntegrationStepsFromBranchPlan({
      codeTaskPlan: integrationCodeTaskPlan(),
    });
    const recovery = recoverCompletedIntegrationStepsFromPlan({
      projectId: PID,
      steps,
      plan,
      nowIso: NOW,
    });
    expect(recovery.recovered).toBe(true);
    expect(recovery.recoveredKinds).toContain("integration_branch");
    expect(recovery.recoveredKinds).toContain("final_wiring");
  });

  it("11. branch-only draft without merge evidence does not mark build completed", () => {
    const plan: CodeTaskIntegrationPlanV1 = {
      ...branchOnlyPlan(),
      status: "branch_creating",
      mergeResults: [],
    };
    expect(integrationPlanHasExistingBranchResumeEvidence(plan)).toBe(true);
    expect(integrationPlanHasSuccessfulMerge(plan)).toBe(false);
    const steps = buildDefaultIntegrationStepsFromBranchPlan({
      codeTaskPlan: integrationCodeTaskPlan(),
    });
    const recovery = recoverCompletedIntegrationStepsFromPlan({
      projectId: PID,
      steps,
      plan,
      nowIso: NOW,
    });
    expect(recovery.recoveredKinds).toContain("integration_branch");
    expect(recovery.recoveredKinds).not.toContain("final_wiring");
    const build = recovery.steps.find((s) => s.kind === "build");
    expect(build?.status).not.toBe("completed");
  });
});

describe("P3-Runtime-Core-03-5 user-safe UI", () => {
  it("12–13. reuse user message and timeline labels", () => {
    expect(INTEGRATION_BRANCH_REUSE_USER_MESSAGE).toContain("기존 통합 branch");
    const entry = buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_branch_reused",
      orchestrationTraceGroup: "implementation_integration",
      fields: { projectId: PID },
      nowIso: "2026-06-09T01:00:00.000Z",
    });
    expect(formatExecutionLogTimelineLabel(entry)).toContain("재사용");
  });
});

describe("P3-Runtime-Core-03-5 regression", () => {
  it("14–15. source branch resolver unchanged", () => {
    const src = readFileSync(join(prototypeDir, "integrationEffectiveSourceBranch.ts"), "utf8");
    expect(src).toContain("contextSourceBranch");
    expect(src).toContain("source_branch_is_target_branch");
    expect(src).toContain("wip/integration/");
  });

  it("branch name validation requires integration/ project slug", () => {
    expect(isValidProjectIntegrationBranchName(BRANCH, PID)).toBe(true);
    expect(isValidProjectIntegrationBranchName("wip/integration/final-wiring", PID)).toBe(false);
  });
});
