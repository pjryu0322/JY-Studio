"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PrototypePreviewDraggableShell } from "@/components/preview/PrototypePreviewDraggableShell";
import { PrototypePreviewPanel } from "@/components/preview/PrototypePreviewPanel";
import {
  buildFlowFingerprintJson,
  buildIdeationFingerprint,
  computeDesignFingerprint,
} from "@/lib/prototype/prototypeGenerationLocalStore";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { displayedAiOrchestrator, displayedAiStatusForStage, showInternalAgents } from "@/lib/ai-member/visibleAiOrchestrator";
import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
  RequirementsServiceFlowChecklistDeferralKind,
} from "@/lib/requirements/requirementsStateJson";
import { REQUIREMENTS_SERVICE_FLOW_CHECKLIST_KEYS } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { newChatMessage, VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import { SERVICE_FLOW_WORKSHOP_INTERNAL_TYPE } from "@/lib/requirements/serviceFlowConversation";

type WorkshopRole = "ai" | "expert" | "member" | "user";
type WorkspaceMode = "chat" | "mapping" | "summary";
type ServiceFlowSlotKey = (typeof REQUIREMENTS_SERVICE_FLOW_CHECKLIST_KEYS)[number];

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
const RECOMMENDED_SLOTS: readonly ServiceFlowSlotKey[] = ["approvalStep", "exceptionFlow"];
const DECISION_SLOTS: readonly ServiceFlowSlotKey[] = [...REQUIRED_SLOTS, ...RECOMMENDED_SLOTS];

function stepTitleContainsAny(steps: readonly RequirementsServiceFlowStepV1[], re: RegExp): boolean {
  return steps.some((s) => re.test(String(s.title ?? "").trim()));
}

function computeDecisionResolution(input: {
  flow: RequirementsServiceFlowV1 | null;
  derivedSlots: Record<ServiceFlowSlotKey, boolean>;
  deferrals: Partial<Record<ServiceFlowSlotKey, RequirementsServiceFlowChecklistDeferralKind>> | null | undefined;
}): {
  requiredUnresolved: ServiceFlowSlotKey[];
  optionalUnresolved: ServiceFlowSlotKey[];
  headerLabel: string;
  headerCount: number;
  helperLine: string | null;
} {
  const { flow, derivedSlots, deferrals } = input;
  const steps = flow?.steps ?? [];

  const approvalResolved =
    Boolean(deferrals?.approvalStep) ||
    stepTitleContainsAny(steps, /승인|확정|결재/i) ||
    Boolean(derivedSlots.approvalStep);

  const exceptionResolved =
    Boolean(deferrals?.exceptionFlow) ||
    stepTitleContainsAny(steps, /수정|반려|재처리|예외/i) ||
    Boolean(derivedSlots.exceptionFlow);

  const resolved: Record<ServiceFlowSlotKey, boolean> = {
    ...derivedSlots,
    approvalStep: approvalResolved,
    exceptionFlow: exceptionResolved,
  };

  const requiredUnresolved = REQUIRED_SLOTS.filter((k) => !resolved[k] && !deferrals?.[k]);
  const optionalUnresolved = RECOMMENDED_SLOTS.filter((k) => !resolved[k] && !deferrals?.[k]);

  if (requiredUnresolved.length > 0) {
    return {
      requiredUnresolved,
      optionalUnresolved,
      headerLabel: "남은 결정사항",
      headerCount: requiredUnresolved.length,
      helperLine: null,
    };
  }
  if (optionalUnresolved.length > 0) {
    return {
      requiredUnresolved,
      optionalUnresolved,
      headerLabel: "권장 검토사항",
      headerCount: optionalUnresolved.length,
      helperLine: "남은 결정사항 0개 (권장 항목 미정)",
    };
  }
  return {
    requiredUnresolved,
    optionalUnresolved,
    headerLabel: "남은 결정사항 없음",
    headerCount: 0,
    helperLine: null,
  };
}

function countEffectiveRemainingSlots(
  slots: Record<ServiceFlowSlotKey, boolean>,
  deferrals: Partial<Record<ServiceFlowSlotKey, RequirementsServiceFlowChecklistDeferralKind>> | null | undefined,
): number {
  let n = 0;
  for (const k of DECISION_SLOTS) {
    if (!slots[k] && !deferrals?.[k]) n += 1;
  }
  return n;
}

function unresolvedChecklistEntries(
  slots: Record<ServiceFlowSlotKey, boolean>,
  deferrals: Partial<Record<ServiceFlowSlotKey, RequirementsServiceFlowChecklistDeferralKind>> | null | undefined,
): Array<{ key: ServiceFlowSlotKey; label: string; deferral?: RequirementsServiceFlowChecklistDeferralKind }> {
  const rows: Array<{ key: ServiceFlowSlotKey; label: string; deferral?: RequirementsServiceFlowChecklistDeferralKind }> = [];
  for (const k of DECISION_SLOTS) {
    if (slots[k]) continue;
    rows.push({ key: k, label: SLOT_LABELS[k], deferral: deferrals?.[k] });
  }
  return rows;
}

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
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
};

const headerMetricBadgeLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  letterSpacing: "0.01em",
};

function uid(prefix: string): string {
  try {
    return `${prefix}:${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)}`;
  } catch {
    return `${prefix}:${Math.random().toString(16).slice(2)}`;
  }
}

function workshopMessageFromPersisted(m: RequirementsMessage, aiDisplayName: string): WorkshopMessage {
  const body = String(m.content ?? "").trim();
  if (m.role === "user") {
    return { id: m.id, role: "user", name: "사용자", body };
  }
  if (m.role === "human") {
    return { id: m.id, role: "member", name: (m.speakerName || "멤버").trim() || "멤버", body };
  }
  if (m.role === "ai") {
    const name = showInternalAgents ? (m.speakerName || aiDisplayName).trim() || aiDisplayName : aiDisplayName;
    return { id: m.id, role: "ai", name, body };
  }
  return { id: m.id, role: "expert", name: (m.speakerName || "시스템").trim() || "시스템", body };
}

function buildServiceFlowUserPersist(body: string, currentUserId: string | null): RequirementsMessage {
  return newChatMessage({
    role: "user",
    body,
    speakerType: "USER",
    speakerId: currentUserId?.trim() || "me",
    messageType: "STATEMENT",
    meta: { internalType: SERVICE_FLOW_WORKSHOP_INTERNAL_TYPE },
  });
}

function buildServiceFlowAiPersist(body: string): RequirementsMessage {
  const name = displayedAiOrchestrator().name;
  return newChatMessage({
    role: "ai",
    body,
    speakerType: "AI",
    speakerId: VIRTUAL_AI_PLANNER_ID,
    speakerName: name,
    messageType: "ANSWER",
    meta: { internalType: SERVICE_FLOW_WORKSHOP_INTERNAL_TYPE },
  });
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
    accessControl: "권한 범위는 다음 단계에서 정리합니다.",
    handoffToFeatures: "기능 후보는 다음 기능 정리 단계에서 정리합니다.",
  };
  return DECISION_SLOTS
    .filter((slot) => !slots[slot])
    .slice(0, limit)
    .map((slot) => questions[slot]);
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
  if (!slots.exceptionFlow) return "예외/수정 흐름 미확정";
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
    // 다음 단계(기능정리)에서 다룰 항목: 이 단계의 remaining decisions에 포함하지 않는다.
    accessControl: true,
    handoffToFeatures: true,
  };
  const filledSlotCount = DECISION_SLOTS.filter((k) => slots[k]).length;
  const basePercent = Math.round((filledSlotCount / DECISION_SLOTS.length) * 100);
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
    },
  };
}

function recommendPrimaryActorIdForStep(
  step: { title: string; purpose: string; primaryActorId: string },
  actors: readonly RequirementsServiceFlowActorV1[],
): string {
  const humans = actors.filter((a) => a.kind === "human");
  const systems = actors.filter((a) => a.kind === "system");
  const humanFirst = humans[0]?.id ?? actors[0]?.id ?? "";
  const systemFirst = systems[0]?.id ?? actors.find((a) => a.kind === "system")?.id ?? actors[0]?.id ?? "";
  const text = `${step.title} ${step.purpose}`;
  if (/(업로드|등록|제출|입력|선택)/.test(text)) return humanFirst || step.primaryActorId;
  if (/(변환|생성|분리|OCR|AI|자동|처리)/i.test(text)) return systemFirst || step.primaryActorId;
  if (/(수정|보완|검토|작성)/.test(text)) return humanFirst || step.primaryActorId;
  if (/(승인|확정|결재)/.test(text)) return humanFirst || step.primaryActorId;
  if (/(공유|배포|열람|알림|발송)/.test(text)) return (humans[humans.length - 1]?.id ?? humanFirst) || step.primaryActorId;
  return step.primaryActorId || humanFirst || systemFirst;
}

