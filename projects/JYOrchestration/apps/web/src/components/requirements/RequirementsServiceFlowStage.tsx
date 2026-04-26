"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { displayedAiOrchestrator, displayedAiStatusForStage, showInternalAgents } from "@/lib/ai-member/visibleAiOrchestrator";
import { PrototypePreviewPanel } from "@/components/preview/PrototypePreviewPanel";
import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";

type WorkshopRole = "ai" | "expert" | "member" | "user";
type ResultTab = "actors" | "flow" | "mapping" | "preview";
type ServiceFlowSlotKey =
  | "humanActors"
  | "systemActors"
  | "mainFlow"
  | "actorResponsibility"
  | "approvalStep"
  | "exceptionFlow"
  | "accessControl"
  | "handoffToFeatures";

type WorkshopMessage = {
  id: string;
  role: WorkshopRole;
  name: string;
  body: string;
};

type ProjectMemberForServiceFlow = {
  memberId: string;
  displayName: string | null;
  email: string | null;
  memberType: string;
  role: string;
  isOwner?: boolean;
  userId?: string | null;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
};

type ApprovalState = {
  actorsReady: boolean;
  stepsReady: boolean;
  mapped: boolean;
  approved: boolean;
  ready: boolean;
  slots: Record<ServiceFlowSlotKey, boolean>;
  filledSlotCount: number;
  progressPercent: number;
  recommendedMissing: Partial<Record<ServiceFlowSlotKey, boolean>>;
};

type ServiceFlowParticipant = {
  id: string;
  name: string;
  roleLabel: string;
  connection: string;
  lastResponse?: string;
};

const SLOT_LABELS: Record<ServiceFlowSlotKey, string> = {
  humanActors: "사람 액터",
  systemActors: "시스템 액터",
  mainFlow: "주요 흐름",
  actorResponsibility: "단계별 담당",
  approvalStep: "승인/확정 단계",
  exceptionFlow: "예외 흐름",
  accessControl: "권한 범위",
  handoffToFeatures: "기능 후보",
};

const REQUIRED_SLOTS: readonly ServiceFlowSlotKey[] = ["humanActors", "systemActors", "mainFlow", "actorResponsibility"];
const RECOMMENDED_SLOTS: readonly ServiceFlowSlotKey[] = ["approvalStep", "exceptionFlow", "accessControl", "handoffToFeatures"];

const shell: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  minWidth: 0,
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr)",
  alignItems: "stretch",
  overflow: "hidden",
  background: "#fff",
};

const memberSidebar: CSSProperties = {
  boxSizing: "border-box",
  borderRight: "1px solid #e2e8f0",
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
};

const chatWrap: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  position: "relative",
};

const btn: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 900,
  color: "#0f172a",
  cursor: "pointer",
};

const primaryBtn: CSSProperties = {
  ...btn,
  borderColor: "#0f766e",
  background: "#0f766e",
  color: "#fff",
};

function uid(prefix: string): string {
  try {
    return `${prefix}:${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)}`;
  } catch {
    return `${prefix}:${Math.random().toString(16).slice(2)}`;
  }
}

function normalizeOrder(steps: RequirementsServiceFlowStepV1[]): RequirementsServiceFlowStepV1[] {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .map((s, idx) => ({ ...s, order: idx + 1 }));
}

function missingSlotQuestions(slots: Record<ServiceFlowSlotKey, boolean>, limit = 2): string[] {
  const questions: Record<ServiceFlowSlotKey, string> = {
    humanActors: "이 서비스에서 실제 사람 사용자는 누구인가요?",
    systemActors: "시스템이 자동으로 처리하는 단계는 무엇인가요?",
    mainFlow: "사용자가 처음부터 끝까지 거치는 주요 순서를 3단계 이상으로 말해 주실 수 있나요?",
    actorResponsibility: "각 단계의 최종 책임자는 누구인가요?",
    approvalStep: "승인/확정(결재) 단계가 필요한가요? 필요하다면 누가 승인하나요?",
    exceptionFlow: "반려, 수정 요청, 재처리 같은 예외 흐름이 필요한가요?",
    accessControl: "누가 열람하거나 수정할 수 있는지 권한 범위가 있나요?",
    handoffToFeatures: "다음 기능 정리로 넘길 핵심 기능 후보는 무엇인가요?",
  };
  return ([...REQUIRED_SLOTS, ...RECOMMENDED_SLOTS] as const).filter((slot) => !slots[slot]).slice(0, limit).map((slot) => questions[slot]);
}

function initialMessages(hasDraft: boolean, slots: Record<ServiceFlowSlotKey, boolean>): WorkshopMessage[] {
  // Guided interview UX: do not ask user to free-type on entry.
  // The first AI question is bootstrapped via /api/requirements/service-flow-analyze.
  void hasDraft;
  void slots;
  return [];
}

