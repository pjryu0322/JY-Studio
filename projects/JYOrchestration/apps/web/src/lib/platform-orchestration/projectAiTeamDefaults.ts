import {
  PLATFORM_CORE_MEMBER_ROLES,
} from "@/lib/platform-orchestration/roles";
import type { ProjectAiTeamConfig } from "@/lib/platform-orchestration/projectAiTeam";

/**
 * When projectAiTeam is null, Phase 2 treats the default platform AI team as enabled.
 * (No per-project assignment persisted yet — see platform-orchestration-foundation.md.)
 */
export function defaultProjectAiTeamConfig(projectId: string): ProjectAiTeamConfig {
  return {
    projectId,
    enabledRoles: [...PLATFORM_CORE_MEMBER_ROLES],
    members: [],
  };
}
