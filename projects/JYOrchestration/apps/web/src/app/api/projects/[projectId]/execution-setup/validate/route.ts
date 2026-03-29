import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  executionSetupSchemaDriftResponse,
  isExecutionSetupSchemaDriftError,
} from "@/lib/prisma/executionSetupSchemaMismatch";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import {
  cursorValidationApiPhasesOk,
  cursorValidationRepoAccessOk,
  formatCursorApiFailureForStorage,
  formatCursorApiStepSummaryLines,
  formatCursorApiSuccessForStorage,
  runCursorApiValidation,
  type CursorApiValidationStep,
} from "@/lib/executionSetup/cursorApiValidation";
import {
  parseGitHubRepoFullName,
  probeGitBaseBranchReachable,
  probeGitHttpRemote,
} from "@/lib/executionSetup/hardening";

/** 요청 scope. `cursor` 는 이전 클라이언트 호환용(= cursor_execution). */
export type ValidateScope = "repository" | "cursor_api" | "cursor_execution" | "cursor" | "all";

type NormalizedScope = "repository" | "cursor_api" | "cursor_execution" | "all";

function normalizeValidateScope(raw: string | undefined): NormalizedScope {
  if (raw === "repository") return "repository";
  if (raw === "cursor_api") return "cursor_api";
  if (raw === "cursor_execution" || raw === "cursor") return "cursor_execution";
  return "all";
}

function isLikelyUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type Side = "ok" | "needs" | "error";

function validateRepoStructure(row: {
  gitRepoUrl: string;
  baseBranch: string;
  gitRepoProvider: string;
  gitRepoName: string | null;
}): { git: Side; messages: string[] } {
  const messages: string[] = [];
  let git: Side = "ok";

  if (!row.gitRepoUrl.trim() || !isLikelyUrl(row.gitRepoUrl.trim())) {
    git = row.gitRepoUrl.trim() ? "error" : "needs";
    messages.push("저장소: URL 형식을 확인하세요. (https:// 로 시작하는 주소)");
  }
  if (!row.baseBranch.trim()) {
    git = "error";
    messages.push("저장소: 베이스 브랜치 이름이 필요합니다.");
  }

  let host = "";
  try {
    host = new URL(row.gitRepoUrl.trim()).hostname.toLowerCase();
  } catch {
    /* ignore */
  }
  const looksGitHub = host === "github.com" || host.endsWith(".github.com");
  if (looksGitHub && row.gitRepoProvider === "other") {
    messages.push("저장소: URL은 GitHub인데 제공자가 ‘기타’로 되어 있습니다. 필요하면 GitHub로 맞추세요.");
  }
  if (!looksGitHub && row.gitRepoProvider === "github") {
    messages.push("저장소: 제공자는 GitHub인데 URL 호스트가 GitHub가 아닙니다. URL 또는 제공자를 확인하세요.");
  }

  const parsed = parseGitHubRepoFullName(row.gitRepoUrl);
  const name = (row.gitRepoName ?? "").trim().toLowerCase();
  if (parsed && name && parsed !== name) {
    git = "error";
    messages.push(`저장소: full name이 URL과 맞지 않습니다. (URL 기준 ${parsed})`);
  }

  return { git, messages };
}

function computeOverallStatus(
  repoOk: boolean | null,
  cursorApiOk: boolean | null,
  execOk: boolean | null
): "draft" | "validated" | "invalid" {
  if (repoOk === true && cursorApiOk === true && execOk === true) return "validated";
  if (repoOk === false || cursorApiOk === false || execOk === false) return "invalid";
  return "draft";
}