function messageTone(role: WorkshopRole): CSSProperties {
  if (role === "user") return { background: "#f0fdf4", borderColor: "#bbf7d0", justifySelf: "end" };
  if (role === "expert") return { background: "#fff7ed", borderColor: "#fed7aa", justifySelf: "start" };
  if (role === "member") return { background: "#f8fafc", borderColor: "#cbd5e1", justifySelf: "start" };
  return { background: "#fff", borderColor: "#e2e8f0", justifySelf: "start" };
}

function progressHint(approval: ApprovalState): string | null {
  const slots = approval.slots;
  if (!slots.humanActors) return "사람 액터 미확정";
  if (!slots.systemActors) return "시스템 액터 미확정";
  if (!slots.mainFlow) return "주요 서비스 흐름 미확정";
  if (!slots.actorResponsibility) return "담당(매핑) 미확정";
  if (!slots.approvalStep) return "승인/확정 단계 미확정";
  if (!slots.accessControl) return "권한 범위 미확정";
  if (!slots.exceptionFlow) return "예외/수정 흐름 미확정";
  if (!slots.handoffToFeatures) return "핵심 기능 후보 미확정";
  return null;
}

function deriveApprovalFromFlow(flow: RequirementsServiceFlowV1 | null): ApprovalState {
  const actorIds = new Set((flow?.actors ?? []).map((a) => a.id));
  const text = `${(flow?.actors ?? []).map((a) => `${a.name} ${a.description ?? ""}`).join(" ")} ${(flow?.steps ?? []).map((s) => `${s.title} ${s.purpose}`).join(" ")}`;
  const hasHumanActors = (flow?.actors ?? []).some((a) => a.kind === "human");
  const hasSystemActors = (flow?.actors ?? []).some((a) => a.kind === "system");
  const stepsReady = (flow?.steps.length ?? 0) >= 3;
  const mapped = Boolean(flow?.steps.length) && (flow?.steps ?? []).every((s) => s.primaryActorId && actorIds.has(s.primaryActorId));
  const hasApprovalStep = /승인|확정|결재|결정/.test(text);
  const slots: Record<ServiceFlowSlotKey, boolean> = {
    humanActors: hasHumanActors,
    systemActors: hasSystemActors,
    mainFlow: stepsReady,
    actorResponsibility: mapped,
    approvalStep: hasApprovalStep,
    exceptionFlow: /예외|수정|반려|재처리|실패|오류|누락/.test(text),
    accessControl: /권한|열람|수정 가능|공유 범위|접근|관리자/.test(text),
    handoffToFeatures: /기능|후보|알림|업로드|공유|승인|요청|관리/.test(text),
  };
  const filledSlotCount = Object.values(slots).filter(Boolean).length;
  const basePercent = Math.round((filledSlotCount / 8) * 100);
  const draftVisible = (flow?.actors?.length ?? 0) >= 1 && (flow?.steps?.length ?? 0) >= 3;
  const progressPercent = draftVisible ? Math.max(basePercent, 35) : basePercent;
  const actorsReady = slots.humanActors && slots.systemActors;
  const approved = Boolean(actorsReady && stepsReady && mapped && flow?.steps.every((s) => s.approved));
  return {
    actorsReady,
    stepsReady,
    mapped,
    approved,
    ready: slots.humanActors && slots.systemActors && slots.mainFlow && slots.actorResponsibility,
    slots,
    filledSlotCount,
    progressPercent,
    recommendedMissing: {
      approvalStep: !slots.approvalStep,
      exceptionFlow: !slots.exceptionFlow,
      accessControl: !slots.accessControl,
      handoffToFeatures: !slots.handoffToFeatures,
    },
  };
}

function participantMessageRole(member: ServiceFlowParticipant): WorkshopRole {
  const role = member.roleLabel.trim();
  if (role === "domain-expert" || role === "domainExpert") return "expert";
  if (role === "OWNER" || role === "EDITOR" || role === "REVIEWER" || role === "VIEWER") return "member";
  return "ai";
}

// LLM-first: rule/keyword based helpers intentionally removed.

function roleLabelForMember(m: ProjectMemberForServiceFlow): string {
  if (m.memberType === "AI") return (m.aiOrchestrationRole || "AI").trim();
  if (m.isOwner) return "OWNER";
  return (m.role || "멤버").trim();
}

