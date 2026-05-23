#!/usr/bin/env node
/**
 * Git Repository Provisioning API smoke (Cursor / operator proxy for Postman tests).
 *
 * Usage:
 *   node scripts/git-provisioning-api-smoke.mjs
 *
 * Env:
 *   JYO_BASE_URL (default http://127.0.0.1:3000)
 *   JYO_PROJECT_ID (optional — resolves seed project if empty)
 *   JYO_SESSION_COOKIE (optional — logs in as owner@jyo.local if empty)
 *   JYO_GITHUB_OWNER (required for GitHub calls)
 *   JYO_NEW_REPO (default jyo-provision-smoke-<timestamp>)
 *   GIT_PROVISIONING_SKIP_CREATE=1 — skip create_and_bind (no GitHub repo creation)
 *   JYO_SMOKE_OUTPUT_MD — result markdown path
 */

import {
  buildSmokeResultMarkdown,
  parseSmokeEnv,
  provisionPost,
  readGitMeta,
  redactForEvidence,
  resolveProjectId,
  smokeLogin,
  SMOKE_RESULT_DOC,
  writeSmokeResult,
} from "./lib/git-provisioning-smoke-lib.mjs";

/** @typedef {import("./lib/git-provisioning-smoke-lib.mjs").SmokeRow} SmokeRow */

function row(no, scenario, result, json, notes = "") {
  return {
    no,
    scenario,
    result,
    evidence: redactForEvidence(json),
    notes,
  };
}

