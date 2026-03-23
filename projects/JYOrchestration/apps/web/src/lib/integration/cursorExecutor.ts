/**
 * Cursor CLI 실행 (서버 측). 토큰/CLI 경로는 env만 사용.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import type {
  CursorExecutionPayload,
  CursorFileChange,
  CursorFileChangeType,
} from "@/lib/integration/cursorExecutionTypes";
import { writeCursorPayloadToFile } from "@/lib/integration/cursorPayloadStore";

const execFileAsync = promisify(execFile);

export const CURSOR_EXEC_ERROR_CODES = {
  CURSOR_NOT_ENABLED: "CURSOR_NOT_ENABLED",
  CURSOR_CLI_NOT_FOUND: "CURSOR_CLI_NOT_FOUND",
  CURSOR_EXEC_TIMEOUT: "CURSOR_EXEC_TIMEOUT",
  CURSOR_EXEC_FAILED: "CURSOR_EXEC_FAILED",
  CURSOR_RESULT_PARSE_FAILED: "CURSOR_RESULT_PARSE_FAILED",
  CURSOR_PAYLOAD_WRITE_FAILED: "CURSOR_PAYLOAD_WRITE_FAILED",
} as const;

export type CursorCliExecutionResult = {
  success: boolean;
  updatedFiles: CursorFileChange[];
  logs: string[];
  commitMessage?: string | null;
  error: string | null;
  rawOutput: string;
  code?: string;
};

function parseCliExtraArgs(raw: string | null | undefined): string[] {
  const s = String(raw ?? "").trim();
  if (!s) {
    return [];
  }
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) {
        quote = null;
      } else {
        cur += c;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c as '"' | "'";
      continue;
    }
    if (/\s/.test(c)) {
      if (cur.length) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur.length) {
    out.push(cur);
  }
  return out;
}

function normalizeChangeType(raw: unknown): CursorFileChangeType {
  const u = String(raw ?? "MODIFY").toUpperCase();
  if (u === "CREATE" || u === "DELETE") {
    return u;
  }
  return "MODIFY";
}

function normalizeUpdatedFilesFromJson(raw: unknown): CursorFileChange[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: CursorFileChange[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push({ path: item.trim(), changeType: "MODIFY" });
    } else if (item && typeof item === "object" && "path" in item) {
      const o = item as Record<string, unknown>;
      const p = String(o.path ?? "").trim();
      if (!p) {
        continue;
      }
      out.push({ path: p, changeType: normalizeChangeType(o.changeType) });
    }
  }
  return out;
}

/**
 * stdout에서 JSON 한 덩어리를 파싱해 구조화 결과로 병합한다.
 */
export function parseCursorCliJsonOutput(stdout: string): {
  success?: boolean;
  updatedFiles?: CursorFileChange[];
  commitMessage?: string | null;
  error?: string | null;
} | null {
  const t = stdout.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) {
    return null;
  }
  try {
    const v = JSON.parse(t) as Record<string, unknown>;
    if (!v || typeof v !== "object") {
      return null;
    }
    return {
      success: typeof v.success === "boolean" ? v.success : undefined,
      updatedFiles: normalizeUpdatedFilesFromJson(v.updatedFiles),
      commitMessage:
        typeof v.commitMessage === "string" ? v.commitMessage : undefined,
      error: typeof v.error === "string" ? v.error : null,
    };
  } catch {
    return null;
  }
}

function defaultFilesFromPayload(payload: CursorExecutionPayload): CursorFileChange[] {
  const files = payload.context?.files ?? [];
  return files.filter(Boolean).map((p) => ({
    path: p.trim(),
    changeType: "MODIFY" as const,
  }));
}

/**
 * 페이로드를 파일로 저장한 뒤 CURSOR_CLI_PATH 로 프로세스를 실행한다.
 */
