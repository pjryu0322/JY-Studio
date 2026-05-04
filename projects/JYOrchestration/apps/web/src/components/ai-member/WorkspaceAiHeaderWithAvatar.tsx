"use client";

import type { CSSProperties, ReactNode } from "react";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { WorkspaceAiMemberAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";

const flexMain: CSSProperties = { flex: "1 1 auto", minWidth: 0 };

/**
 * `WORKSPACE_STANDARD_CHAT_HEADER_STYLE`이 적용된 행 안에서 쓰는 공통 레이아웃:
 * (선택) 아바타 + 본문 flex + (선택) trailing.
 */
export function WorkspaceAiHeaderWithAvatar(p: {
  readonly memberId: WorkspaceAiMemberId | null | undefined;
  readonly avatarSize?: number;
  readonly children: ReactNode;
  readonly trailing?: ReactNode;
}): ReactNode {
  return (
    <>
      {p.memberId ? <WorkspaceAiMemberAvatar memberId={p.memberId} size={p.avatarSize ?? 24} /> : null}
      <span style={flexMain}>{p.children}</span>
      {p.trailing}
    </>
  );
}