function storedSide(ok: boolean | null | undefined): Side {
  if (ok === true) return "ok";
  if (ok === false) return "error";
  return "needs";
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    let requestedScope: ValidateScope = "all";
    try {
      const ct = request.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const b = (await request.json()) as { scope?: string };
        const s = b?.scope;
        if (
          s === "repository" ||
          s === "cursor_api" ||
          s === "cursor_execution" ||
          s === "cursor" ||
          s === "all"
        ) {
          requestedScope = s;
        }
      }
    } catch {
      /* empty body → all */
    }

    const scope = normalizeValidateScope(requestedScope);

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(
        pid,
        userId,
        "canEditProject",
        "POST /api/projects/[projectId]/execution-setup/validate"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const row = await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.findUnique({ where: { projectId: pid } })
    );
    if (!row) {
      return NextResponse.json(
        { success: false, message: "저장된 실행 환경 설정이 없습니다. 먼저 설정을 저장하세요." },
        { status: 400 }
      );
    }

    const repoStruct = validateRepoStructure({
      gitRepoUrl: row.gitRepoUrl,
      baseBranch: row.baseBranch,
      gitRepoProvider: row.gitRepoProvider ?? "github",
      gitRepoName: row.gitRepoName,
    });

    const runRepoProbe = scope === "repository" || scope === "all";
    const runCursorApiOnly = scope === "cursor_api";
    const runCursorFull = scope === "cursor_execution" || scope === "all";
    const now = new Date();

    const messages: string[] = [...repoStruct.messages];
    const probeMessages: string[] = [];

    let gitResult: Side = repoStruct.git;
    let cursorSteps: CursorApiValidationStep[] = [];

    let nextRepoOk: boolean | null = row.repoConnectionOk ?? null;
    let nextRepoErr: string | null = row.repoValidationError ?? null;
    let nextRepoAt: Date | null = row.repoValidatedAt ?? null;

    let nextCursorApiOk: boolean | null = row.cursorApiConnectionOk ?? null;
    let nextCursorApiErr: string | null = row.cursorApiValidationError ?? null;
    let nextCursorApiAt: Date | null = row.cursorApiValidatedAt ?? null;

    let nextExecOk: boolean | null = row.executorConnectionOk ?? null;
    let nextExecErr: string | null = row.executorValidationError ?? null;
    let nextExecAt: Date | null = row.executorValidatedAt ?? null;

    if (runRepoProbe) {
      if (repoStruct.git === "ok") {
        const gitProbe = await probeGitHttpRemote(row.gitRepoUrl.trim());
        if (!gitProbe.ok) {
          gitResult = "error";
          probeMessages.push(`저장소: 원격에 연결할 수 없습니다. (${gitProbe.error ?? "원인 불명"})`);
        } else {
          const branchProbe = await probeGitBaseBranchReachable(row.gitRepoUrl.trim(), row.baseBranch.trim());
          if (!branchProbe.ok) {
            gitResult = "error";
            probeMessages.push(`저장소: ${branchProbe.error ?? "베이스 브랜치 확인 실패"}`);
          } else {
            gitResult = "ok";
          }
        }
      } else {
        gitResult = repoStruct.git;
      }
      nextRepoOk = gitResult === "ok" ? true : false;
      const repoErrMsgs = [...messages.filter((m) => m.startsWith("저장소:")), ...probeMessages.filter((m) => m.startsWith("저장소:"))];
      nextRepoErr = gitResult === "ok" ? null : repoErrMsgs.join(" · ") || "저장소 검증 실패";
      nextRepoAt = now;
    } else {
      gitResult = storedSide(row.repoConnectionOk);
    }

    const cursorArgs = {
      cursorApiUrl: row.cursorApiUrl,
      cursorApiToken: row.cursorApiToken ?? null,
      gitRepoUrl: row.gitRepoUrl,
      baseBranch: row.baseBranch,
      branchStrategy: row.branchStrategy,
    };

    if (runCursorApiOnly) {
      const outcome = await runCursorApiValidation(cursorArgs, { mode: "api_only" });
      cursorSteps = outcome.steps;
      nextCursorApiOk = outcome.overallOk;
      nextCursorApiErr = outcome.overallOk ? null : formatCursorApiFailureForStorage(cursorSteps);
      nextCursorApiAt = now;
      formatCursorApiStepSummaryLines(outcome.steps).forEach((line) => {
        probeMessages.push(`Cursor API: ${line}`);
      });
    }

    if (runCursorFull) {
      const outcome = await runCursorApiValidation(cursorArgs, { mode: "full" });
      cursorSteps = outcome.steps;
      const apiPhases = cursorValidationApiPhasesOk(cursorSteps);
      const ra = cursorValidationRepoAccessOk(cursorSteps);
      nextCursorApiOk = apiPhases;
      nextCursorApiErr = apiPhases ? null : formatCursorApiFailureForStorage(cursorSteps);
      nextCursorApiAt = new Date();
      nextExecOk = apiPhases && ra;
      nextExecErr = apiPhases && ra ? null : formatCursorApiFailureForStorage(cursorSteps);
      nextExecAt = now;
      formatCursorApiStepSummaryLines(outcome.steps).forEach((line) => {
        probeMessages.push(`실행 검증: ${line}`);
      });
    }

    const nextStatus = computeOverallStatus(nextRepoOk, nextCursorApiOk, nextExecOk);
    const needsRevalidation = nextStatus !== "validated";

    let lastValidationError: string | null = null;
    if (nextStatus === "validated") {
      lastValidationError = null;
    } else {
      const parts: string[] = [];
      if (nextRepoOk === false) {
        if (nextRepoErr) parts.push(nextRepoErr);
      } else if (nextRepoOk === null) {
        parts.push("① Git 저장소 연결 검증이 필요합니다.");
      }
      if (nextCursorApiOk === false) {
        if (nextCursorApiErr) parts.push(nextCursorApiErr);
      } else if (nextCursorApiOk === null) {
        parts.push("② Cursor API 검증이 필요합니다.");
      }
      if (nextExecOk === false) {
        if (nextExecErr) parts.push(nextExecErr);
      } else if (nextExecOk === null) {
        parts.push("③ 실행 검증이 필요합니다.");
      }
      lastValidationError = parts.filter(Boolean).join(" · ") || "검증이 완료되지 않았습니다.";
    }

    const cursorPayloadOverallOk = runCursorFull
      ? nextExecOk === true
      : runCursorApiOnly
        ? nextCursorApiOk === true
        : false;

    const updated = await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.update({
        where: { projectId: pid },
        data: {
          status: nextStatus,
          lastValidatedAt: now,
          needsRevalidation,
          lastValidationError,
          repoConnectionOk: nextRepoOk,
          repoValidatedAt: nextRepoAt,
          repoValidationError: nextRepoErr,
          cursorApiConnectionOk: nextCursorApiOk,
          cursorApiValidatedAt: nextCursorApiAt,
          cursorApiValidationError: nextCursorApiErr,
          executorConnectionOk: nextExecOk,
          executorValidatedAt: nextExecAt,
          executorValidationError: nextExecErr,
        },
      })
    );

    const allMessages = [...messages, ...probeMessages];
    const userMessage =
      scope === "repository"
        ? gitResult === "ok"
          ? "저장소 연결 검증에 성공했습니다."
          : "저장소 연결 검증에 실패했습니다."
        : scope === "cursor_api"
          ? nextCursorApiOk
            ? "Cursor API 검증에 성공했습니다."
            : "Cursor API 검증에 실패했습니다."
          : scope === "cursor_execution"
            ? nextExecOk
              ? "실행 검증에 성공했습니다."
              : "실행 검증에 실패했습니다."
            : nextStatus === "validated"
              ? "세 단계 검증이 모두 완료되었습니다. 실행할 준비가 되었습니다."
              : "아직 끝나지 않은 검증 단계가 있습니다. Git → Cursor API → 실행 순서로 확인하세요.";

    return NextResponse.json({
      success: true,
      message: userMessage,
      data: {
        scope: requestedScope === "cursor" ? "cursor_execution" : scope,
        status: updated.status,
        lastValidatedAt: updated.lastValidatedAt ? updated.lastValidatedAt.toISOString() : null,
        needsRevalidation: Boolean(updated.needsRevalidation),
        lastValidationError: updated.lastValidationError ?? null,
        git: gitResult,
        cursor: storedSide(nextExecOk),
        cursorApi: storedSide(nextCursorApiOk),
        messages: allMessages,
        probeGitOk: runRepoProbe ? gitResult === "ok" : undefined,
        probeCursorOk:
          runCursorFull ? nextExecOk === true : runCursorApiOnly ? nextCursorApiOk === true : undefined,
        repoConnectionOk: nextRepoOk,
        cursorApiConnectionOk: nextCursorApiOk,
        executorConnectionOk: nextExecOk,
        repoValidatedAt: updated.repoValidatedAt ? updated.repoValidatedAt.toISOString() : null,
        cursorApiValidatedAt: updated.cursorApiValidatedAt ? updated.cursorApiValidatedAt.toISOString() : null,
        executorValidatedAt: updated.executorValidatedAt ? updated.executorValidatedAt.toISOString() : null,
        repoValidationError: updated.repoValidationError ?? null,
        cursorApiValidationError: updated.cursorApiValidationError ?? null,
        executorValidationError: updated.executorValidationError ?? null,
        cursorApiValidation:
          (runCursorApiOnly || runCursorFull) && cursorSteps.length
            ? {
                overallOk: cursorPayloadOverallOk,
                stages: cursorSteps.map((s) => ({
                  stage: s.stage,
                  status: s.status,
                  reason: s.reason,
                  latencyMs: s.latencyMs,
                  detail: s.detail,
                  context: s.context,
                })),
                summaryKr:
                  cursorPayloadOverallOk
                    ? formatCursorApiSuccessForStorage(cursorSteps)
                    : formatCursorApiFailureForStorage(cursorSteps),
                detailLines: formatCursorApiStepSummaryLines(cursorSteps),
              }
            : undefined,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    if (isExecutionSetupSchemaDriftError(error)) {
      return executionSetupSchemaDriftResponse();
    }
    console.error("POST /api/projects/[projectId]/execution-setup/validate error:", error);
    return NextResponse.json({ success: false, message: "연결 테스트 중 오류가 발생했습니다." }, { status: 500 });
  }
}
