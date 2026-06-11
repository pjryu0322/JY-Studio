import { resolveCodeTaskBoardState } from "@/lib/prototype/implementationCodeTaskBoardState";

export function boardTreeNode(
  codeTaskId: string,
  statusLabel: string,
  progressLabel: string,
  githubOutcomeSaved = false,
) {
  const boardState = resolveCodeTaskBoardState({
    codeTaskId,
    title: codeTaskId,
    statusLabel,
    progressLabel,
    githubOutcomeSaved,
    commitSha: githubOutcomeSaved ? "sha" : null,
    branchName: githubOutcomeSaved ? "wip/branch" : null,
  });
  return { codeTaskId, boardState };
}
