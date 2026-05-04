import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";

/** GET/PUT `/api/project/workspace-ai` 및 Prisma 그래프와 동일한 와이어 */
export type WorkspaceAiGraphMemberWire = {
  readonly rowId: string | null;
  readonly catalogKey: WorkspaceAiMemberId;
  readonly enabled: boolean;
  readonly screenKeys: readonly WorkspaceScreenKey[];
};
