"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";
import {
  fetchEnvironmentTestLast,
  fetchExecutionSetup,
  postEnvironmentTestRun,
  postStage2DefaultAiMembers,
  type EnvironmentTestLastDto,
} from "@/components/project-spec/api";
import type { AiMemberRoleKey } from "@/lib/ai-member/aiMemberRoleDefinitions";
import { AI_MEMBER_ROLE_DEFINITIONS, STAGE2_DEFAULT_DB_MEMBER_SLOTS } from "@/lib/ai-member/aiMemberRoleDefinitions";

export type Stage2ReadinessSlot = "ready" | "missing" | "disabled";

function executionSetupReady(row: {
  repoConnectionOk?: boolean | null;
  githubAuthConnectionOk?: boolean | null;
  githubCapabilityValidation?: { githubOperableOk?: boolean | null } | null;
  cursorApiConnectionOk?: boolean | null;
  executorConnectionOk?: boolean | null;
} | null): boolean {
  if (!row) return false;
  const repoOk = row.repoConnectionOk ?? null;
  const githubAuthOk = row.githubAuthConnectionOk ?? null;
  const cap = row.githubCapabilityValidation ?? null;
  const githubEffectiveOk = githubAuthOk === true && cap != null && cap.githubOperableOk === true;
  const cursorApiOk = row.cursorApiConnectionOk ?? null;
  const execOk = row.executorConnectionOk ?? null;
  return repoOk === true && githubEffectiveOk === true && cursorApiOk === true && execOk === true;
}

function slotStateForDbRole(
  members: ProjectMemberUiRow[],
  orchestrationStage: string,
  aiOrchestrationRole: string
): Stage2ReadinessSlot {
  const rows = members.filter(
    (m) =>
      m.memberType === "AI" &&
      m.orchestrationStage === orchestrationStage &&
      m.aiOrchestrationRole === aiOrchestrationRole
  );
  if (rows.length === 0) return "missing";
  return rows.some((m) => m.orchestrationEnabled !== false) ? "ready" : "disabled";
}

function readinessLabel(slot: Stage2ReadinessSlot, scmFallback?: boolean): string {
  if (scmFallback && slot === "missing") return "플랫폼 fallback";
  if (slot === "ready") return "준비됨";
  if (slot === "disabled") return "비활성";
  return "없음";
}