function serviceFlowParticipants(members: readonly ProjectMemberForServiceFlow[], currentUserId: string | null, replying: boolean): ServiceFlowParticipant[] {
  const roleOrder = new Map<string, number>([
    ["planner", 0],
    ["service-designer", 1],
    ["domain-expert", 2],
    ["domainExpert", 2],
    ["serviceFlowExpert", 2],
  ]);
  const rows = [...members]
    .filter((m) => {
      // UI policy: show a single AI persona row ("AI 기획자") in this stage.
      if (m.memberType === "AI") return false;
      return m.memberType === "HUMAN";
    })
    .sort((a, b) => {
      if (a.memberType !== b.memberType) return a.memberType === "AI" ? -1 : 1;
      if (a.memberType === "AI") {
        const ao = roleOrder.get((a.aiOrchestrationRole ?? "").trim()) ?? 99;
        const bo = roleOrder.get((b.aiOrchestrationRole ?? "").trim()) ?? 99;
        if (ao !== bo) return ao - bo;
      }
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      if (currentUserId && a.userId !== b.userId) {
        if (a.userId === currentUserId) return -1;
        if (b.userId === currentUserId) return 1;
      }
      return String(a.displayName ?? a.email ?? "").localeCompare(String(b.displayName ?? b.email ?? ""), "ko");
    })
    .map((m) => {
      const role = roleLabelForMember(m);
      const isAi = m.memberType === "AI";
      return {
        id: m.memberId,
        name: (isAi ? displayedAiOrchestrator().name : m.displayName || m.email || "사용자").slice(0, 28),
        roleLabel: role,
        connection: isAi ? (replying ? "응답중" : "연결됨") : currentUserId && m.userId === currentUserId ? "온라인" : "대기",
        lastResponse: isAi ? (replying ? "응답 대기" : "마지막 응답 성공") : undefined,
      };
    });
  rows.unshift({
    id: "visible:ai-orchestrator",
    name: displayedAiOrchestrator().name,
    roleLabel: "AI",
    connection: replying ? "응답중" : "연결됨",
    lastResponse: replying ? displayedAiStatusForStage("service-flow") : "마지막 응답 성공",
  });
  return rows;
}

