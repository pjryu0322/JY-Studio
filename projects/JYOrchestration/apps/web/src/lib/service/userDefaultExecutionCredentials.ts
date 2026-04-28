import { prisma } from "@/lib/prisma";
import { maskCursorTokenForUi } from "@/lib/executionSetup/cursorTokenMask";
import { maskGithubTokenForUi } from "@/lib/executionSetup/githubTokenMask";
import { normalizeCursorApiBaseUrl } from "@/lib/executionSetup/cursorApiValidation";

export type UserExecutionCredentialHints = {
  githubAccessTokenMasked: string | null;
  cursorApiUrl: string | null;
  cursorApiTokenMasked: string | null;
};

/**
 * Latest validated credentials from another project owned by the same user.
 * Used to hint UI when the current project has no token yet (tokens are never copied automatically).
 */
export async function getUserDefaultExecutionCredentials(
  ownerUserId: string,
  excludeProjectId: string
): Promise<UserExecutionCredentialHints | null> {
  const uid = String(ownerUserId ?? "").trim();
  const ex = String(excludeProjectId ?? "").trim();
  if (!uid || !ex) return null;

  const rows = await prisma.executionSetup.findMany({
    where: {
      project: { ownerUserId: uid },
      NOT: { projectId: ex },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      githubAccessToken: true,
      githubAuthConnectionOk: true,
      cursorApiToken: true,
      cursorApiUrl: true,
      cursorApiConnectionOk: true,
    },
  });

  let githubAccessTokenMasked: string | null = null;
  for (const r of rows) {
    const t = String(r.githubAccessToken ?? "").trim();
    if (t && r.githubAuthConnectionOk === true) {
      githubAccessTokenMasked = maskGithubTokenForUi(t);
      break;
    }
  }

  let cursorApiTokenMasked: string | null = null;
  let cursorApiUrl: string | null = null;
  for (const r of rows) {
    const t = String(r.cursorApiToken ?? "").trim();
    if (t && r.cursorApiConnectionOk === true) {
      cursorApiTokenMasked = maskCursorTokenForUi(t);
      cursorApiUrl = normalizeCursorApiBaseUrl(r.cursorApiUrl);
      break;
    }
  }

  if (!githubAccessTokenMasked && !cursorApiTokenMasked) return null;
  return { githubAccessTokenMasked, cursorApiUrl, cursorApiTokenMasked };
}

/**
 * TODO: Offer an explicit “apply peer credentials” flow (owner-only, audit log, optional rotate).
 * Today the UI only hints; users paste or reveal tokens per project.
 */
export async function applyUserDefaultExecutionCredentialsToProject(
  projectId: string,
  actorUserId: string
): Promise<{ ok: false; message: string }> {
  void projectId;
  void actorUserId;
  return {
    ok: false,
    message: "아직 지원하지 않습니다. 동일 계정의 다른 프로젝트에서 토큰을 확인한 뒤 이 프로젝트에 저장하세요.",
  };
}