function applyRecommendedPrimaryActors(flow: RequirementsServiceFlowV1): RequirementsServiceFlowV1 {
  const now = new Date().toISOString();
  const nextSteps = flow.steps.map((s) => ({
    ...s,
    primaryActorId: recommendPrimaryActorIdForStep(s, flow.actors),
    approved: false,
    updatedAt: now,
  }));
  return { ...flow, steps: normalizeOrder(nextSteps), updatedAt: now };
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
  persistedServiceFlowMessages,
  onAppendPersistedServiceFlowMessages,
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
  readonly persistedServiceFlowMessages: readonly RequirementsMessage[];
  readonly onAppendPersistedServiceFlowMessages: (
    incoming: readonly RequirementsMessage[],
  ) => Promise<readonly RequirementsMessage[]>;
}) {
  void onGenerateAiDraft;
  void approval;
  const showScreenLabels = useShowScreenLabels();
  const aiDisplayName = displayedAiOrchestrator().name;
  const displayMessages = useMemo(
    () => persistedServiceFlowMessages.map((m) => workshopMessageFromPersisted(m, aiDisplayName)),
    [persistedServiceFlowMessages, aiDisplayName],
  );
  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[] | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("chat");
  const [remainingPanelOpen, setRemainingPanelOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [latestAiQuestion, setLatestAiQuestion] = useState<string>("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [prototypePreviewOpen, setPrototypePreviewOpen] = useState(false);

  const derivedApproval = useMemo(() => deriveApprovalFromFlow(flow), [flow]);
  const hint = progressHint(derivedApproval);
  const structureLocked = Boolean(flow?.structureLockedAt);
  const deferrals = flow?.checklistDeferrals ?? null;
  const decision = useMemo(
    () => computeDecisionResolution({ flow, derivedSlots: derivedApproval.slots, deferrals }),
    [flow, derivedApproval.slots, deferrals],
  );
  const remainingChecklistItems = decision.headerCount;
  const chatActive = workspaceMode === "chat";
  const mappingActive = workspaceMode === "mapping";
  const summaryActive = workspaceMode === "summary";

  const slotResolveUserMessages: Record<ServiceFlowSlotKey, string> = {
    humanActors: "사람 액터를 누가 쓰는지 정리해 주세요. 액터 목록을 사람/시스템으로 나눠 반영해 주세요.",
    systemActors: "시스템이 처리하는 역할을 액터로 정리해 주세요. 시스템 액터를 추가해 주세요.",
    mainFlow: "주요 서비스 흐름을 3단계 이상으로 다시 정리해 주세요.",
    actorResponsibility: "각 단계의 주 담당(primaryActorId)을 흐름에 맞게 반영해 주세요.",
    approvalStep: "승인/확정 단계가 필요한지와 담당을 흐름에 반영해 주세요.",
    exceptionFlow: "예외·수정·반려 같은 예외 흐름을 흐름 설명에 반영해 주세요.",
    accessControl: "권한 범위는 다음 기능정리 단계에서 진행됩니다.",
    handoffToFeatures: "세부 기능 정의는 다음 기능정리 단계에서 진행됩니다.",
  };

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollPendingRef = useRef(false);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollChatToBottom = () => {
    autoScrollPendingRef.current = true;
    window.requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      autoScrollPendingRef.current = false;
    });
  };

  const resizeComposer = () => {
    const el = composerTextareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };
  useEffect(() => {
    resizeComposer();
  }, [input]);

  const messagesRef = useRef<WorkshopMessage[]>(displayMessages);
  const flowRef = useRef<RequirementsServiceFlowV1 | null>(flow);
  const latestAiQuestionRef = useRef<string>(latestAiQuestion);
  useEffect(() => {
    messagesRef.current = displayMessages;
  }, [displayMessages]);
  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);
  useEffect(() => {
    latestAiQuestionRef.current = latestAiQuestion;
  }, [latestAiQuestion]);

  const actors = flow?.actors ?? [];
  const steps = useMemo(() => normalizeOrder(flow?.steps ?? []), [flow?.steps]);
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

  const lockStructureForAssignment = () => {
    if (!flow) return;
    const now = new Date().toISOString();
    const next = applyRecommendedPrimaryActors({ ...flow, updatedAt: now });
    onChangeFlow({ ...next, structureLockedAt: now, updatedAt: now });
    setQuickReplies(null);
    setLatestAiQuestion("");
    setWorkspaceMode("mapping");
    autoScrollPendingRef.current = true;
  };

  const patchChecklistDeferral = (key: ServiceFlowSlotKey, kind: RequirementsServiceFlowChecklistDeferralKind | null) => {
    if (!flow) return;
    const now = new Date().toISOString();
    const next: Partial<Record<ServiceFlowSlotKey, RequirementsServiceFlowChecklistDeferralKind>> = { ...(flow.checklistDeferrals ?? {}) };
    if (kind === null) delete next[key];
    else next[key] = kind;
    const checklistDeferrals = Object.keys(next).length ? next : null;
    onChangeFlow({ ...flow, checklistDeferrals, updatedAt: now });
  };

  const optionalDecisionQuickActions = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {!decision.requiredUnresolved.length && decision.optionalUnresolved.includes("approvalStep") ? (
        <button type="button" onClick={() => patchChecklistDeferral("approvalStep", "pending")} style={btn}>
          승인 단계 없음
        </button>
      ) : null}
      {!decision.requiredUnresolved.length && decision.optionalUnresolved.includes("exceptionFlow") ? (
        <button type="button" onClick={() => patchChecklistDeferral("exceptionFlow", "pending")} style={btn}>
          예외 흐름 없음
        </button>
      ) : null}
      {!decision.requiredUnresolved.length && decision.optionalUnresolved.length ? (
        <button
          type="button"
          onClick={() => {
            for (const k of decision.optionalUnresolved) patchChecklistDeferral(k, "deferred_next");
          }}
          style={btn}
        >
          다음 단계에서 검토
        </button>
      ) : null}
    </div>
  );

  const approveAllMappingOwners = () => {
    if (!flow) return;
    const now = new Date().toISOString();
    onChangeFlow({
      ...flow,
      steps: normalizeOrder(
        flow.steps.map((s) => ({
          ...s,
          approved: Boolean(s.primaryActorId),
          updatedAt: now,
        })),
      ),
      updatedAt: now,
    });
  };

  const reapplyRecommendedOwners = () => {
    if (!flow?.structureLockedAt) return;
    const now = new Date().toISOString();
    const next = applyRecommendedPrimaryActors({ ...flow, updatedAt: now });
    onChangeFlow({ ...next, structureLockedAt: flow.structureLockedAt ?? now, updatedAt: now });
  };

  useEffect(() => {
    if (flow?.structureLockedAt) return;
    if (draftGenerationCount <= 0) return;
    const timer = window.setTimeout(() => {
      const qs = missingSlotQuestions(derivedApproval.slots, 3);
      const body =
        "초안을 준비했습니다. 수정할 부분만 말씀해 주세요.\n" +
        (qs.length ? `\n(빠르게 확인)\n${qs.map((q) => `- ${q}`).join("\n")}` : "");
      void onAppendPersistedServiceFlowMessages([buildServiceFlowAiPersist(body)]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftGenerationCount, derivedApproval.slots, flow?.structureLockedAt, onAppendPersistedServiceFlowMessages]);

  const actorName = (id: string) => actors.find((a) => a.id === id)?.name ?? id;

  const prototypePreviewFlowStepsDetailed = useMemo(
    () =>
      steps.map((s) => ({
        id: s.id,
        title: s.title,
        purpose: s.purpose,
        primaryActorId: s.primaryActorId,
        secondaryActorIds: s.secondaryActorIds,
      })),
    [steps],
  );
  const prototypePreviewActorsDetailed = useMemo(
    () =>
      actors.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        description: a.description,
      })),
    [actors],
  );

  const prototypeDesignFingerprint = useMemo(
    () =>
      computeDesignFingerprint({
        flowFingerprint: buildFlowFingerprintJson(flow),
        ideationFingerprint: buildIdeationFingerprint(ideationAssets),
        featureTitlesFingerprint: "",
      }),
    [flow, ideationAssets],
  );

  const prototypeChecklistGapLabels = useMemo(
    () =>
      unresolvedChecklistEntries(derivedApproval.slots, deferrals)
        .filter((row) => !row.deferral)
        .map((row) => `${row.label} 미정`),
    [derivedApproval.slots, deferrals],
  );

  const updateStep = (id: string, patch: Partial<RequirementsServiceFlowStepV1>) => {
    if (!flow) return;
    const now = new Date().toISOString();
    const nextSteps = flow.steps.map((s) => {
      if (s.id !== id) return s;
      const merged: RequirementsServiceFlowStepV1 = { ...s, ...patch, updatedAt: now };
      if (!("approved" in patch)) merged.approved = false;
      return merged;
    });
    onChangeFlow({ ...flow, steps: normalizeOrder(nextSteps), updatedAt: now });
  };

  const callAnalyze = (userMessageText: string, opts?: { silentUserAppend?: boolean }) => {
    if (workspaceMode !== "chat") return;
    const body = userMessageText.trim();
    if (!body) return;
    setReplying(true);
    setQuickReplies(null);

    void (async () => {
      try {
        if (!opts?.silentUserAppend) {
          autoScrollPendingRef.current = true;
          const userPersisted = buildServiceFlowUserPersist(body, currentUserId);
          const nextSlice = await onAppendPersistedServiceFlowMessages([userPersisted]);
          messagesRef.current = nextSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
        }

        const transcript = [...(messagesRef.current ?? [])];
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
          autoScrollPendingRef.current = true;
          const errSlice = await onAppendPersistedServiceFlowMessages([
            buildServiceFlowAiPersist("지금은 자동 반영에 실패했습니다. 다시 시도해 주세요."),
          ]);
          messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
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
        autoScrollPendingRef.current = true;
        const combined =
          (aiBody || "반영했습니다.") +
          (done ? "\n\n기본 운영 흐름이 정리되었습니다.\n추가 수정사항이 있으면 말씀해 주세요." : "");
        const okSlice = await onAppendPersistedServiceFlowMessages([buildServiceFlowAiPersist(combined)]);
        messagesRef.current = okSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
        setReplying(false);
      } catch {
        autoScrollPendingRef.current = true;
        try {
          const errSlice = await onAppendPersistedServiceFlowMessages([
            buildServiceFlowAiPersist("지금은 자동 반영에 실패했습니다. 다시 시도해 주세요."),
          ]);
          messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
        } finally {
          setReplying(false);
        }
      }
    })();
  };

  const sendMessage = () => {
    if (workspaceMode !== "chat") return;
    const body = input.trim();
    if (!body) return;
    setInput("");
    callAnalyze(body);
    scrollChatToBottom();
  };

  const jumpToResolveSlot = (key: ServiceFlowSlotKey) => {
    setRemainingPanelOpen(false);
    if (key === "actorResponsibility" && flowRef.current?.structureLockedAt) {
      setWorkspaceMode("mapping");
      return;
    }
    setWorkspaceMode("chat");
    window.setTimeout(() => {
      callAnalyze(slotResolveUserMessages[key]);
    }, 0);
  };

  const bootOnceRef = useRef(false);
  useEffect(() => {
    if (flow?.structureLockedAt) return;
    if (workspaceMode !== "chat") return;
    // Boot message should NOT race with auto draft bootstrap (workspace-level).
    if (bootOnceRef.current) return;
    if (replying) return;
    if (persistedServiceFlowMessages.length > 0) return;
    if (!ideationReady) return;
    if (generatingDraft) return;

    const hasSteps = Boolean(flow?.steps?.length);
    const hasAnyFlow = Boolean(flow?.actors?.length || flow?.steps?.length);
    const hasIdeationAssets = (ideationAssets?.length ?? 0) > 0;

    if (hasSteps) {
      const list = normalizeOrder(flow?.steps ?? [])
        .slice(0, 8)
        .map((s) => `${s.order}. ${s.title}`)
        .join("\n");
      bootOnceRef.current = true;
      void onAppendPersistedServiceFlowMessages([
        buildServiceFlowAiPersist(
          `아이디어 구체화 단계에서 다음 흐름이 정리되었습니다.\n\n${list}\n\n이 흐름에서 누락되었거나 수정할 단계가 있습니까?`,
        ),
      ]);
      return;
    }

    // If ideation context exists but flow is still empty, wait for auto-bootstrap draft to populate state.
    if (hasIdeationAssets && !hasAnyFlow) return;

    bootOnceRef.current = true;
    callAnalyze("서비스 흐름 인터뷰 시작", { silentUserAppend: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot boot; including callAnalyze would retrigger unnecessarily
  }, [
    replying,
    persistedServiceFlowMessages.length,
    ideationReady,
    generatingDraft,
    flow?.steps?.length,
    flow?.actors?.length,
    ideationAssets?.length,
    flow?.structureLockedAt,
    workspaceMode,
    onAppendPersistedServiceFlowMessages,
  ]);

  useEffect(() => {
    if (!autoScrollPendingRef.current) return;
    scrollChatToBottom();
  }, [displayMessages.length, replying]);

  const requestOrganize = () => {
    if (workspaceMode !== "chat") return;
    setToolsOpen(false);
    setReplying(true);
    void (async () => {
      const excerpt = [...displayMessages, { id: "tmp", role: "user" as const, name: "사용자", body: "(정리 요청)" }]
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
          const errSlice = await onAppendPersistedServiceFlowMessages([
            buildServiceFlowAiPersist("지금은 자동 반영에 실패했습니다. 다시 시도해 주세요."),
          ]);
          messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
          setReplying(false);
          return;
        }
        onChangeFlow(json.data.updatedFlow);
        const nextQ = String(json.data?.nextQuestion ?? "").trim();
        if (nextQ) setLatestAiQuestion(nextQ);
        setQuickReplies(null);
        const okSlice = await onAppendPersistedServiceFlowMessages([
          buildServiceFlowAiPersist([String(json.data?.assistantMessage ?? "").trim() || "정리했습니다.", nextQ].filter(Boolean).join("\n")),
        ]);
        messagesRef.current = okSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
        setWorkspaceMode("summary");
        setReplying(false);
      } catch {
        try {
          const errSlice = await onAppendPersistedServiceFlowMessages([
            buildServiceFlowAiPersist("자동 정리에 실패했습니다. 다시 시도해주세요."),
          ]);
          messagesRef.current = errSlice.map((m) => workshopMessageFromPersisted(m, aiDisplayName));
        } finally {
          setReplying(false);
        }
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
        @keyframes jyo-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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

        <main className="jyo-service-flow-chat-shell" style={chatWrap} aria-label="액터 및 서비스 흐름 작업 영역">
          <div
            style={{
              flex: "0 0 auto",
              padding: "10px 20px 8px",
              position: "sticky",
              top: 0,
              zIndex: 6,
              background: "rgba(248,250,252,0.96)",
              backdropFilter: "blur(8px)",
              borderBottom: "1px solid rgba(226,232,240,0.75)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "nowrap",
                alignItems: "center",
                gap: 10,
                width: "100%",
                minWidth: 0,
                overflowX: "auto",
                overscrollBehaviorX: "contain",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "nowrap",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0f172a",
                  lineHeight: 1.35,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                <span title={hint ?? undefined}>
                  <span style={headerMetricBadgeLabel}>설계 완성도</span>{" "}
                  <span style={{ fontWeight: 900, fontSize: 15 }}>{derivedApproval.progressPercent}%</span>
                </span>
                <span style={{ color: "#cbd5e1", fontWeight: 500 }} aria-hidden>
                  |
                </span>
                {decision.requiredUnresolved.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setRemainingPanelOpen(true)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                      cursor: "pointer",
                      font: "inherit",
                      color: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span style={headerMetricBadgeLabel}>남은 결정사항</span>{" "}
                    <span style={{ fontWeight: 900, fontSize: 15, color: "#0369a1" }}>{decision.requiredUnresolved.length}개</span>
                  </button>
                ) : (
                  <span>
                    <span style={headerMetricBadgeLabel}>남은 결정사항</span>{" "}
                    <span style={{ fontWeight: 900, fontSize: 15 }}>0개</span>
                  </span>
                )}
              </div>
              <div style={{ flex: "1 1 8px", minWidth: 0 }} aria-hidden />
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

          <div
            ref={chatScrollRef}
            style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "12px 20px 14px", display: "grid", gap: 10, alignContent: "start" }}
          >
            {!ideationReady ? (
              <div style={{ border: "1px solid #fde68a", borderRadius: 14, padding: 12, background: "#fffbeb", maxWidth: 620 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", lineHeight: 1.5 }}>{ideationReadyNotice}</div>
                <button type="button" onClick={onRetryGate} style={{ ...btn, marginTop: 8 }}>다시 확인</button>
              </div>
            ) : null}
            {ideationReady && summaryActive ? (
              <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", display: "grid", gap: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>요약</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[액터]</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#0f172a", lineHeight: 1.55 }}>
                    {actors.map((a) => (
                      <li key={a.id}>
                        {a.name} ({a.kind === "human" ? "사람" : "시스템"})
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[서비스 흐름 {steps.length}단계]</div>
                  <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "#0f172a", lineHeight: 1.55 }}>
                    {steps.map((s) => (
                      <li key={s.id}>
                        {s.order}. {s.title}
                      </li>
                    ))}
                  </ol>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[담당자]</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#0f172a", lineHeight: 1.55 }}>
                    {steps.map((s) => (
                      <li key={s.id}>
                        {s.title} → {s.primaryActorId ? actorName(s.primaryActorId) : "미지정"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[준비 상태]</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: derivedApproval.ready ? "#065f46" : "#b45309" }}>
                    {derivedApproval.ready ? "필수 체크리스트 충족" : hint ?? "보완이 필요합니다"}
                  </div>
                </div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>[결정사항]</div>
                  {decision.requiredUnresolved.length === 0 && decision.optionalUnresolved.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#64748b" }}>남은 결정사항 없음</div>
                  ) : decision.requiredUnresolved.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      {decision.helperLine ?? "남은 결정사항 0개 (권장 항목 미정)"}
                      <div style={{ marginTop: 10 }}>{optionalDecisionQuickActions}</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>남은 결정사항은 다음과 같습니다.</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#0f172a", lineHeight: 1.55 }}>
                        {decision.requiredUnresolved.map((k) => (
                          <li key={k}>{SLOT_LABELS[k]}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            ) : null}
            {ideationReady && mappingActive ? (
              <div style={{ maxWidth: 660, margin: "0 auto", width: "100%", display: "grid", gap: 12 }}>
                {!structureLocked ? (
                  <div style={{ border: "1px solid #fde68a", borderRadius: 14, padding: 12, background: "#fffbeb" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#92400e", lineHeight: 1.55 }}>
                      구조를 확정한 뒤 단계별 담당을 한 화면에서 지정합니다. 먼저 채팅에서 흐름을 다듬은 뒤 상단 탭으로 이동해 주세요.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ border: "1px solid #bfdbfe", borderRadius: 14, padding: 12, background: "#fff" }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>구조 편집 · 담당 지정</div>
                      <div style={{ marginTop: 6, fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>
                        단계별 주 담당을 선택하면 초안에 바로 반영됩니다. 하단에서 한 번에 확정할 수 있습니다.
                      </div>
                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={reapplyRecommendedOwners} style={{ ...btn }}>
                          추천 다시 적용
                        </button>
                      </div>
                    </div>
                    {steps.map((step) => {
                      const badge =
                        step.approved
                          ? { t: "확정됨", bg: "#ecfdf5", fg: "#065f46", bd: "#bbf7d0" }
                          : !step.primaryActorId
                            ? { t: "미지정", bg: "#fef9c3", fg: "#854d0e", bd: "#fde047" }
                            : { t: "검토 필요", bg: "#fff7ed", fg: "#9a3412", bd: "#fed7aa" };
                      return (
                        <div key={step.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "#fff" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>
                              {step.order}. {step.title}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 900, padding: "4px 8px", borderRadius: 999, background: badge.bg, color: badge.fg, border: `1px solid ${badge.bd}` }}>{badge.t}</span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12.5, color: "#64748b", lineHeight: 1.45 }}>{step.purpose}</div>
                          <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800, color: "#475569" }}>
                            현재 담당: {step.primaryActorId ? actorName(step.primaryActorId) : "—"}
                          </div>
                          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                            <label htmlFor={`jyo-sf-primary-${step.id}`} style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                              주 담당 변경
                            </label>
                            <select
                              id={`jyo-sf-primary-${step.id}`}
                              value={step.primaryActorId}
                              onChange={(e) => updateStep(step.id, { primaryActorId: e.target.value })}
                              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1", fontWeight: 800 }}
                            >
                              <option value="">선택</option>
                              {actors.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name} ({a.kind === "human" ? "사람" : "시스템"})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            ) : null}
            {ideationReady && chatActive ? (
              <>
                {generatingDraft ? (
                  <div style={{ border: "1px solid #c7d2fe", borderRadius: 14, padding: 12, background: "#eef2ff", maxWidth: 620 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        aria-hidden
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          border: "2px solid #94a3b8",
                          borderTopColor: "#1d4ed8",
                          animation: "jyo-spin 900ms linear infinite",
                        }}
                      />
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#1e293b" }}>아이디어 내용을 바탕으로 서비스 흐름 초안을 만드는 중...</div>
                    </div>
                  </div>
                ) : null}
                {displayMessages.map((message) => (
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
                {!generatingDraft && !replying && displayMessages.length === 0 ? (
                  <div
                    style={{
                      ...messageTone("ai"),
                      border: "1px solid",
                      borderRadius: 14,
                      padding: "10px 12px",
                      maxWidth: 620,
                      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 900, color: "#64748b" }}>AI · {displayedAiOrchestrator().name}</div>
                    <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                      {structureLocked
                        ? "서비스 흐름 구조가 확정된 상태입니다.\n\n입력창 왼쪽 + 메뉴의 「구조 편집」에서 단계별 담당을 조정할 수 있고, 이 채팅에서는 메시지를 입력해 흐름·액터·문구를 추가로 다듬을 수 있습니다."
                        : "표시할 메시지가 없습니다.\n\n메시지를 입력하거나 아래 빠른 동작 칩을 눌러 AI 기획자와 흐름을 함께 정리해 보세요."}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

        {ideationReady && chatActive && quickReplies && quickReplies.length && !replying ? (
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

        {ideationReady && chatActive && !replying && (!quickReplies || !quickReplies.length) ? (
          <div style={{ flex: "0 0 auto", padding: "0 20px 10px" }}>
            <div style={{ maxWidth: 660, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(() => {
                const design100 = derivedApproval.progressPercent >= 100;
                const requiredZero = decision.requiredUnresolved.length === 0;
                const shouldShowApproval = !decision.requiredUnresolved.length && decision.optionalUnresolved.includes("approvalStep");
                const shouldShowException = !decision.requiredUnresolved.length && decision.optionalUnresolved.includes("exceptionFlow");

                const base =
                  steps.length >= 1
                    ? [
                        { label: "단계 수정", action: () => callAnalyze("단계 수정이 필요합니다. 수정할 단계와 변경 내용을 반영해 주세요.") },
                        { label: "담당 지정", action: () => callAnalyze("각 단계 담당자를 지정하려고 합니다. 단계별 담당을 제안하고 primaryActorId로 반영해 주세요.") },
                      ]
                    : [
                        { label: "액터 추가", action: () => callAnalyze("액터를 추가해 주세요. 사람 액터와 시스템 액터를 분리해 정리해 주세요.") },
                        { label: "흐름 정리", action: () => callAnalyze("주요 서비스 흐름을 3단계 이상으로 정리해 주세요. 각 단계 제목/목적/담당을 포함해 주세요.") },
                      ];

                const extras =
                  steps.length >= 1
                    ? [
                        ...(shouldShowApproval
                          ? [{ label: "승인 추가", action: () => callAnalyze("승인/확정 단계가 필요합니다. 승인 단계를 흐름에 추가하고 담당도 지정해 주세요.") }]
                          : []),
                        ...(shouldShowException
                          ? [{ label: "예외 흐름", action: () => callAnalyze("수정 요청/반려 같은 예외 흐름이 필요합니다. 예외 단계를 흐름에 반영해 주세요.") }]
                          : []),
                      ]
                    : [];

                const chips = [...base, ...extras];

                if (design100 && requiredZero) {
                  // completion state: keep at most 2 chips
                  return chips.filter((c) => c.label === "단계 수정" || c.label === "담당 지정").slice(0, 2);
                }
                return chips;
              })().map((it) => (
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

          <div className="jyo-service-flow-composer-shell" style={{ flex: "0 0 auto", padding: "14px 20px 18px", background: "linear-gradient(180deg, rgba(248,250,252,0), #f8fafc 30%)" }}>
            <div style={{ maxWidth: 660, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, border: "1px solid #e2e8f0", borderRadius: 20, background: "#fff", padding: 10, boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setToolsOpen((v) => !v)}
                  aria-label="도구 열기"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#0f172a",
                    fontSize: 24,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
                {toolsOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      bottom: 52,
                      width: 220,
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
                        setWorkspaceMode("mapping");
                      }}
                      style={{ ...btn, width: "100%", textAlign: "left" }}
                    >
                      구조 편집
                    </button>
                    <div style={{ height: 6 }} />
                    <button
                      type="button"
                      onClick={() => {
                        setToolsOpen(false);
                        setWorkspaceMode("summary");
                      }}
                      disabled={!(actors.length || steps.length)}
                      style={{ ...btn, width: "100%", textAlign: "left", opacity: actors.length || steps.length ? 1 : 0.55 }}
                    >
                      요약 보기
                    </button>
                    <div style={{ height: 6 }} />
                    <button
                      type="button"
                      onClick={() => {
                        setToolsOpen(false);
                        setPrototypePreviewOpen(true);
                      }}
                      disabled={!ideationReady}
                      style={{ ...btn, width: "100%", textAlign: "left", opacity: ideationReady ? 1 : 0.55 }}
                      title={!ideationReady ? ideationReadyNotice : "프로토타입 미리보기"}
                    >
                      프로토타입 미리보기
                    </button>
                  </div>
                ) : null}
              </div>
              <textarea
                ref={composerTextareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="메시지를 입력하세요"
                rows={1}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  outline: "none",
                  borderRadius: 14,
                  background: "#f1f5f9",
                  padding: "14px 16px",
                  fontSize: 14,
                  resize: "none",
                  maxHeight: 160,
                  overflowY: "auto",
                  lineHeight: 1.35,
                }}
              />
              <button type="button" onClick={sendMessage} aria-label="전송" style={{ width: 46, height: 46, borderRadius: 999, border: "1px solid #0f766e", background: "#0f766e", color: "#fff", fontSize: 18, fontWeight: 900, cursor: "pointer" }}>
                ▶
              </button>
            </div>
          </div>

          {remainingPanelOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="남은 결정사항"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 45,
                background: "rgba(15,23,42,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
              onClick={() => setRemainingPanelOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(520px, 100%)",
                  maxHeight: "min(80vh, 640px)",
                  overflowY: "auto",
                  borderRadius: 16,
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>남은 결정사항</div>
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  {unresolvedChecklistEntries(derivedApproval.slots, deferrals).map((row) => (
                    <div key={row.key} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{row.label}</div>
                      {row.deferral === "pending" ? (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#64748b" }}>미정의로 진행됨</div>
                      ) : row.deferral === "deferred_next" ? (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#64748b" }}>다음 단계에서 검토</div>
                      ) : (
                        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button type="button" onClick={() => jumpToResolveSlot(row.key)} style={{ ...btn }}>
                            지금 정하기
                          </button>
                          <button type="button" onClick={() => patchChecklistDeferral(row.key, "pending")} style={{ ...btn }}>
                            미정의로 진행
                          </button>
                          <button type="button" onClick={() => patchChecklistDeferral(row.key, "deferred_next")} style={{ ...btn }}>
                            다음 단계에서 검토
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setRemainingPanelOpen(false)} style={{ ...btn }}>
                    닫기
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <PrototypePreviewDraggableShell
            open={prototypePreviewOpen}
            onClose={() => setPrototypePreviewOpen(false)}
            title="프로토타입 미리보기"
            modalWidth="min(1180px, calc(100vw - 20px))"
          >
            <PrototypePreviewPanel
              key={projectId}
              projectId={projectId}
              projectName={projectName}
              projectDescription={projectDescription}
              ideationAssets={ideationAssets}
              flowSteps={prototypePreviewFlowStepsDetailed}
              actors={prototypePreviewActorsDetailed}
              designReadinessPercent={derivedApproval.progressPercent}
              checklistGapLabels={prototypeChecklistGapLabels}
              unresolvedChecklistCount={remainingChecklistItems}
              designFingerprint={prototypeDesignFingerprint}
              onNavigateFix={() => {
                setPrototypePreviewOpen(false);
                setWorkspaceMode("chat");
              }}
            />
          </PrototypePreviewDraggableShell>

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

// Legacy overlay canvas removed — 요약 보기 모드에서 동일 정보를 인라인으로 표시합니다.