export async function runCursorCliExecution(
  payload: CursorExecutionPayload
): Promise<CursorCliExecutionResult> {
  const logs: string[] = [];

  const cliPath = process.env.CURSOR_CLI_PATH?.trim();
  if (!cliPath) {
    return {
      success: false,
      updatedFiles: [],
      logs: [
        "[CURSOR_CLI] CURSOR_CLI_PATH 가 비어 있습니다.",
        "ENABLE_CURSOR_EXECUTION=true 일 때 실행 파일 전체 경로를 설정하세요.",
      ],
      error: "CURSOR_CLI_PATH 환경 변수가 필요합니다.",
      rawOutput: "",
      code: CURSOR_EXEC_ERROR_CODES.CURSOR_CLI_NOT_FOUND,
    };
  }

  const workdir = process.env.CURSOR_WORKDIR?.trim() || process.cwd();
  const timeoutMs = Math.min(
    Math.max(Number(process.env.CURSOR_EXEC_TIMEOUT_MS ?? 600000) || 600000, 5000),
    3_600_000
  );

  let payloadPath: string;
  try {
    const w = await writeCursorPayloadToFile(payload);
    payloadPath = w.absolutePath;
    logs.push(`[CURSOR_CLI] payloadFile=${payloadPath}`, `[CURSOR_CLI] cwd=${workdir}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`[CURSOR_CLI][PAYLOAD_ERROR] ${msg}`);
    return {
      success: false,
      updatedFiles: [],
      logs,
      error: msg,
      rawOutput: "",
      code: CURSOR_EXEC_ERROR_CODES.CURSOR_PAYLOAD_WRITE_FAILED,
    };
  }

  const extra = parseCliExtraArgs(process.env.CURSOR_CLI_ARGS);
  const args = [...extra, payloadPath];

  logs.push(
    `[CURSOR_CLI] exec=${cliPath}`,
    `[CURSOR_CLI] args=${JSON.stringify(args)}`,
    `[CURSOR_CLI] timeoutMs=${timeoutMs}`
  );

  try {
    const r = await execFileAsync(cliPath, args, {
      cwd: workdir,
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
      windowsHide: true,
      encoding: "utf8",
    });
    const stdout = (r.stdout ?? "").toString();
    const stderr = (r.stderr ?? "").toString();
    const rawOutput = [stdout, stderr].filter(Boolean).join("\n--- stderr ---\n");
    logs.push(
      `[CURSOR_CLI] exitCode=0`,
      `[CURSOR_CLI] stdoutChars=${stdout.length} stderrChars=${stderr.length}`
    );

    const parsed = parseCursorCliJsonOutput(stdout);
    const fallbackFiles = defaultFilesFromPayload(payload);

    if (parsed) {
      if (parsed.success === false) {
        return {
          success: false,
          updatedFiles: parsed.updatedFiles?.length ? parsed.updatedFiles : [],
          logs: [...logs, `[CURSOR_CLI] parsedJson indicates failure`],
          commitMessage: parsed.commitMessage ?? null,
          error: parsed.error?.trim() || "Cursor CLI가 실패를 보고했습니다.",
          rawOutput,
          code: CURSOR_EXEC_ERROR_CODES.CURSOR_EXEC_FAILED,
        };
      }
      const files =
        parsed.updatedFiles && parsed.updatedFiles.length > 0
          ? parsed.updatedFiles
          : fallbackFiles;
      return {
        success: true,
        updatedFiles: files,
        logs,
        commitMessage:
          parsed.commitMessage?.trim() ||
          payload.context?.commitMessage?.trim() ||
          null,
        error: null,
        rawOutput,
      };
    }

    if (stdout.trim().startsWith("{")) {
      logs.push("[CURSOR_CLI] JSON 형태는 있으나 파싱에 실패했습니다.");
      return {
        success: false,
        updatedFiles: fallbackFiles,
        logs,
        error: "CLI stdout JSON 파싱 실패",
        rawOutput,
        code: CURSOR_EXEC_ERROR_CODES.CURSOR_RESULT_PARSE_FAILED,
      };
    }

    return {
      success: true,
      updatedFiles: fallbackFiles,
      logs,
      commitMessage: payload.context?.commitMessage?.trim() || null,
      error: null,
      rawOutput,
    };
  } catch (e: unknown) {
    type ExecFail = Error & {
      killed?: boolean;
      code?: string | number | null;
      stderr?: string | Buffer;
      stdout?: string | Buffer;
    };
    const err = e as ExecFail;
    const msg = e instanceof Error ? e.message : String(e);
    const stderr =
      err.stderr === undefined ? "" : Buffer.isBuffer(err.stderr) ? err.stderr.toString("utf8") : String(err.stderr);
    const stdout =
      err.stdout === undefined ? "" : Buffer.isBuffer(err.stdout) ? err.stdout.toString("utf8") : String(err.stdout);
    const rawOutput = [stdout, stderr].filter(Boolean).join("\n--- stderr ---\n") || msg;

    logs.push(`[CURSOR_CLI][ERROR] ${msg}`);

    if (err.code === "ENOENT") {
      return {
        success: false,
        updatedFiles: [],
        logs: [
          ...logs,
          "실행 파일을 찾을 수 없습니다. CURSOR_CLI_PATH 를 확인하세요.",
        ],
        error: `CLI를 찾을 수 없음: ${cliPath}`,
        rawOutput,
        code: CURSOR_EXEC_ERROR_CODES.CURSOR_CLI_NOT_FOUND,
      };
    }

    if (err.killed || /timeout|TIMED_OUT|ETIMEDOUT/i.test(msg)) {
      return {
        success: false,
        updatedFiles: [],
        logs: [...logs, `타임아웃(${timeoutMs}ms) 초과`],
        error: `Cursor CLI 타임아웃 (${timeoutMs}ms)`,
        rawOutput,
        code: CURSOR_EXEC_ERROR_CODES.CURSOR_EXEC_TIMEOUT,
      };
    }

    const exitCode = typeof err.code === "number" ? err.code : null;
    if (exitCode !== null && exitCode !== 0) {
      logs.push(`[CURSOR_CLI] exitCode=${exitCode}`);
      const parsed = parseCursorCliJsonOutput(stdout);
      return {
        success: false,
        updatedFiles:
          parsed?.updatedFiles?.length ? parsed.updatedFiles : defaultFilesFromPayload(payload),
        logs,
        commitMessage: parsed?.commitMessage ?? null,
        error:
          parsed?.error?.trim() ||
          stderr.trim() ||
          `Cursor CLI 종료 코드 ${exitCode}`,
        rawOutput,
        code: CURSOR_EXEC_ERROR_CODES.CURSOR_EXEC_FAILED,
      };
    }

    return {
      success: false,
      updatedFiles: [],
      logs,
      error: msg,
      rawOutput,
      code: CURSOR_EXEC_ERROR_CODES.CURSOR_EXEC_FAILED,
    };
  }
}
