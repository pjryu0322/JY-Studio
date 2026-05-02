import { parseRequirementsRoomState, type RequirementsRoomStateV3 } from "@/lib/project/requirementsRoomState";

export const LOCAL_SHELL_KEY = "jyo:requirements-workspace-local-v3";

export type LocalShell = {
  room: RequirementsRoomStateV3;
  goals: string;
  scopeIn: string;
  scopeOut: string;
  targetUsers: string;
  success: string;
  nfr: string;
  openIssues: string;
  priorityFeatures: string;
};

export function readLocalShell(): LocalShell | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LOCAL_SHELL_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as LocalShell;
    if (!o || typeof o !== "object") return null;
    return {
      room: parseRequirementsRoomState(o.room),
      goals: String(o.goals ?? ""),
      scopeIn: String(o.scopeIn ?? ""),
      scopeOut: String(o.scopeOut ?? ""),
      targetUsers: String(o.targetUsers ?? ""),
      success: String(o.success ?? ""),
      nfr: String(o.nfr ?? ""),
      openIssues: String(o.openIssues ?? ""),
      priorityFeatures: String(o.priorityFeatures ?? ""),
    };
  } catch {
    return null;
  }
}

export function writeLocalShell(s: LocalShell): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(LOCAL_SHELL_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
