/**
 * GitChangeRequest 기반 Cursor 실행 계층.
 * 우선순위: SafeMode 스텁 → ENABLE_CURSOR_EXECUTION+CLI → 웹훅 → 스텁
 */

import type {
  CursorExecutionPayload,
  CursorExecutionReceivedHints,
  CursorFileChange,
} from "@/lib/integration/cursorExecutionTypes";
import {
  CURSOR_EXEC_ERROR_CODES,
  runCursorCliExecution,
} from "@/lib/integration/cursorExecutor";
import { isExecutionSafeMode } from "@/lib/production/safeMode";

/** commitMessage에 포함 시 스텁 실행을 실패로 처리 (테스트/데모용) */
export const CURSOR_SIMULATE_FAIL_KEYWORD = "[FAIL]";

export type CursorIntegrationMode = "stub" | "webhook" | "cli";

export type CursorIntegrationDetail = {
  mode: CursorIntegrationMode;
  webhookStatus?: number;
  webhookUrlHost?: string;
  received?: CursorExecutionReceivedHints;
  error?: string;
  cliCode?: string;
};

export type CursorExecutionResult = {
  success: boolean;
  updatedFiles: CursorFileChange[];
  logs: string[];
  commitMessage?: string | null;
  error: string | null;
  rawOutput?: string;
  /** CURSOR_EXEC_ERROR_CODES 등 */
  code?: string;
  detail?: CursorIntegrationDetail;
};

export function extractGcrFilePaths(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  const paths: string[] = [];
  for (const item of files) {
    if (item && typeof item === "object" && "path" in item) {
      const p = (item as { path: unknown }).path;
      if (typeof p === "string" && p.trim()) paths.push(p.trim());
    }
  }
  return paths;
}

function pathsToChanges(paths: string[]): CursorFileChange[] {
  return paths.map((p) => ({ path: p, changeType: "MODIFY" as const }));
}

function hintsFilesToChanges(hints?: CursorExecutionReceivedHints): CursorFileChange[] {
  if (!hints?.updatedFiles?.length) return [];
  return hints.updatedFiles.filter(Boolean).map((p) => ({
    path: p.trim(),
    changeType: "MODIFY" as const,
  }));
}

function parseWebhookJsonHints(text: string): CursorExecutionReceivedHints | undefined {
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== "object") return undefined;
    const o = v as Record<string, unknown>;
    const hints: CursorExecutionReceivedHints = {};
    if (Array.isArray(o.updatedFiles)) {
      hints.updatedFiles = o.updatedFiles.filter((x) => typeof x === "string") as string[];
    }
    if (typeof o.commitSha === "string") hints.commitSha = o.commitSha;
    if (typeof o.prUrl === "string") hints.prUrl = o.prUrl;
    if (typeof o.branchPushed === "string") hints.branchPushed = o.branchPushed;
    if (typeof o.notes === "string") hints.notes = o.notes;
    return Object.keys(hints).length ? hints : undefined;
  } catch {
    return undefined;
  }
}