export function useAiMembersState(input: {
  projectId: string;
  members: ProjectMemberUiRow[];
  canRunStage2EnvTest: boolean;
  isProjectOwner: boolean;
  onAfterMutation: () => Promise<void>;
}) {
  const { projectId, members, canRunStage2EnvTest, isProjectOwner, onAfterMutation } = input;
  const [stage2Last, setStage2Last] = useState<EnvironmentTestLastDto | null>(null);
  const [execSetupOk, setExecSetupOk] = useState<boolean | null>(null);
  const [busyStage2, setBusyStage2] = useState(false);
  const [stage2BusySince, setStage2BusySince] = useState<number | null>(null);
  const [stage2ElapsedMs, setStage2ElapsedMs] = useState<number | null>(null);
  const [busyDefaults, setBusyDefaults] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadStage2 = useCallback(async () => {
    if (!projectId.trim()) return;
    try {
      const { res, json } = await fetchEnvironmentTestLast(projectId, { stage: 2 });
      if (res.ok && json.success && json.data) {
        setStage2Last(json.data.last ?? null);
      }
    } catch {
      /* ignore */
    }
  }, [projectId]);

  const loadExecutionSetup = useCallback(async () => {
    if (!projectId.trim()) return;
    try {
      const { res, json } = await fetchExecutionSetup(projectId);
      if (res.ok && json.success && json.data) {
        setExecSetupOk(executionSetupReady(json.data));
      } else {
        setExecSetupOk(false);
      }
    } catch {
      setExecSetupOk(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadStage2();
    void loadExecutionSetup();
  }, [loadStage2, loadExecutionSetup]);

  useEffect(() => {
    if (!busyStage2 || stage2BusySince == null) {
      setStage2ElapsedMs(null);
      return;
    }
    const tick = () => setStage2ElapsedMs(Date.now() - stage2BusySince);
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [busyStage2, stage2BusySince]);

  /** Stage 2 실행 중 서버 상태(워크플로·런) 갱신 — POST 대기 중에도 폴링 */
  useEffect(() => {
    if (!busyStage2 || !projectId.trim()) return;
    const id = setInterval(() => void loadStage2(), 1_500);
    return () => clearInterval(id);
  }, [busyStage2, projectId, loadStage2]);

  const readiness = useMemo(() => {
    const executorReady = execSetupOk === true;
    const rev = slotStateForDbRole(members, "execution-review", "reviewer");
    const sec = slotStateForDbRole(members, "execution-review", "security-reviewer");
    const scm = slotStateForDbRole(members, "scm-manager", "scm-manager");
    return {
      executorLabel: executorReady ? "준비됨 (Cursor)" : "없음 · 실행 환경 탭에서 연결",
      reviewerLabel: readinessLabel(rev),
      securityLabel: readinessLabel(sec),
      scmLabel: scm === "ready" ? "준비됨" : readinessLabel(scm, true),
      executorSlot: executorReady ? ("ready" as const) : ("missing" as const),
      reviewerSlot: rev,
      securitySlot: sec,
      scmSlot: scm,
    };
  }, [members, execSetupOk]);

  async function runStage2() {
    setBusyStage2(true);
    setStage2BusySince(Date.now());
    setNote(null);
    try {
      const { res, json } = await postEnvironmentTestRun(projectId, { stage: 2 });
      if (json.data?.last != null) {
        setStage2Last(json.data.last);
      }
      await loadStage2();
      setNote(
        (typeof json.message === "string" && json.message.trim()) ||
          (res.ok ? "Stage 2 실행이 완료되었습니다." : "Stage 2 실행에 실패했습니다.")
      );
      await onAfterMutation();
    } finally {
      setBusyStage2(false);
      setStage2BusySince(null);
    }
  }

  async function addDefaultMembers() {
    setBusyDefaults(true);
    setNote(null);
    try {
      const { res, json } = await postStage2DefaultAiMembers(projectId);
      if (json.data) {
        const { created, skipped } = json.data;
        setNote(
          (typeof json.message === "string" && json.message.trim()) ||
            (created.length
              ? `추가: ${created.join(", ")}`
              : skipped.length
                ? "이미 등록된 역할은 건너뜁니다."
                : "변경 없음")
        );
      } else {
        setNote((typeof json.message === "string" && json.message.trim()) || "요청이 완료되었습니다.");
      }
      if (res.ok) {
        await onAfterMutation();
        await loadStage2();
      }
    } finally {
      setBusyDefaults(false);
    }
  }

  function pickMemberForRole(roleKey: AiMemberRoleKey): ProjectMemberUiRow | null {
    const slot = STAGE2_DEFAULT_DB_MEMBER_SLOTS.find((s) => s.roleKey === roleKey);
    if (!slot) return null;
    const rows = members.filter(
      (m) =>
        m.memberType === "AI" &&
        m.orchestrationStage === slot.orchestrationStage &&
        m.aiOrchestrationRole === slot.aiOrchestrationRole
    );
    return rows[0] ?? null;
  }

  const stage2Runnable = canRunStage2EnvTest && readiness.executorSlot === "ready";

  return {
    stage2Last,
    loadStage2,
    execSetupOk,
    readiness,
    busyStage2,
    stage2ElapsedMs,
    busyDefaults,
    note,
    setNote,
    runStage2,
    addDefaultMembers,
    pickMemberForRole,
    stage2Runnable,
    canAddDefaults: isProjectOwner,
    roleDefs: AI_MEMBER_ROLE_DEFINITIONS,
  };
}
