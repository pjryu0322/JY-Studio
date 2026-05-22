/**
 * Analyze an existing GitHub repository structure (read-only).
 */

import { githubApiFetch } from "@/lib/git-provisioning/githubApiClient";
import type { GithubRepoAnalysisSummary } from "@/lib/git-provisioning/githubRepoTypes";
import { lookupGithubRepository } from "@/lib/git-provisioning/githubRepoLookup";

type ContentEntry = { readonly name?: string; readonly type?: string; readonly path?: string };

async function listRootContents(input: {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly token: string;
}): Promise<ContentEntry[]> {
  const path = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents?ref=${encodeURIComponent(input.ref)}`;
  const res = await githubApiFetch(path, input.token, { method: "GET" });
  if (!res.ok) return [];
  const json = await res.json();
  if (!Array.isArray(json)) return [];
  return json as ContentEntry[];
}

async function pathExists(input: {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly token: string;
  readonly path: string;
}): Promise<boolean> {
  const path = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodeURIComponent(input.path)}?ref=${encodeURIComponent(input.ref)}`;
  const res = await githubApiFetch(path, input.token, { method: "GET" });
  return res.ok;
}

function buildAnalysis(input: {
  readonly defaultBranch: string;
  readonly topLevelFiles: string[];
  readonly topLevelDirectories: string[];
  readonly hasPackageJson: boolean;
  readonly hasTsconfig: boolean;
  readonly hasNextConfig: boolean;
  readonly hasPrisma: boolean;
  readonly hasReadme: boolean;
}): GithubRepoAnalysisSummary {
  const detectedStack: string[] = [];
  if (input.hasPackageJson) detectedStack.push("node");
  if (input.hasTsconfig) detectedStack.push("typescript");
  if (input.hasNextConfig) detectedStack.push("nextjs");
  if (input.hasPrisma) detectedStack.push("prisma");

  const fileCount = input.topLevelFiles.length;
  const dirCount = input.topLevelDirectories.length;
  const notes: string[] = [];

  let riskLevel: GithubRepoAnalysisSummary["riskLevel"] = "empty";
  let recommendation: GithubRepoAnalysisSummary["recommendation"] = "create_new_name";

  if (fileCount === 0 && dirCount === 0) {
    riskLevel = "empty";
    recommendation = "connect_existing";
    notes.push("Repository root appears empty or inaccessible.");
  } else if (input.hasReadme && !input.hasPackageJson && dirCount <= 1) {
    riskLevel = "low";
    recommendation = "connect_existing";
    notes.push("Mostly README or minimal scaffold.");
  } else if (input.hasPackageJson) {
    riskLevel = dirCount >= 3 || input.hasPrisma ? "high" : "medium";
    recommendation = riskLevel === "high" ? "manual_review" : "connect_existing";
    notes.push("Existing application source detected.");
  } else {
    riskLevel = "medium";
    recommendation = "analyze_only";
    notes.push("Non-empty repository without package.json.");
  }

  return {
    defaultBranch: input.defaultBranch,
    hasReadme: input.hasReadme,
    hasPackageJson: input.hasPackageJson,
    hasTsconfig: input.hasTsconfig,
    hasNextConfig: input.hasNextConfig,
    hasPrisma: input.hasPrisma,
    topLevelFiles: input.topLevelFiles,
    topLevelDirectories: input.topLevelDirectories,
    detectedStack,
    riskLevel,
    recommendation,
    notes,
  };
}

export async function analyzeGithubRepository(input: {
  readonly owner: string;
  readonly repo: string;
  readonly githubAccessToken: string;
  readonly defaultBranch?: string | null;
}): Promise<{ readonly ok: boolean; readonly summary?: GithubRepoAnalysisSummary; readonly message?: string }> {
  const owner = String(input.owner ?? "").trim();
  const repo = String(input.repo ?? "").trim();
  const token = String(input.githubAccessToken ?? "").trim();
  if (!owner || !repo || !token) {
    return { ok: false, message: "owner, repo, and token are required" };
  }

  const lookup = await lookupGithubRepository({ owner, repo, githubAccessToken: token });
  if (!lookup.exists) {
    return { ok: false, message: lookup.reason === "not_found" ? "Repository not found" : lookup.message };
  }

  const ref = String(input.defaultBranch ?? lookup.repo.defaultBranch ?? "main").trim() || "main";
  try {
    const entries = await listRootContents({ owner, repo, ref, token });
    const topLevelFiles = entries.filter((e) => e.type === "file").map((e) => String(e.name ?? ""));
    const topLevelDirectories = entries.filter((e) => e.type === "dir").map((e) => String(e.name ?? ""));

    const hasReadme =
      topLevelFiles.some((n) => /^readme/i.test(n)) ||
      (await pathExists({ owner, repo, ref, token, path: "README.md" }));
    const hasPackageJson = topLevelFiles.includes("package.json");
    const hasTsconfig = topLevelFiles.includes("tsconfig.json");
    const hasNextConfig =
      topLevelFiles.some((n) => /^next\.config\./i.test(n)) ||
      (await pathExists({ owner, repo, ref, token, path: "next.config.js" }));
    const hasPrisma =
      topLevelDirectories.includes("prisma") ||
      (await pathExists({ owner, repo, ref, token, path: "prisma/schema.prisma" }));

    const summary = buildAnalysis({
      defaultBranch: ref,
      topLevelFiles,
      topLevelDirectories,
      hasReadme,
      hasPackageJson,
      hasTsconfig,
      hasNextConfig,
      hasPrisma,
    });

    return { ok: true, summary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}
