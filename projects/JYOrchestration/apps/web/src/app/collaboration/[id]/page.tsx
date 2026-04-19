"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActionResultPanel } from "@/components/workflow/ActionResultPanel";
import { CollaborationWorkspaceAside } from "@/components/workflow/CollaborationWorkspaceAside";
import { DiscussionInput } from "@/components/workflow/DiscussionInput";
import { DiscussionTimeline, type DiscussionItem } from "@/components/workflow/DiscussionTimeline";
import { WorkflowActionButton } from "@/components/workflow/primitives/WorkflowActionButton";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowCard } from "@/components/workflow/primitives/WorkflowCard";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { WorkflowSectionLabel } from "@/components/workflow/primitives/WorkflowSectionLabel";
import type {
  CollaborationActionResult,
  CollaborationActionType,
  CollaborationOfficialTaskDraft,
} from "@/lib/workflow/collaborationActionContract";
import { isSuccessCollaborationResult } from "@/lib/workflow/collaborationActionContract";
import { requestCollaborationGeneration } from "@/lib/workflow/collaborationGenerationClient";
import {
  applyCollaborationWorkspaceDisplayPatch,
  getCollaborationWorkspaceDisplayBootstrap,
  getDisplayPatchForCollaborationSuccess,
  recordOfficialOutputsForSuccess,
} from "@/lib/workflow/collaborationWorkspaceHandlers";
import { getCollaborationWorkspaceImpact } from "@/lib/workflow/collaborationWorkspaceImpact";
import type { DisplayedAnalysis } from "@/lib/workflow/collaborationWorkspacePayload";
import type { FeatureMock, MeetingMinutesMock } from "@/lib/mock/workflowMock";
import { formatCollaborationSessionStatusForUi } from "@/lib/ui/workflowUiCopy";
import { routeState } from "@/lib/workflow/workflowState";
import { getCollaborationWorkspaceView } from "@/lib/workflow/workflowViewModel";

