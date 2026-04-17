import type { ProjectRole } from "@/lib/auth/roles";
import type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";

/** UI 전용 — DB 스키마와 무관 */
export type UnifiedMemberType = "USER" | "AI";

export type UnifiedMember = Readonly<{
  id: string;
  name: string;
  type: UnifiedMemberType;
  roles: readonly string[];
  aiConfig?: Readonly<{
    model?: string;
    prompt?: string;
    scope?: string;
  }>;
}>;

const ORCH_TITLE: Record<string, string> = {
  reviewer: "실행 리뷰어",
  "security-reviewer": "보안 리뷰어",
  "quality-reviewer": "품질 리뷰어",
  "spec-reviewer": "Spec 리뷰어",
  "task-reviewer": "Task 리뷰어",
  planner: "Planner",
  "scm-manager": "SCM Manager",
};

export function projectRoleLabelKr(role: ProjectRole): string {
  switch (role) {
    case "OWNER":
      return "소유자";
    case "EDITOR":
      return "편집자";
    case "REVIEWER":
      return "검토자";
    case "VIEWER":
      return "뷰어";
    default:
      return role;
  }
}

function orchestrationTitleKr(key: string | null | undefined): string | null {
  const k = String(key ?? "").trim();
  if (!k) return null;
  return ORCH_TITLE[k] ?? k;
}

export function memberRowToUnified(row: ProjectMemberUiRow): UnifiedMember {
  const roles: string[] = [projectRoleLabelKr(row.role)];
  const orch = orchestrationTitleKr(row.aiOrchestrationRole);
  if (orch) roles.push(orch);
  return {
    id: row.memberId,
    name: row.displayName,
    type: row.memberType === "AI" ? "AI" : "USER",
    roles,
    aiConfig:
      row.memberType === "AI"
        ? {
            model: row.aiModelOverride?.trim() || undefined,
            scope: row.orchestrationStage?.trim() || undefined,
            prompt: undefined,
          }
        : undefined,
  };
}

export function memberTypeLabelKr(type: UnifiedMemberType): "사용자" | "AI" {
  return type === "AI" ? "AI" : "사용자";
}