function isEnvTruthy(raw: string | undefined): boolean {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function postCursorWebhook(
  payload: CursorExecutionPayload
): Promise<{ ok: boolean; status: number; bodyText: string; host?: string }> {
  const url = process.env.CURSOR_INTEGRATION_WEBHOOK_URL?.trim();
  if (!url) {
    return { ok: false, status: 0, bodyText: "" };
  }
  let host: string | undefined;
  try {
    host = new URL(url).host;
  } catch {
    host = undefined;
  }

  const token = process.env.CURSOR_INTEGRATION_TOKEN?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "JYOrchestration-cursor-integration/1",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const timeoutMs = Math.min(
    Math.max(Number(process.env.CURSOR_INTEGRATION_TIMEOUT_MS ?? 120000) || 120000, 5000),
    300000
  );

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const bodyText = await res.text();
  return { ok: res.ok, status: res.status, bodyText, host };
}

function mapCliToExecutionResult(
  cli: Awaited<ReturnType<typeof runCursorCliExecution>>
): CursorExecutionResult {
  return {
    success: cli.success,
    updatedFiles: cli.updatedFiles,
    logs: cli.logs,
    commitMessage: cli.commitMessage ?? null,
    error: cli.error,
    rawOutput: cli.rawOutput,
    code: cli.code,
    detail: {
      mode: "cli",
      cliCode: cli.code,
      error: cli.error ?? undefined,
    },
  };
}

/**
 * 표준 CursorExecutionPayload 기준 실행.
 */
export async function executeCursorForGitChangeRequest(
  payload: CursorExecutionPayload,
  options?: {
    simulateFailure?: boolean;
    commitMessageForKeyword?: string | null;
    gcrFiles?: unknown;
  }
): Promise<CursorExecutionResult> {
  const pathList =
    payload.context?.files && payload.context.files.length > 0
      ? payload.context.files
      : extractGcrFilePaths(options?.gcrFiles);
  const baseFiles = pathsToChanges(pathList);

  const logs: string[] = [
    `[PAYLOAD] taskId=${payload.taskId} taskPromptId=${payload.taskPromptId} projectId=${payload.projectId}`,
    `[PAYLOAD] branchName=${payload.branchName} promptChars=${payload.prompt.length}`,
  ];

  const failByKeyword = (options?.commitMessageForKeyword ?? "").includes(
    CURSOR_SIMULATE_FAIL_KEYWORD
  );
  const failByFlag = options?.simulateFailure === true;
  if (failByFlag || failByKeyword) {
    const reason = failByFlag
      ? "simulateFailure 옵션이 true입니다."
      : `commitMessage에 '${CURSOR_SIMULATE_FAIL_KEYWORD}' 가 포함되어 있습니다.`;
    logs.push(`[SIMULATED_FAILURE] ${reason}`, `[CURSOR_EXECUTION_FAILED]`);
    return {
      success: false,
      updatedFiles: [],
      logs,
      commitMessage: null,
      error: "Simulated cursor execution failure",
      detail: { mode: "stub", error: reason },
    };
  }

  if (isExecutionSafeMode()) {
    logs.push(
      "[CURSOR_SAFE_MODE] JY_SAFE_MODE 활성: Cursor CLI·웹훅을 호출하지 않습니다(드라이 런).",
      "[CURSOR_EXECUTION_DONE]"
    );
    return {
      success: true,
      updatedFiles: baseFiles,
      logs,
      commitMessage: payload.context?.commitMessage ?? null,
      error: null,
      detail: { mode: "stub" },
    };
  }

  const enableCli = isEnvTruthy(process.env.ENABLE_CURSOR_EXECUTION);
  const execMode = (process.env.CURSOR_EXEC_MODE ?? "cli").trim().toLowerCase();

  if (enableCli && execMode === "cli") {
    const cli = await runCursorCliExecution(payload);
    const mapped = mapCliToExecutionResult(cli);
    mapped.logs = [...logs, ...mapped.logs];
    if (mapped.success) {
      mapped.logs.push("[CURSOR_EXECUTION_DONE]");
    } else {
      mapped.logs.push("[CURSOR_EXECUTION_FAILED]");
    }
    return mapped;
  }

  if (enableCli && execMode !== "cli") {
    logs.push(
      `[CURSOR_CLI] CURSOR_EXEC_MODE=${execMode} 는 미지원입니다. cli만 지원합니다. 웹훅/스텁으로 폴백합니다.`
    );
  }

  if (!enableCli) {
    logs.push(
      "[CURSOR] ENABLE_CURSOR_EXECUTION이 true가 아니어서 Cursor CLI는 실행하지 않았습니다.",
      "실제 CLI를 쓰려면 ENABLE_CURSOR_EXECUTION=true, CURSOR_CLI_PATH, CURSOR_WORKDIR 등을 설정하세요."
    );
  }

  const webhookUrl = process.env.CURSOR_INTEGRATION_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    try {
      const r = await postCursorWebhook(payload);
      logs.push(
        `[WEBHOOK] host=${r.host ?? "?"} status=${r.status} ok=${r.ok}`,
        `[WEBHOOK] bodyPreview=${r.bodyText.slice(0, 500)}${r.bodyText.length > 500 ? "…" : ""}`
      );
      const hints = parseWebhookJsonHints(r.bodyText);
      if (!r.ok) {
        logs.push("[CURSOR_EXECUTION_FAILED]");
        return {
          success: false,
          updatedFiles: [],
          logs,
          commitMessage: null,
          error: `Cursor 웹훅 실패 HTTP ${r.status}`,
          rawOutput: r.bodyText.slice(0, 4000),
          detail: {
            mode: "webhook",
            webhookStatus: r.status,
            webhookUrlHost: r.host,
            received: hints,
            error: r.bodyText.slice(0, 400),
          },
        };
      }
      const hintChanges = hintsFilesToChanges(hints);
      const mergedFiles =
        hintChanges.length > 0 ? hintChanges : baseFiles;
      logs.push("[CURSOR_EXECUTION_DONE]");
      return {
        success: true,
        updatedFiles: mergedFiles.length ? mergedFiles : baseFiles,
        logs,
        commitMessage: payload.context?.commitMessage ?? null,
        error: null,
        detail: {
          mode: "webhook",
          webhookStatus: r.status,
          webhookUrlHost: r.host,
          received: hints,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logs.push(`[WEBHOOK][ERROR] ${msg}`, "[CURSOR_EXECUTION_FAILED]");
      return {
        success: false,
        updatedFiles: [],
        logs,
        commitMessage: null,
        error: msg,
        detail: { mode: "webhook", error: msg },
      };
    }
  }

  logs.push(
    "[STUB] 웹훅·CLI 미사용 — 외부 Cursor 프로세스 미호출",
    `[STUB] 표준 페이로드(JSON)는 applyLog에 기록됩니다.`,
    "[CURSOR_EXECUTION_DONE]"
  );

  return {
    success: true,
    updatedFiles: baseFiles,
    logs,
    commitMessage: payload.context?.commitMessage ?? null,
    error: null,
    detail: { mode: "stub" },
  };
}

function structuredResultLine(result: CursorExecutionResult): string {
  try {
    return `[CURSOR_RESULT_JSON] ${JSON.stringify({
      success: result.success,
      updatedFiles: result.updatedFiles,
      code: result.code ?? null,
      detail: result.detail ?? null,
    })}`;
  } catch {
    return "[CURSOR_RESULT_JSON] {}";
  }
}

const RAW_PREVIEW_MAX = 2500;

/** applyLog에 기록할 성공 블록 (planned Git 플로우 + 실행 결과) */
export function formatCursorApplyLogSuccess(
  plannedGitFlowSection: string,
  payloadJson: string,
  result: CursorExecutionResult
): string {
  const lines = [
    "[mode: cursor]",
    plannedGitFlowSection,
    "[CURSOR_PAYLOAD_JSON]",
    payloadJson,
    "[CURSOR_EXECUTION_START]",
    ...result.logs,
    structuredResultLine(result),
    `[CURSOR] updatedFiles: ${JSON.stringify(result.updatedFiles)}`,
  ];
  if (result.commitMessage?.trim()) {
    lines.push(`[CURSOR] commitMessage: ${result.commitMessage.trim()}`);
  }
  if (result.rawOutput?.trim()) {
    const raw = result.rawOutput.trim();
    lines.push(
      `[CURSOR_RAW_OUTPUT_PREVIEW]`,
      raw.length > RAW_PREVIEW_MAX ? `${raw.slice(0, RAW_PREVIEW_MAX)}\n…` : raw
    );
  }
  lines.push("[CURSOR_EXECUTION_DONE]", "[END]");
  return lines.join("\n");
}

/** applyLog에 기록할 실패 블록 */
export function formatCursorApplyLogFailure(
  plannedGitFlowSection: string,
  payloadJson: string,
  result: CursorExecutionResult
): string {
  const errLine = result.error?.trim() || "Cursor 실행에 실패했습니다.";
  const codeLine = result.code ? `code: ${result.code}` : "";
  const lines = [
    "[mode: cursor]",
    plannedGitFlowSection,
    "[CURSOR_PAYLOAD_JSON]",
    payloadJson,
    "[CURSOR_EXECUTION_FAILED]",
    `error: ${errLine}`,
    ...(codeLine ? [codeLine] : []),
    ...result.logs,
    structuredResultLine(result),
    `[CURSOR] updatedFiles: ${JSON.stringify(result.updatedFiles)}`,
  ];
  if (result.rawOutput?.trim()) {
    const raw = result.rawOutput.trim();
    lines.push(
      `[CURSOR_RAW_OUTPUT_PREVIEW]`,
      raw.length > RAW_PREVIEW_MAX ? `${raw.slice(0, RAW_PREVIEW_MAX)}\n…` : raw
    );
  }
  if (result.code === CURSOR_EXEC_ERROR_CODES.CURSOR_CLI_NOT_FOUND) {
    lines.push(
      "[CURSOR_HINT] CURSOR_CLI_PATH 에 Cursor 실행 파일의 절대 경로를 설정했는지 확인하세요."
    );
  }
  lines.push("[END]");
  return lines.join("\n");
}