export default function CollaborationWorkspacePage() {
  const params = useParams<{ id: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : "";
  const vm = useMemo(() => getCollaborationWorkspaceView(sessionId), [sessionId]);
  const sessionRoute = useMemo(() => routeState(sessionId, vm.session), [sessionId, vm.session]);

  const [displayedMinutes, setDisplayedMinutes] = useState<MeetingMinutesMock | null>(null);
  const [displayedFeatures, setDisplayedFeatures] = useState<FeatureMock[]>([]);
  const [displayedAnalysis, setDisplayedAnalysis] = useState<DisplayedAnalysis | null>(null);
  const [displayedIdeas, setDisplayedIdeas] = useState<string[]>([]);
  const [suggestedFeaturesFromIdeas, setSuggestedFeaturesFromIdeas] = useState<FeatureMock[]>([]);
  const [displayedTaskDrafts, setDisplayedTaskDrafts] = useState<CollaborationOfficialTaskDraft[]>([]);

  const [discussion, setDiscussion] = useState<DiscussionItem[]>(() => [
    {
      id: "d-1",
      at: "2026-04-07 10:05",
      author: "Alice",
      mode: "online",
      content: "협업 워크스페이스 구조(상단 요약·토론·오른쪽 결과)부터 맞추자.",
    },
    {
      id: "d-2",
      at: "2026-04-07 10:12",
      author: "Bob",
      mode: "offline",
      content: "오프라인 회의 메모: 결정·미결 항목을 남기고, 회의록 패널은 페이지 간 재사용되게 유지.",
    },
  ]);

  const [actionState, setActionState] = useState<{
    status: "idle" | "running" | "success" | "error";
    latest: CollaborationActionResult | null;
  }>({ status: "idle", latest: null });

  useEffect(() => {
    const view = getCollaborationWorkspaceView(sessionId);
    const boot = getCollaborationWorkspaceDisplayBootstrap(sessionId, view);
    if (!boot) {
      return;
    }
    setDisplayedMinutes(boot.minutes);
    setDisplayedFeatures(boot.features);
    setDisplayedTaskDrafts(boot.taskDrafts);
    setDisplayedAnalysis(null);
    setDisplayedIdeas([]);
    setSuggestedFeaturesFromIdeas([]);
    setActionState({ status: "idle", latest: null });
  }, [sessionId]);

  const workspaceImpact = useMemo(() => getCollaborationWorkspaceImpact(actionState.latest), [actionState.latest]);

  const runAction = async (actionType: CollaborationActionType) => {
    setActionState({
      status: "running",
      latest: { actionType, status: "running", atIso: new Date().toISOString(), message: "실행 중…", payload: null },
    });
    const out = await requestCollaborationGeneration(actionType, sessionId);
    setActionState({ status: out.status, latest: out });

    if (!isSuccessCollaborationResult(out)) {
      return;
    }

    recordOfficialOutputsForSuccess(sessionId, out);
    applyCollaborationWorkspaceDisplayPatch(getDisplayPatchForCollaborationSuccess(out), {
      setMinutes: setDisplayedMinutes,
      setFeatures: setDisplayedFeatures,
      setTaskDrafts: setDisplayedTaskDrafts,
      setAnalysis: setDisplayedAnalysis,
      setIdeas: setDisplayedIdeas,
      setSuggestedFeaturesFromIdeas,
    });
  };

  if (sessionRoute.kind === "not_found") {
    return (
      <div>
        <WorkflowPageHeader
          title="협업 세션"
          subtitle={sessionId ? `알 수 없는 세션 ID: ${sessionId}` : "알 수 없는 세션 ID입니다."}
          backHref="/features"
          backLabel="기능 정리로"
          right={<WorkflowBadge>알 수 없음</WorkflowBadge>}
        />
        <div style={{ marginTop: 14 }}>
          <WorkflowEmptyState
            title="세션을 찾을 수 없음"
            message="URL을 확인하세요. 잘못된 세션에는 관계 없는 목 데이터를 표시하지 않습니다."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <WorkflowPageHeader
        title={vm.session?.title ?? "협업 세션"}
        subtitle={
          vm.session ? `${vm.session.createdAt} · ${vm.session.id}` : sessionId ? `알 수 없는 세션 ID: ${sessionId}` : "알 수 없는 세션 ID입니다."
        }
        backHref="/features"
        backLabel="기능 정리로"
        right={
          vm.session ? (
            <WorkflowBadge>{formatCollaborationSessionStatusForUi(vm.session.status)}</WorkflowBadge>
          ) : (
            <WorkflowBadge>알 수 없음</WorkflowBadge>
          )
        }
      />

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <WorkflowCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>연결된 요구사항</div>
              {vm.requirement ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{vm.requirement.title}</div>
                  <div style={{ fontSize: 13, color: "#111827", marginTop: 6, lineHeight: 1.55 }}>
                    {vm.requirement.description}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#6b7280" }}>(연결된 아이디어 없음)</div>
              )}
            </div>
            {vm.requirement ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", alignSelf: "center" }}>
                <Link
                  href={`/requirements/${encodeURIComponent(vm.requirement.id)}?tab=sessions`}
                  style={{ fontSize: 13, textDecoration: "underline" }}
                >
                  아이디어 구체화 열기
                </Link>
                <Link
                  href={`/tasks?requirementId=${encodeURIComponent(vm.requirement.id)}&sessionId=${encodeURIComponent(sessionId)}`}
                  style={{ fontSize: 13, textDecoration: "underline" }}
                >
                  작업 정리 화면
                </Link>
              </div>
            ) : null}
          </div>
        </WorkflowCard>

        <WorkflowCard>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>관련 자료</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>(자리 표시자) 다음 단계에서 링크·문서를 첨부합니다.</div>
        </WorkflowCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)", gap: 16, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          <div>
            <WorkflowSectionLabel marginBottom={8}>토론</WorkflowSectionLabel>
            <DiscussionInput
              onAdd={(item) => {
                const now = new Date();
                const at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
                  now.getHours()
                ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                setDiscussion((prev) => [{ id: `d-${prev.length + 1}`, at, ...item }, ...prev]);
              }}
            />
            <div style={{ marginTop: 12 }}>
              <DiscussionTimeline items={discussion} />
            </div>
          </div>

          <div>
            <WorkflowSectionLabel marginBottom={8}>워크스페이스 작업</WorkflowSectionLabel>
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <WorkflowSectionLabel marginBottom={6}>공식</WorkflowSectionLabel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <WorkflowActionButton label="회의록 작성" onClick={() => void runAction("GENERATE_MINUTES")} />
                  <WorkflowActionButton label="Feature 생성" onClick={() => void runAction("GENERATE_FEATURES")} />
                  <WorkflowActionButton label="Task 초안 생성" onClick={() => void runAction("GENERATE_TASKS")} />
                </div>
              </div>
              <div>
                <WorkflowSectionLabel marginBottom={6}>보조</WorkflowSectionLabel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <WorkflowActionButton label="분석 요청" onClick={() => void runAction("REQUEST_ANALYSIS")} />
                  <WorkflowActionButton label="아이디어 요청" onClick={() => void runAction("REQUEST_IDEAS")} />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginTop: 8 }}>
              공식 작업은 주요 산출물을 갱신하고(메모리 저장으로 최신 세션 아이디어 상세와 동기), 보조 작업은 보조 인사이트만 채웁니다. 서버 응답은 현재
              mock_stub입니다.
            </div>
          </div>

          <WorkflowCard padding={12}>
            <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>작업 피드백</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45, marginBottom: 10 }}>
              마지막 실행의 상태·시각·선택적 JSON 미리보기입니다. 성공 후 워크스페이스 안내를 읽어 공식 산출물만 바뀌었는지 보조만 바뀌었는지 확인하세요.
            </div>
            <ActionResultPanel result={actionState.latest} workspaceImpact={workspaceImpact} />
          </WorkflowCard>
        </div>

        <CollaborationWorkspaceAside
          displayedMinutes={displayedMinutes}
          displayedFeatures={displayedFeatures}
          displayedTaskDrafts={displayedTaskDrafts}
          displayedAnalysis={displayedAnalysis}
          displayedIdeas={displayedIdeas}
          suggestedFeaturesFromIdeas={suggestedFeaturesFromIdeas}
        />
      </div>
    </div>
  );
}
