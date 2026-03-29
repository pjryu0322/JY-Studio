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

export type ValidateScope = "repository" | "cursor" | "all";

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

function computeOverallStatus(repoOk: boolean | null, execOk: boolean | null): "draft" | "validated" | "invalid" {
  if (repoOk === true && execOk === true) return "validated";
  if (repoOk === false || execOk === false) return "invalid";
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

    let scope: ValidateScope = "all";
    try {
      const ct = request.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const b = (await request.json()) as { scope?: string };
        if (b?.scope === "repository" || b?.scope === "cursor" || b?.scope === "all") {
          scope = b.scope;
        }
      }
    } catch {
      /* empty body → all */
    }

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

    const runRepoProbe = scope === "repository" || scope === "all" || scope === "cursor";
    const runCursorProbe = scope === "cursor" || scope === "all";

    const messages: string[] = [...repoStruct.messages];
    const probeMessages: string[] = [];

    let gitResult: Side = repoStruct.git;
    let cursorResult: Side = storedSide(row.executorConnectionOk);
    let cursorSteps: CursorApiValidationStep[] = [];

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
    } else {
      gitResult = storedSide(row.repoConnectionOk);
    }

    if (runCursorProbe) {
      const cursorOutcome = await runCursorApiValidation({
        cursorApiUrl: row.cursorApiUrl,
        cursorApiToken: row.cursorApiToken ?? null,
        gitRepoUrl: row.gitRepoUrl,
        baseBranch: row.baseBranch,
        branchStrategy: row.branchStrategy,
      });
      cursorSteps = cursorOutcome.steps;
      cursorResult = cursorOutcome.overallOk ? "ok" : "error";
      formatCursorApiStepSummaryLines(cursorOutcome.steps).forEach((line) => {
        probeMessages.push(`Cursor API: ${line}`);
      });
    } else {
      cursorResult = storedSide(row.executorConnectionOk);
    }

    const now = new Date();

    let nextRepoOk: boolean | null = row.repoConnectionOk ?? null;
    let nextExecOk: boolean | null = row.executorConnectionOk ?? null;
    if (runRepoProbe) {
      nextRepoOk = gitResult === "ok" ? true : false;
    }
    if (runCursorProbe) {
      nextExecOk = cursorResult === "ok" ? true : false;
    }

    const nextRepoAt = runRepoProbe ? now : row.repoValidatedAt ?? null;
    const nextExecAt = runCursorProbe ? now : row.executorValidatedAt ?? null;

    const repoErrMsgs = [...messages.filter((m) => m.startsWith("저장소:")), ...probeMessages.filter((m) => m.startsWith("저장소:"))];
    const execErrMsgs = [
      ...messages.filter((m) => m.startsWith("Cursor API:")),
      ...probeMessages.filter((m) => m.startsWith("Cursor API:")),
    ];

    let nextRepoErr: string | null = row.repoValidationError ?? null;
    let nextExecErr: string | null = row.executorValidationError ?? null;
    if (runRepoProbe) {
      nextRepoErr = gitResult === "ok" ? null : repoErrMsgs.join(" · ") || "저장소 검증 실패";
    }
    if (runCursorProbe) {
      nextExecErr =
        cursorResult === "ok"
          ? null
          : cursorSteps.length
            ? formatCursorApiFailureForStorage(cursorSteps)
            : execErrMsgs.join(" · ") || "Cursor API 연결 검증 실패";
    }

    const nextStatus = computeOverallStatus(nextRepoOk, nextExecOk);
    const needsRevalidation = nextStatus !== "validated";

    let lastValidationError: string | null = null;
    if (nextStatus === "validated") {
      lastValidationError = null;
    } else {
      const parts: string[] = [];
      if (nextRepoOk === false) {
        if (nextRepoErr) parts.push(nextRepoErr);
      } else if (nextRepoOk === null) {
        parts.push("저장소 연결을 검증해 주세요.");
      }
      if (nextExecOk === false) {
        if (nextExecErr) parts.push(nextExecErr);
      } else if (nextExecOk === null) {
        parts.push("Cursor API 연결을 검증해 주세요.");
      }
      lastValidationError = parts.filter(Boolean).join(" · ") || "검증이 완료되지 않았습니다.";
    }

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
          : "저장소 검증에 실패했습니다."
        : scope === "cursor"
          ? cursorResult === "ok"
            ? "Cursor API 연결 검증 완료"
            : "Cursor API 연결 검증에 실패했습니다. 아래 상세를 확인하세요."
          : nextStatus === "validated"
            ? "저장소·Cursor API 검증이 모두 완료되었습니다."
            : "검증이 모두 끝나지 않았습니다. 저장소·Cursor API 상태를 확인하세요.";

    return NextResponse.json({
      success: true,
      message: userMessage,
      data: {
        scope,
        status: updated.status,
        lastValidatedAt: updated.lastValidatedAt ? updated.lastValidatedAt.toISOString() : null,
        needsRevalidation: Boolean(updated.needsRevalidation),
        lastValidationError: updated.lastValidationError ?? null,
        git: gitResult,
        cursor: cursorResult,
        messages: allMessages,
        probeGitOk: runRepoProbe ? gitResult === "ok" : undefined,
        probeCursorOk: runCursorProbe ? cursorResult === "ok" : undefined,
        repoConnectionOk: nextRepoOk,
        executorConnectionOk: nextExecOk,
        repoValidatedAt: updated.repoValidatedAt ? updated.repoValidatedAt.toISOString() : null,
        executorValidatedAt: updated.executorValidatedAt ? updated.executorValidatedAt.toISOString() : null,
        repoValidationError: updated.repoValidationError ?? null,
        executorValidationError: updated.executorValidationError ?? null,
        cursorApiValidation:
          runCursorProbe && cursorSteps.length
            ? {
                overallOk: cursorResult === "ok",
                stages: cursorSteps.map((s) => ({
                  stage: s.stage,
                  status: s.status,
                  reason: s.reason,
                  latencyMs: s.latencyMs,
                  detail: s.detail,
                })),
                summaryKr:
                  cursorResult === "ok"
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
