import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

const repoRoot = resolve(process.cwd(), "..", "..");
const projectRoot = "projects/chunk-studio";
const remoteVerificationPath = resolve(
  repoRoot,
  projectRoot,
  "docs/automation/remote-verification.json",
);

const verifiedFiles = [
  "projects/chunk-studio/src/components/workspace/useWorkspaceState.ts",
  "projects/chunk-studio/src/components/workspace/PageAnalyzerPanel.tsx",
  "projects/chunk-studio/src/components/workspace/ChunkOverlayCanvas.tsx",
  "projects/chunk-studio/src/components/workspace/ChunkInspector.tsx",
  "projects/chunk-studio/src/components/workspace/WorkspacePdfPane.tsx",
  "projects/chunk-studio/src/components/workspace/PdfSemanticChunkEditor.tsx",
];

function run(command, cwd = repoRoot) {
  return execSync(command, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
}

function runExitCode(command, cwd = resolve(repoRoot, projectRoot)) {
  try {
    execSync(command, { cwd, stdio: "pipe", encoding: "utf8" });
    return "success";
  } catch {
    return "failed";
  }
}

function getBlobSha(path) {
  const treeLine = run(`git ls-tree HEAD -- "${path}"`);
  if (!treeLine) return "";
  const parts = treeLine.split(/\s+/);
  return parts.length >= 3 ? parts[2] : "";
}

const headCommit = run("git rev-parse HEAD");
const remoteUrl = run("git remote get-url origin");
const branch = run("git branch --show-current");
const branchTracking = run(
  "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
);
const workingTreeClean = run("git status --porcelain") === "";

const lintResult = runExitCode("npm run lint");
const buildResult = runExitCode("npm run build");

const fileEntries = verifiedFiles.map((path) => {
  const content = run(`git show HEAD:${path}`);
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  const lineCount = normalized.split("\n").length - 1;
  const sha256 = createHash("sha256")
    .update(normalized, "utf8")
    .digest("hex");
  const sizeBytes = Buffer.byteLength(normalized, "utf8");
  return {
    path,
    gitShowLineCount: lineCount,
    gitBlobSha: getBlobSha(path),
    sha256,
    sizeBytes,
    encoding: "utf-8",
  };
});

const output = {
  verificationMeta: {
    repository: "https://github.com/pjryu0322/JY-Studio",
    projectRoot,
    branch,
    commit: headCommit,
    generatedAtUTC: new Date().toISOString(),
    generatedBy: "cursor-verification-script",
  },
  gitState: {
    headCommit,
    remote: "origin",
    remoteUrl,
    workingTreeClean,
    branchTracking,
  },
  buildStatus: {
    lint: {
      command: "npm run lint",
      result: lintResult,
    },
    build: {
      command: "npm run build",
      result: buildResult,
    },
  },
  verifiedFiles: fileEntries,
  verificationRules: {
    expectedSourceFormat: "multiline-typescript",
    minExpectedLines: 50,
    allowMinified: false,
    allowSingleLine: false,
  },
};

mkdirSync(dirname(remoteVerificationPath), { recursive: true });
writeFileSync(
  remoteVerificationPath,
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(remoteVerificationPath);