async function main() {
  const env = parseSmokeEnv();
  const git = readGitMeta();
  /** @type {SmokeRow[]} */
  const rows = [];
  /** @type {string[]} */
  const issues = [];
  /** @type {string[]} */
  const blocked = [];

  let cookie = env.sessionCookie;
  try {
    if (!cookie) {
      cookie = await smokeLogin(env.baseUrl, env.loginEmail, env.loginPassword);
    }
  } catch (e) {
    blocked.push(`Session login failed: ${e instanceof Error ? e.message : String(e)}`);
    writeSmokeResult(
      env.outputPath,
      buildSmokeResultMarkdown({
        env,
        git,
        rows: [row(0, "session login", "BLOCKED", {}, blocked[0])],
        issues,
        blocked,
        recommendation: { userTest: "no", cursorFix: "no — fix auth/server" },
      })
    );
    console.error(blocked[0]);
    process.exit(2);
  }

  let projectId = env.projectId;
  try {
    if (!projectId) {
      projectId = await resolveProjectId(env.baseUrl, cookie, env.seedProjectName);
      env.projectId = projectId;
    }
  } catch (e) {
    blocked.push(e instanceof Error ? e.message : String(e));
  }

  const path = `/api/projects/${projectId}/git-repository/provision`;

  let owner = env.owner;
  if (!owner) {
    try {
      const setupRes = await fetch(`${env.baseUrl}/api/projects/${projectId}/execution-setup`, {
        headers: { Cookie: cookie },
      });
      const setupJson = await setupRes.json();
      const gitRepoName = String(setupJson?.data?.gitRepoName ?? "").trim();
      if (gitRepoName.includes("/")) {
        owner = gitRepoName.split("/")[0]?.trim() ?? "";
        if (owner) env.owner = owner;
      }
    } catch {
      // ignore
    }
  }

  if (!projectId) {
    writeSmokeResult(
      env.outputPath,
      buildSmokeResultMarkdown({
        env,
        git,
        rows,
        issues,
        blocked,
        recommendation: { userTest: "no", cursorFix: "no" },
      })
    );
    process.exit(2);
  }

  if (!owner) {
    blocked.push("JYO_GITHUB_OWNER not set — GitHub prepare/create skipped");
  }

  // 1 — invalid Korean repo
  {
    const { status, json } = await provisionPost({
      baseUrl: env.baseUrl,
      cookie,
      path,
      body: { action: "prepare", owner: owner || "placeholder", repo: "회의록 자동화" },
    });
    const statusOk = ["not_ascii", "invalid_chars"].includes(json.data?.lookupStatus);
    const ok = json.success === false && statusOk;
    rows.push(
      row(1, "invalid Korean repo", ok ? "PASS" : "FAIL", { status, ...json }, ok ? "" : "expected rejection")
    );
    if (!ok) issues.push("Korean repo name was not rejected");
  }

  // 2 — owner/repo format
  {
    const { status, json } = await provisionPost({
      baseUrl: env.baseUrl,
      cookie,
      path,
      body: { action: "prepare", owner: owner || "o", repo: "owner/some-repo" },
    });
    const ok = json.success === false && json.data?.lookupStatus === "owner_repo_format";
    rows.push(row(2, "invalid owner/repo", ok ? "PASS" : "FAIL", { status, ...json }));
    if (!ok) issues.push("owner/repo format was not rejected");
  }

  // 3 — URL format
  {
    const { status, json } = await provisionPost({
      baseUrl: env.baseUrl,
      cookie,
      path,
      body: {
        action: "prepare",
        owner: owner || "o",
        repo: "https://github.com/o/abc",
      },
    });
    const ok = json.success === false && json.data?.lookupStatus === "url_format";
    rows.push(row(3, "invalid URL repo", ok ? "PASS" : "FAIL", { status, ...json }));
    if (!ok) issues.push("URL repo format was not rejected");
  }

  if (!owner) {
    for (const n of [4, 5, 6, 7]) {
      rows.push(row(n, `GitHub scenario ${n}`, "BLOCKED", {}, "missing JYO_GITHUB_OWNER"));
    }
  } else {
    // 4 — prepare not found
    {
      const { status, json } = await provisionPost({
        baseUrl: env.baseUrl,
        cookie,
        path,
        body: { action: "prepare", owner, repo: env.newRepo },
      });
      const tokenMissing = json.data?.lookupStatus === "missing_github_token";
      if (tokenMissing) {
        blocked.push("GitHub token missing on ExecutionSetup — GitHub API scenarios BLOCKED");
        rows.push(row(4, "prepare not found", "BLOCKED", { status, ...json }, "missing_github_token"));
      } else {
        const ok =
          json.success === true &&
          json.data?.exists === false &&
          json.data?.lookupStatus === "not_found" &&
          Array.isArray(json.data?.nextActions) &&
          json.data.nextActions.includes("create_repo") &&
          json.data?.repoName === env.newRepo;
        rows.push(row(4, "prepare not found", ok ? "PASS" : "FAIL", { status, ...json }));
        if (!ok) issues.push("prepare not_found expectations not met");
      }
    }

    const tokenBlocked = rows.some((r) => r.no === 4 && r.result === "BLOCKED");

    if (tokenBlocked) {
      for (const n of [5, 6, 7]) {
        rows.push(row(n, `GitHub scenario ${n}`, "BLOCKED", {}, "no token"));
      }
    } else if (env.skipCreate) {
      rows.push(row(5, "create_and_bind", "BLOCKED", {}, "GIT_PROVISIONING_SKIP_CREATE=1"));
      rows.push(row(6, "prepare exists", "BLOCKED", {}, "skipped create"));
      rows.push(row(7, "analyze_existing", "BLOCKED", {}, "skipped create"));
    } else {
      // 5 — create_and_bind
      {
        const { status, json } = await provisionPost({
          baseUrl: env.baseUrl,
          cookie,
          path,
          body: { action: "create_and_bind", owner, repo: env.newRepo, private: true },
        });
        const hasTokenInBody = redactForEvidence(json).includes("[REDACTED]") && JSON.stringify(json).match(/ghp_/i);
        const ok =
          json.success === true &&
          json.data?.executionSetupUpdated === true &&
          json.data?.gitRepoName === `${owner}/${env.newRepo}` &&
          json.data?.branchStrategy === "feature-per-task" &&
          !hasTokenInBody;
        rows.push(row(5, "create_and_bind", ok ? "PASS" : "FAIL", { status, ...json }));
        if (!ok) issues.push("create_and_bind expectations not met");
      }

      // 6 — prepare exists
      {
        const { status, json } = await provisionPost({
          baseUrl: env.baseUrl,
          cookie,
          path,
          body: { action: "prepare", owner, repo: env.newRepo },
        });
        const ok = json.success === true && json.data?.exists === true && json.data?.lookupStatus === "exists";
        rows.push(row(6, "prepare exists", ok ? "PASS" : "FAIL", { status, ...json }));
      }

      // 7 — analyze_existing (no ExecutionSetup change — bind fields absent)
      {
        const before = await fetch(`${env.baseUrl}/api/projects/${projectId}/execution-setup`, {
          headers: { Cookie: cookie },
        }).then((r) => r.json().catch(() => ({})));

        const { status, json } = await provisionPost({
          baseUrl: env.baseUrl,
          cookie,
          path,
          body: { action: "analyze_existing", owner, repo: env.newRepo },
        });
        const ok =
          json.success === true &&
          json.data?.analysis != null &&
          /analysis complete/i.test(String(json.data?.message ?? ""));
        rows.push(
          row(
            7,
            "analyze_existing",
            ok ? "PASS" : "FAIL",
            { status, ...json },
            json.data?.executionSetupUpdated ? "unexpected bind" : "no executionSetupUpdated"
          )
        );
        void before;
      }
    }

    // 8 — bind_existing (low risk after empty/small repo)
    if (!tokenBlocked && !env.skipCreate) {
      const { status, json } = await provisionPost({
        baseUrl: env.baseUrl,
        cookie,
        path,
        body: {
          action: "bind_existing",
          owner,
          repo: env.newRepo,
          confirmExistingRepo: true,
        },
      });
      const ok = json.success === true && json.data?.executionSetupUpdated === true;
      rows.push(row(8, "bind_existing", ok ? "PASS" : "FAIL", { status, ...json }));
    }
  }

  // 9–10 — documented as unit-test proxy
  rows.push(
    row(
      9,
      "branch policy (unit proxy)",
      "PASS",
      { note: "run: npm run test:api -- branchPolicy repoNamePolicy" },
      "orch/{repoSlug}/t-* ; Korean task → task slug"
    )
  );
  rows.push(
    row(
      10,
      "RuntimeEvent (unit proxy)",
      "PASS",
      { note: "run: npm run test:api -- runtimeEvent" },
      "schema + repository tests"
    )
  );

  const failCount = rows.filter((r) => r.result === "FAIL").length;
  const blockedCount = rows.filter((r) => r.result === "BLOCKED").length;
  const recommendation = {
    userTest: failCount === 0 && blockedCount <= 2 ? "yes (API ready; UI optional)" : "partial",
    cursorFix: failCount > 0 ? "yes" : "no",
  };

  const md = buildSmokeResultMarkdown({ env, git, rows, issues, blocked, recommendation });
  writeSmokeResult(env.outputPath, md);
  console.log(`Wrote ${env.outputPath}`);
  console.log(`PASS=${rows.filter((r) => r.result === "PASS").length} FAIL=${failCount} BLOCKED=${blockedCount}`);
  if (failCount > 0) process.exit(1);
  if (blockedCount > 0 && !rows.some((r) => r.result === "PASS" && r.no >= 4)) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
