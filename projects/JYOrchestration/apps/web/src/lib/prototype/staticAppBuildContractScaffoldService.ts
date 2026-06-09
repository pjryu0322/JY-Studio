import { resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { getRepoUtf8FileIfExists, putRepoUtf8File } from "@/lib/prototype/githubRepoUtf8Contents";
import type { StaticAppBuildContractV1 } from "@/lib/prototype/staticAppBuildContractResolver";

const MINIMAL_PACKAGE_JSON = `{
  "scripts": {
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {}
}
`;

const MINIMAL_VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
  },
});
`;

const MINIMAL_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`;

export function mergePackageJsonBuildScript(existingUtf8: string): string {
  try {
    const parsed = JSON.parse(existingUtf8) as Record<string, unknown>;
    const scripts =
      parsed.scripts && typeof parsed.scripts === "object"
        ? { ...(parsed.scripts as Record<string, unknown>) }
        : {};
    if (!String(scripts.build ?? "").trim()) {
      scripts.build = "vite build";
    }
    if (!String(scripts.preview ?? "").trim()) {
      scripts.preview = "vite preview --host 0.0.0.0";
    }
    return JSON.stringify({ ...parsed, scripts }, null, 2) + "\n";
  } catch {
    return MINIMAL_PACKAGE_JSON;
  }
}

export async function ensureStaticAppBuildContractOnIntegrationBranch(input: {
  readonly projectId: string;
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly integrationBranch: string;
  readonly contract: StaticAppBuildContractV1;
  readonly nowIso: string;
}): Promise<{
  readonly ok: boolean;
  readonly changedFiles: readonly string[];
  readonly commitSha: string | null;
  readonly userSafeMessage: string | null;
  readonly errorCode: string | null;
}> {
  void input.nowIso;
  void input.projectId;

  if (input.contract.status === "unsupported_runtime") {
    return {
      ok: false,
      changedFiles: [],
      commitSha: null,
      userSafeMessage: input.contract.userSafeMessage,
      errorCode: "unsupported_runtime",
    };
  }
  if (input.contract.status === "ready") {
    return { ok: true, changedFiles: [], commitSha: null, userSafeMessage: null, errorCode: null };
  }
  if (!input.contract.canAutoScaffold) {
    return {
      ok: false,
      changedFiles: [],
      commitSha: null,
      userSafeMessage: input.contract.userSafeMessage,
      errorCode: input.contract.status,
    };
  }

  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  const token = input.githubToken.trim();
  if (!parsed || !token) {
    return {
      ok: false,
      changedFiles: [],
      commitSha: null,
      userSafeMessage: "정적 Preview 빌드 설정을 준비하지 못했습니다.",
      errorCode: "github_auth_missing",
    };
  }

  const branch = input.integrationBranch.trim();
  const changedFiles: string[] = [];
  let lastCommitSha: string | null = null;

  const pkgExisting = await getRepoUtf8FileIfExists({
    token,
    owner: parsed.owner,
    repo: parsed.repo,
    path: "package.json",
    ref: branch,
  });
  const pkgContent = pkgExisting ? mergePackageJsonBuildScript(pkgExisting.contentUtf8) : MINIMAL_PACKAGE_JSON;
  if (!pkgExisting || pkgContent !== pkgExisting.contentUtf8) {
    const put = await putRepoUtf8File({
      token,
      owner: parsed.owner,
      repo: parsed.repo,
      path: "package.json",
      branch,
      message: "chore(preview): ensure static build package.json",
      contentUtf8: pkgContent,
      sha: pkgExisting?.sha ?? null,
    });
    if (!put.ok) {
      return {
        ok: false,
        changedFiles,
        commitSha: null,
        userSafeMessage: "정적 Preview 빌드 설정을 준비하지 못했습니다.",
        errorCode: "scaffold_package_json_failed",
      };
    }
    changedFiles.push("package.json");
    lastCommitSha = put.commitSha;
  }

  const viteExisting = await getRepoUtf8FileIfExists({
    token,
    owner: parsed.owner,
    repo: parsed.repo,
    path: "vite.config.ts",
    ref: branch,
  });
  if (!viteExisting) {
    const put = await putRepoUtf8File({
      token,
      owner: parsed.owner,
      repo: parsed.repo,
      path: "vite.config.ts",
      branch,
      message: "chore(preview): add vite config for static preview",
      contentUtf8: MINIMAL_VITE_CONFIG,
      sha: null,
    });
    if (!put.ok) {
      return {
        ok: false,
        changedFiles,
        commitSha: lastCommitSha,
        userSafeMessage: "정적 Preview 빌드 설정을 준비하지 못했습니다.",
        errorCode: "scaffold_vite_config_failed",
      };
    }
    changedFiles.push("vite.config.ts");
    lastCommitSha = put.commitSha;
  }

  const tsExisting = await getRepoUtf8FileIfExists({
    token,
    owner: parsed.owner,
    repo: parsed.repo,
    path: "tsconfig.json",
    ref: branch,
  });
  if (!tsExisting) {
    const put = await putRepoUtf8File({
      token,
      owner: parsed.owner,
      repo: parsed.repo,
      path: "tsconfig.json",
      branch,
      message: "chore(preview): add tsconfig for static preview",
      contentUtf8: MINIMAL_TSCONFIG,
      sha: null,
    });
    if (!put.ok) {
      return {
        ok: false,
        changedFiles,
        commitSha: lastCommitSha,
        userSafeMessage: "정적 Preview 빌드 설정을 준비하지 못했습니다.",
        errorCode: "scaffold_tsconfig_failed",
      };
    }
    changedFiles.push("tsconfig.json");
    lastCommitSha = put.commitSha;
  }

  return {
    ok: true,
    changedFiles,
    commitSha: lastCommitSha,
    userSafeMessage: changedFiles.length > 0 ? "정적 Preview를 위한 빌드 설정을 준비하고 있습니다." : null,
    errorCode: null,
  };
}
