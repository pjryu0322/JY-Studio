import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type PythonWorkerRunInput = {
  inputZipPath: string;
  outputDir: string;
  packName: string;
  productVersion: string;
  language?: string;
  /** Absolute or relative path to parse_archive.py; default: repo python-worker/parse_archive.py */
  scriptPath?: string;
  /** Python executable; default: python */
  pythonPath?: string;
  /** Timeout in ms; default 30 minutes */
  timeoutMs?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  /**
   * Admin 사전정리에서 선택한 ZIP 경로. Passed via --options-json as
   * options.adminExcludePaths so the Worker skips them during extract.
   */
  adminExcludePaths?: readonly string[];
  env?: NodeJS.ProcessEnv;
};

export type PythonWorkerRunResult =
  | {
      ok: true;
      exitCode: 0;
      stdout: string;
      stderr: string;
      durationMs: number;
      outputDir: string;
    }
  | {
      ok: false;
      exitCode: number | null;
      stdout: string;
      stderr: string;
      durationMs: number;
      timedOut: boolean;
      errorMessage: string;
    };

function defaultScriptPath(): string {
  // src/lib/python-worker → projects/JYKStore/python-worker/parse_archive.py
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../python-worker/parse_archive.py");
}

function normalizeAdminExcludePaths(paths: readonly string[] | undefined): string[] {
  if (!paths?.length) return [];
  return [
    ...new Set(
      paths
        .map((p) => p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Run Python Worker CLI locally. Does not touch Object Storage or DB.
 *
 * Example:
 *   python parse_archive.py --input <zip> --output <dir> --pack-name ... --product-version ... --language ...
 */
export async function runPythonWorkerCli(
  input: PythonWorkerRunInput,
): Promise<PythonWorkerRunResult> {
  const pythonPath = input.pythonPath?.trim() || process.env.JYKSTORE_PYTHON_BIN?.trim() || "python";
  const scriptPath = input.scriptPath?.trim() || defaultScriptPath();
  const timeoutMs = input.timeoutMs ?? 30 * 60 * 1000;
  const language = input.language?.trim() || "ko";
  const adminExcludePaths = normalizeAdminExcludePaths(input.adminExcludePaths);

  const args = [
    scriptPath,
    "--input",
    input.inputZipPath,
    "--output",
    input.outputDir,
    "--pack-name",
    input.packName,
    "--product-version",
    input.productVersion,
    "--language",
    language,
  ];
  if (input.maxFileBytes != null) {
    args.push("--max-file-bytes", String(input.maxFileBytes));
  }
  if (input.maxTotalBytes != null) {
    args.push("--max-total-bytes", String(input.maxTotalBytes));
  }

  let optionsTempDir: string | null = null;
  if (adminExcludePaths.length > 0) {
    optionsTempDir = mkdtempSync(path.join(tmpdir(), "jyk-worker-opts-"));
    const optionsJsonPath = path.join(optionsTempDir, "options.json");
    writeFileSync(
      optionsJsonPath,
      JSON.stringify({ options: { adminExcludePaths } }, null, 0),
      "utf8",
    );
    args.push("--options-json", optionsJsonPath);
  }

  const started = Date.now();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const finish = (result: PythonWorkerRunResult) => {
      if (optionsTempDir) {
        try {
          rmSync(optionsTempDir, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
      resolve(result);
    };

    const child = spawn(pythonPath, args, {
      env: { ...process.env, ...input.env },
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 5_000).unref?.();
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
      if (stdout.length > 2_000_000) stdout = stdout.slice(-1_000_000);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
      if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000);
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      finish({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        timedOut: false,
        errorMessage: `Failed to start Python Worker: ${err.message}`,
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - started;
      if (timedOut) {
        finish({
          ok: false,
          exitCode: code,
          stdout,
          stderr,
          durationMs,
          timedOut: true,
          errorMessage: `Python Worker timed out after ${timeoutMs}ms`,
        });
        return;
      }
      if (code === 0) {
        finish({
          ok: true,
          exitCode: 0,
          stdout,
          stderr,
          durationMs,
          outputDir: input.outputDir,
        });
        return;
      }
      finish({
        ok: false,
        exitCode: code,
        stdout,
        stderr,
        durationMs,
        timedOut: false,
        errorMessage: `Python Worker exited with code ${code ?? "null"}`,
      });
    });
  });
}