export function RequirementsServiceFlowStage({
  projectId,
  projectName,
  projectDescription,
  ideationParticipantHumanMemberIds,
  ideationAssets,
  ideationReady,
  ideationReadyNotice,
  flow,
  onChangeFlow,
  generatingDraft,
  draftGenerationCount = 0,
  approval,
  members,
  currentUserId,
  onInviteMember,
  onGenerateAiDraft,
  onApproveAll,
  onRetryGate,
}: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationParticipantHumanMemberIds: readonly string[];
  readonly ideationAssets: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly ideationReady: boolean;
  readonly ideationReadyNotice: string;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
  readonly generatingDraft: boolean;
  readonly draftGenerationCount?: number;
  readonly approval: ApprovalState;
  readonly members: readonly ProjectMemberForServiceFlow[];
  readonly currentUserId: string | null;
  readonly onInviteMember: () => void;
  readonly onGenerateAiDraft: () => void;
  readonly onApproveAll: () => void;
  readonly onRetryGate: () => void;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const showScreenLabels = useShowScreenLabels();
  const [messages, setMessages] = useState<WorkshopMessage[]>(() => initialMessages(Boolean(flow?.steps.length), approval.slots));
  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[] | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>("flow");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(flow?.steps[0]?.id ?? null);
  const [latestAiQuestion, setLatestAiQuestion] = useState<string>("");
  const [toolsOpen, setToolsOpen] = useState(false);

  const derivedApproval = useMemo(() => deriveApprovalFromFlow(flow), [flow]);
  const hint = progressHint(derivedApproval);

  const messagesRef = useRef<WorkshopMessage[]>(messages);
  const flowRef = useRef<RequirementsServiceFlowV1 | null>(flow);
  const latestAiQuestionRef = useRef<string>(latestAiQuestion);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);
  useEffect(() => {
    latestAiQuestionRef.current = latestAiQuestion;
  }, [latestAiQuestion]);

  const actors = flow?.actors ?? [];
  const steps = useMemo(() => normalizeOrder(flow?.steps ?? []), [flow?.steps]);
  const humans = actors.filter((a) => a.kind === "human");
  const systems = actors.filter((a) => a.kind === "system");
  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? steps[0] ?? null;
  const participants = useMemo(() => {
    const allowSet = new Set(ideationParticipantHumanMemberIds);
    // default include current user even if they haven't produced "human" message
    // (they show as USER messages in the chat model)
    const filtered = members.filter((m) => {
      if (m.memberType === "AI") return true;
      // Only include humans who participated in ideation (human messages) OR are current user.
      if (currentUserId && m.userId && m.userId === currentUserId) return true;
      return allowSet.has(m.memberId);
    });
    return serviceFlowParticipants(filtered, currentUserId, replying);
  }, [members, currentUserId, replying, ideationParticipantHumanMemberIds]);

  const goNextStage = () => {
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("stage", "features");
    router.replace(`/requirements?${params.toString()}`);
  };

  useEffect(() => {
    if (draftGenerationCount <= 0) return;
    const timer = window.setTimeout(() => {
      const qs = missingSlotQuestions(approval.slots, 3);
      setMessages((prev) => [
        ...prev,
        {
          id: uid("msg"),
          role: "ai",
          name: displayedAiOrchestrator().name,
          body: qs.length
            ? `아이디어 초안을 바탕으로 정리했습니다. 부족한 슬롯만 이어서 질문하겠습니다.\n${qs.map((q) => `- ${q}`).join("\n")}`
            : "아이디어 초안을 바탕으로 필요한 내용이 모두 정리되었습니다. 실제 업무 예외만 마지막으로 확인해 주세요.",
        },
      ]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftGenerationCount, approval.slots]);

  const actorName = (id: string) => actors.find((a) => a.id === id)?.name ?? id;

  const updateStep = (id: string, patch: Partial<RequirementsServiceFlowStepV1>) => {
    if (!flow) return;
    const now = new Date().toISOString();
    const nextSteps = flow.steps.map((s) => (s.id === id ? { ...s, ...patch, approved: false, updatedAt: now } : s));
    onChangeFlow({ ...flow, steps: normalizeOrder(nextSteps), updatedAt: now });
  };

  const callAnalyze = (userMessageText: string, opts?: { silentUserAppend?: boolean }) => {
    const body = userMessageText.trim();
    if (!body) return;
    setReplying(true);
    setQuickReplies(null);

    const userMessage: WorkshopMessage = { id: uid("msg"), role: "user", name: "사용자", body };
    if (!opts?.silentUserAppend) setMessages((prev) => [...prev, userMessage]);

    void (async () => {
      try {
        const transcript = [...(messagesRef.current ?? []), ...(opts?.silentUserAppend ? [] : [userMessage])];
        const recentMessages = transcript
          .slice(-24)
          .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.body}`)
          .join("\n")
          .slice(0, 12000);

        const res = await fetch("/api/requirements/service-flow-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            projectName,
            projectDescription,
            ideationAssets,
            userMessage: body,
            currentFlow: flowRef.current,
            recentMessages,
            latestAiQuestion: latestAiQuestionRef.current,
          }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          data?: {
            assistantMessage?: string;
            updatedFlow?: RequirementsServiceFlowV1;
            nextQuestion?: string | null;
            quickReplies?: string[] | null;
            readiness?: { score?: number; readyForNext?: boolean } | null;
          };
          code?: string;
          message?: string;
        };
        if (!res.ok || !json.success || !json.data?.updatedFlow) {
          setMessages((prev) => [
            ...prev,
            {
              id: uid("msg"),
              role: "ai",
              name: displayedAiOrchestrator().name,
              body: "지금은 자동 반영에 실패했습니다. 다시 시도해 주세요.",
            },
          ]);
          setReplying(false);
          return;
        }

        const nextFlow = json.data.updatedFlow;
        onChangeFlow(nextFlow);

        const nextQ = String(json.data.nextQuestion ?? "").trim();
        if (nextQ) setLatestAiQuestion(nextQ);

        const replies = Array.isArray(json.data.quickReplies)
          ? json.data.quickReplies.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 3)
          : [];
        setQuickReplies(replies.length ? replies : null);

        const aiBody = [String(json.data.assistantMessage ?? "").trim(), nextQ].filter(Boolean).join("\n");
        const done = !nextQ && Boolean(json.data.readiness?.readyForNext);
        setMessages((prev) => [
          ...prev,
          {
            id: uid("msg"),
            role: "ai",
            name: displayedAiOrchestrator().name,
            body:
              (aiBody || "반영했습니다.") +
              (done ? "\n\n기본 운영 흐름이 정리되었습니다.\n추가 수정사항이 있으면 말씀해 주세요." : ""),
          },
        ]);
        setReplying(false);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: uid("msg"), role: "ai", name: displayedAiOrchestrator().name, body: "지금은 자동 반영에 실패했습니다. 다시 시도해 주세요." },
        ]);
        setReplying(false);
      }
    })();
  };

  const sendMessage = () => {
    const body = input.trim();
    if (!body) return;
    setInput("");
    callAnalyze(body);
  };

  useEffect(() => {
    // On first entry: immediately start guided interview (no blank-input requirement).
    if (replying) return;
    if (messages.length > 0) return;
    const t = window.setTimeout(() => {
      const hasSteps = Boolean(flow?.steps?.length);
      if (hasSteps) {
        const list = normalizeOrder(flow?.steps ?? [])
          .slice(0, 8)
          .map((s) => `${s.order}. ${s.title}`)
          .join("\n");
        setMessages((prev) => [
          ...prev,
          {
            id: uid("msg"),
            role: "ai",
            name: displayedAiOrchestrator().name,
            body: `아이디어 구체화 단계에서 다음 흐름이 정리되었습니다.\n\n${list}\n\n이 흐름에서 누락되었거나 수정할 단계가 있습니까?`,
          },
        ]);
        return;
      }
      if ((ideationAssets?.length ?? 0) > 0) {
        callAnalyze("아이디어 구체화 내용을 기반으로 초안 생성", { silentUserAppend: true });
        return;
      }
      callAnalyze("서비스 흐름 인터뷰 시작", { silentUserAppend: true });
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestOrganize = () => {
    setToolsOpen(false);
    setReplying(true);
    void (async () => {
      const excerpt = [...messages, { id: "tmp", role: "user" as const, name: "사용자", body: "(정리 요청)" }]
        .slice(-24)
        .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.body}`)
        .join("\n")
        .slice(0, 12000);
      try {
        const res = await fetch("/api/requirements/service-flow-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            projectName,
            projectDescription,
            ideationAssets,
            userMessage: "정리 요청: 지금까지의 대화와 기존 초안을 바탕으로 액터/흐름/담당 매핑을 최신 상태로 다시 정리해 주세요.",
            recentMessages: excerpt,
            latestAiQuestion,
            currentFlow: flow,
          }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          data?: { updatedFlow?: RequirementsServiceFlowV1; assistantMessage?: string; nextQuestion?: string | null };
          message?: string;
        };
        if (!res.ok || !json.success || !json.data?.updatedFlow) {
          setMessages((prev) => [
            ...prev,
            { id: uid("msg"), role: "ai", name: displayedAiOrchestrator().name, body: "지금은 자동 반영에 실패했습니다. 다시 시도해 주세요." },
          ]);
          setReplying(false);
          return;
        }
        onChangeFlow(json.data.updatedFlow);
        const nextQ = String(json.data?.nextQuestion ?? "").trim();
        if (nextQ) setLatestAiQuestion(nextQ);
        setQuickReplies(null);
        setMessages((prev) => [
          ...prev,
          {
            id: uid("msg"),
            role: "ai",
            name: displayedAiOrchestrator().name,
            body: [String(json.data?.assistantMessage ?? "").trim() || "정리했습니다.", nextQ].filter(Boolean).join("\n"),
          },
        ]);
        // After successful organize, open result view automatically.
        setCanvasOpen(true);
        setReplying(false);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: uid("msg"), role: "ai", name: displayedAiOrchestrator().name, body: "자동 정리에 실패했습니다. 다시 시도해주세요." },
        ]);
        setReplying(false);
      }
    })();
  };

  return (
    <section
      className="jyo-service-flow-stage"
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        minWidth: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @media (max-width: 760px) {
          .jyo-service-flow-stage-shell {
            grid-template-columns: minmax(0, 1fr) !important;
            overflow-y: auto !important;
          }
          .jyo-service-flow-stage-members {
            min-height: 180px !important;
          }
        }
        .jyo-service-flow-stage-shell {
          height: 100%;
        }
        .jyo-service-flow-stage input,
        .jyo-service-flow-stage select {
          box-sizing: border-box;
          max-width: 100%;
        }
      `}</style>
      <ScreenLabel label="요구사항-서비스흐름-아이디어형워크숍" visible={showScreenLabels} />

      <div
        className="jyo-service-flow-stage-shell"
        style={{
          ...shell,
          gridTemplateColumns: chatExpanded ? "minmax(0, 1fr)" : "220px minmax(0, 1fr)",
          height: "100%",
        }}
      >
        {!chatExpanded ? (
        <aside className="jyo-service-flow-stage-members" style={memberSidebar} aria-label="참여 멤버">
          <div style={{ position: "relative", padding: "12px 12px 8px" }}>
            <ScreenLabel label="요구사항-서비스흐름-참여멤버" visible={showScreenLabels} />
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.02em", textTransform: "uppercase" }}>참여 멤버</div>
          </div>
          <div role="list" style={{ flex: "1 1 auto", overflowY: "auto", padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
            {participants.map((p) => <MemberCard key={p.id} member={p} />)}
          </div>
          <div style={{ padding: "10px 10px 12px", borderTop: "1px solid #e2e8f0", background: "rgba(255,255,255,0.65)" }}>
            <button type="button" onClick={onInviteMember} style={{ ...btn, width: "100%" }}>
              멤버 초대
            </button>
          </div>
        </aside>
        ) : null}

        <main className="jyo-service-flow-chat-shell" style={chatWrap} aria-label="협업 채팅">
          <div
            style={{
              flex: "0 0 auto",
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              position: "sticky",
              top: 0,
              zIndex: 6,
              background: "rgba(248,250,252,0.92)",
              backdropFilter: "blur(8px)",
              borderBottom: "1px solid rgba(226,232,240,0.75)",
            }}
          >
            <div style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 900, color: "#0f172a" }}>
              서비스 흐름 준비도 {derivedApproval.progressPercent}%{hint ? ` (${hint})` : ""} · {derivedApproval.filledSlotCount}/8
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setCanvasOpen(true)}
                disabled={!(actors.length || steps.length)}
                style={{ ...btn, opacity: actors.length || steps.length ? 1 : 0.55 }}
              >
                결과물 보기
              </button>
              <button
                type="button"
                onClick={() => {
                  onApproveAll();
                  goNextStage();
                }}
                disabled={!derivedApproval.ready}
                style={{ ...primaryBtn, opacity: derivedApproval.ready ? 1 : 0.55 }}
              >
                확정
              </button>
              <button
                type="button"
                onClick={() => setChatExpanded((v) => !v)}
                aria-label={chatExpanded ? "채팅 축소" : "채팅 확대"}
                title={chatExpanded ? "채팅 축소" : "채팅 확대"}
                style={{
                  border: "1px solid #cbd5e1",
                  background: chatExpanded ? "#f0fdfa" : "#fff",
                  borderRadius: 10,
                  width: 36,
                  height: 36,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0f172a",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <ExpandIcon expanded={chatExpanded} />
              </button>
            </div>
          </div>

          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "12px 20px 14px", display: "grid", gap: 10, alignContent: "start" }}>
            {!ideationReady ? (
              <div style={{ border: "1px solid #fde68a", borderRadius: 14, padding: 12, background: "#fffbeb", maxWidth: 620 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", lineHeight: 1.5 }}>{ideationReadyNotice}</div>
                <button type="button" onClick={onRetryGate} style={{ ...btn, marginTop: 8 }}>다시 확인</button>
              </div>
            ) : null}
            {messages.map((message) => (
              <div key={message.id} style={{ ...messageTone(message.role), border: "1px solid", borderRadius: 14, padding: "10px 12px", maxWidth: message.role === "user" ? "78%" : 620, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
                <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 900, color: "#64748b" }}>
                  {message.role === "user"
                    ? "사용자"
                    : message.role === "member"
                      ? `멤버 · ${message.name}`
                      : message.role === "expert"
                        ? `업무 전문가 · ${message.name}`
                        : `AI · ${showInternalAgents ? message.name : displayedAiOrchestrator().name}`}
                </div>
                <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{message.body}</div>
              </div>
            ))}
            {replying ? <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>AI 기획자가 반영 중입니다...</div> : null}
          </div>

        {quickReplies && quickReplies.length && !replying ? (
          <div style={{ flex: "0 0 auto", padding: "0 20px 10px" }}>
            <div style={{ maxWidth: 660, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {quickReplies.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => callAnalyze(label)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    borderRadius: 999,
                    padding: "10px 12px",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!replying && (!quickReplies || !quickReplies.length) ? (
          <div style={{ flex: "0 0 auto", padding: "0 20px 10px" }}>
            <div style={{ maxWidth: 660, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(steps.length >= 1
                ? [
                    { label: "단계 수정", action: () => callAnalyze("단계 수정이 필요합니다. 수정할 단계와 변경 내용을 반영해 주세요.") },
                    { label: "담당 지정", action: () => callAnalyze("각 단계 담당자를 지정하려고 합니다. 단계별 담당을 제안하고 primaryActorId로 반영해 주세요.") },
                    { label: "승인 추가", action: () => callAnalyze("승인/확정 단계가 필요합니다. 승인 단계를 흐름에 추가하고 담당도 지정해 주세요.") },
                    { label: "예외 흐름", action: () => callAnalyze("수정 요청/반려 같은 예외 흐름이 필요합니다. 예외 단계를 흐름에 반영해 주세요.") },
                    { label: "결과 확인", action: () => setCanvasOpen(true) },
                  ]
                : [
                    { label: "액터 추가", action: () => callAnalyze("액터를 추가해 주세요. 사람 액터와 시스템 액터를 분리해 정리해 주세요.") },
                    { label: "흐름 정리", action: () => callAnalyze("주요 서비스 흐름을 3단계 이상으로 정리해 주세요. 각 단계 제목/목적/담당을 포함해 주세요.") },
                    { label: "결과 확인", action: () => setCanvasOpen(true) },
                  ]
              ).map((it) => (
                <button
                  key={it.label}
                  type="button"
                  onClick={it.action}
                  style={{
                    border: "1px solid #dbeafe",
                    background: "#fff",
                    borderRadius: 999,
                    padding: "9px 12px",
                    fontSize: 12.5,
                    fontWeight: 900,
                    color: "#1e40af",
                    cursor: "pointer",
                  }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

          {canvasOpen ? (
            <DraftCanvas
              actors={actors}
              humans={humans}
              systems={systems}
              steps={steps}
              selectedStep={selectedStep}
              resultTab={resultTab}
                approval={derivedApproval}
              actorName={actorName}
              onClose={() => setCanvasOpen(false)}
              onSelectTab={setResultTab}
              onSelectStep={setSelectedStepId}
              onUpdateStep={updateStep}
            />
          ) : null}

          <div className="jyo-service-flow-composer-shell" style={{ flex: "0 0 auto", padding: "14px 20px 18px", background: "linear-gradient(180deg, rgba(248,250,252,0), #f8fafc 30%)" }}>
            <div style={{ maxWidth: 660, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, border: "1px solid #e2e8f0", borderRadius: 20, background: "#fff", padding: 10, boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setToolsOpen((v) => !v)}
                  aria-label="도구 열기"
                  style={{ width: 42, height: 42, borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", color: "#0f172a", fontSize: 24, lineHeight: 1, cursor: "pointer" }}
                >
                  +
                </button>
                {toolsOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      bottom: 52,
                      width: 200,
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      boxShadow: "0 18px 50px -24px rgba(15, 23, 42, 0.22)",
                      padding: 8,
                      zIndex: 20,
                    }}
                    role="menu"
                  >
                    <button type="button" onClick={requestOrganize} style={{ ...btn, width: "100%", textAlign: "left" }}>
                      정리 요청
                    </button>
                    <div style={{ height: 6 }} />
                    <button
                      type="button"
                      onClick={() => {
                        setToolsOpen(false);
                        setCanvasOpen(true);
                      }}
                      disabled={!(actors.length || steps.length)}
                      style={{ ...btn, width: "100%", textAlign: "left", opacity: actors.length || steps.length ? 1 : 0.55 }}
                    >
                      결과물 보기
                    </button>
                  </div>
                ) : null}
              </div>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="메시지를 입력하세요"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", borderRadius: 14, background: "#f1f5f9", padding: "14px 16px", fontSize: 14 }}
              />
              <button type="button" onClick={sendMessage} aria-label="전송" style={{ width: 46, height: 46, borderRadius: 999, border: "1px solid #0f766e", background: "#0f766e", color: "#fff", fontSize: 18, fontWeight: 900, cursor: "pointer" }}>
                ▶
              </button>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}

function MemberCard({ member }: { readonly member: ServiceFlowParticipant }) {
  const parts = [member.roleLabel, member.connection, member.lastResponse].filter(Boolean).join(" · ");
  return (
    <div role="listitem" style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</div>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#64748b", marginTop: 3, lineHeight: 1.35, wordBreak: "break-word" }}>{parts}</div>
    </div>
  );
}

function ExpandIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      {expanded ? (
        <>
          <path d="M9 3H5a2 2 0 0 0-2 2v4" />
          <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
          <path d="M3 9l7-7" />
          <path d="M21 15l-7 7" />
        </>
      ) : (
        <>
          <path d="M15 3h4a2 2 0 0 1 2 2v4" />
          <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
          <path d="M21 9l-7-7" />
          <path d="M3 15l7 7" />
        </>
      )}
    </svg>
  );
}

// DraftSummaryCard removed: chat is Q/A only. Results are viewed via "결과물 보기".

function DraftCanvas({
  actors,
  humans,
  systems,
  steps,
  selectedStep,
  resultTab,
  approval,
  actorName,
  onClose,
  onSelectTab,
  onSelectStep,
  onUpdateStep,
}: {
  readonly actors: readonly RequirementsServiceFlowActorV1[];
  readonly humans: readonly RequirementsServiceFlowActorV1[];
  readonly systems: readonly RequirementsServiceFlowActorV1[];
  readonly steps: readonly RequirementsServiceFlowStepV1[];
  readonly selectedStep: RequirementsServiceFlowStepV1 | null;
  readonly resultTab: ResultTab;
  readonly approval: ApprovalState;
  readonly actorName: (id: string) => string;
  readonly onClose: () => void;
  readonly onSelectTab: (tab: ResultTab) => void;
  readonly onSelectStep: (id: string) => void;
  readonly onUpdateStep: (id: string, patch: Partial<RequirementsServiceFlowStepV1>) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="액터 및 서비스 흐름 초안 캔버스"
      style={{
        position: "absolute",
        inset: "58px 18px 92px",
        zIndex: 5,
        border: "1px solid #bfdbfe",
        borderRadius: 20,
        background: "#eff6ff",
        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: "0 0 auto", padding: "14px 16px", borderBottom: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>액터 및 서비스 흐름 초안</div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "#64748b" }}>
            서비스 흐름 준비도 {approval.progressPercent}%{progressHint(approval) ? ` (${progressHint(approval)})` : ""} · {approval.filledSlotCount}/8
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ ...btn, borderRadius: 999 }}>
            닫기
          </button>
        </div>
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: 16 }}>
        <ResultCard
          actors={actors}
          humans={humans}
          systems={systems}
          steps={steps}
          selectedStep={selectedStep}
          resultTab={resultTab}
          approval={approval}
          actorName={actorName}
          onSelectTab={onSelectTab}
          onSelectStep={onSelectStep}
          onUpdateStep={onUpdateStep}
        />
      </div>
    </div>
  );
}

function ResultCard({
  actors,
  humans,
  systems,
  steps,
  selectedStep,
  resultTab,
  approval,
  actorName,
  onSelectTab,
  onSelectStep,
  onUpdateStep,
}: {
  readonly actors: readonly RequirementsServiceFlowActorV1[];
  readonly humans: readonly RequirementsServiceFlowActorV1[];
  readonly systems: readonly RequirementsServiceFlowActorV1[];
  readonly steps: readonly RequirementsServiceFlowStepV1[];
  readonly selectedStep: RequirementsServiceFlowStepV1 | null;
  readonly resultTab: ResultTab;
  readonly approval: ApprovalState;
  readonly actorName: (id: string) => string;
  readonly onSelectTab: (tab: ResultTab) => void;
  readonly onSelectStep: (id: string) => void;
  readonly onUpdateStep: (id: string, patch: Partial<RequirementsServiceFlowStepV1>) => void;
}) {
  const previewActors = useMemo(
    () =>
      actors.map((a) => ({
        name: a.name,
        role: a.kind === "human" ? "사람 액터" : "시스템 액터",
      })),
    [actors]
  );
  const previewSteps = useMemo(
    () =>
      steps.map((s) => ({
        title: s.title,
        owner: s.primaryActorId ? actorName(s.primaryActorId) : undefined,
      })),
    [steps, actorName]
  );

  return (
    <div style={{ maxWidth: 680, border: "1px solid #bfdbfe", borderRadius: 16, background: "#eff6ff", padding: 14, display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>액터 · 서비스 흐름 · 담당 매핑</div>
        <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "#475569", lineHeight: 1.45 }}>
          사용자가 이해하기 쉬운 3가지 정보만 보여줍니다. (내부 메타 정보는 숨김)
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <TabButton active={resultTab === "actors"} onClick={() => onSelectTab("actors")}>액터</TabButton>
        <TabButton active={resultTab === "flow"} onClick={() => onSelectTab("flow")}>서비스 흐름</TabButton>
        <TabButton active={resultTab === "mapping"} onClick={() => onSelectTab("mapping")}>담당 매핑</TabButton>
        <TabButton active={resultTab === "preview"} onClick={() => onSelectTab("preview")}>프로토타입 미리보기</TabButton>
      </div>
      {actors.length || steps.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {resultTab === "actors" ? (
            <div style={{ display: "grid", gap: 6 }}>
              {actors.map((actor) => (
                <div key={actor.id} style={{ border: "1px solid #dbeafe", borderRadius: 12, padding: 10, background: "#fff" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>{actor.name}</div>
                  {actor.description ? <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.45, color: "#64748b" }}>{actor.description}</div> : null}
                </div>
              ))}
            </div>
          ) : resultTab === "flow" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onSelectStep(step.id)}
                  style={{
                    textAlign: "left",
                    border: selectedStep?.id === step.id ? "2px solid #0f766e" : "1px solid #dbeafe",
                    borderRadius: 14,
                    background: selectedStep?.id === step.id ? "#ecfdf5" : "#fff",
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "28px minmax(0, 1fr)",
                    gap: 10,
                    alignItems: "start",
                  }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: 999, background: "#0f766e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>
                    {step.order}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>{step.title}</div>
                    <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.45, color: "#475569" }}>{step.purpose}</div>
                    {step.primaryActorId ? (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#64748b" }}>담당: {actorName(step.primaryActorId)}</div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : resultTab === "mapping" ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "#fff", border: "1px solid #dbeafe", borderRadius: 14, overflow: "hidden" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 12, fontWeight: 900, color: "#64748b", padding: "10px 12px", borderBottom: "1px solid #dbeafe", background: "#f8fafc" }}>단계</th>
                    <th style={{ textAlign: "left", fontSize: 12, fontWeight: 900, color: "#64748b", padding: "10px 12px", borderBottom: "1px solid #dbeafe", background: "#f8fafc" }}>담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step) => (
                    <tr key={step.id}>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eef2ff", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                        {step.order}. {step.title}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #eef2ff" }}>
                        <select
                          value={step.primaryActorId}
                          onChange={(e) => onUpdateStep(step.id, { primaryActorId: e.target.value })}
                          style={{ width: "100%", borderRadius: 10, border: "1px solid #bfdbfe", padding: "8px 10px", fontSize: 13, background: "#fff" }}
                        >
                          <option value="">담당자 선택</option>
                          {actors.map((actor) => (
                            <option key={actor.id} value={actor.id}>
                              {actor.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ borderRadius: 14, border: "1px solid #dbeafe", background: "#fff", padding: 12 }}>
              <PrototypePreviewPanel
                projectName={undefined}
                projectDescription={undefined}
                actors={previewActors}
                flowSteps={previewSteps}
              />
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 12, border: "1px dashed #bfdbfe", borderRadius: 12, background: "#fff", fontSize: 13, fontWeight: 700, color: "#64748b", lineHeight: 1.5 }}>
          AI 초안 생성을 누르면 액터, 서비스 흐름, 담당 매핑이 여기에 카드로 표시됩니다.
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { readonly active: boolean; readonly onClick: () => void; readonly children: string }) {
  return (
    <button type="button" onClick={onClick} style={{ border: active ? "1px solid #0f766e" : "1px solid #dbeafe", background: active ? "#ecfdf5" : "#fff", color: active ? "#0f766e" : "#475569", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
      {children}
    </button>
  );
}

// (ActorGroup/StepCard removed) — UI simplified to 3 tabs only.
