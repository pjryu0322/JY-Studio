"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";

type WorkshopRole = "ai" | "expert" | "member" | "user";
type ResultTab = "actors" | "flow" | "mapping";
type ServiceFlowSlotKey =
  | "humanActors"
  | "systemActors"
  | "mainFlow"
  | "actorResponsibility"
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
  exceptionFlow: "예외 흐름",
  accessControl: "권한 범위",
  handoffToFeatures: "기능 후보",
};

const REQUIRED_SLOTS: readonly ServiceFlowSlotKey[] = ["humanActors", "systemActors", "mainFlow", "actorResponsibility"];
const RECOMMENDED_SLOTS: readonly ServiceFlowSlotKey[] = ["exceptionFlow", "accessControl", "handoffToFeatures"];

const shell: CSSProperties = {
  height: "100%",
  minHeight: 0,
  display: "grid",
  overflow: "hidden",
  background: "#fff",
};

const memberSidebar: CSSProperties = {
  boxSizing: "border-box",
  borderRight: "1px solid #e2e8f0",
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
};

const chatWrap: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
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
    exceptionFlow: "반려, 수정 요청, 재처리 같은 예외 흐름이 필요한가요?",
    accessControl: "누가 열람하거나 수정할 수 있는지 권한 범위가 있나요?",
    handoffToFeatures: "다음 기능 정리로 넘길 핵심 기능 후보는 무엇인가요?",
  };
  return ([...REQUIRED_SLOTS, ...RECOMMENDED_SLOTS] as const).filter((slot) => !slots[slot]).slice(0, limit).map((slot) => questions[slot]);
}

function initialMessages(hasDraft: boolean, slots: Record<ServiceFlowSlotKey, boolean>): WorkshopMessage[] {
  const qs = missingSlotQuestions(slots, 2);
  return [
    {
      id: hasDraft ? "seed-ai" : "empty-ai",
      role: "ai",
      name: "AI 서비스 설계자",
      body: hasDraft
        ? qs.length
          ? `초안을 준비했습니다. 부족한 부분만 확인하겠습니다.\n${qs.map((q) => `- ${q}`).join("\n")}`
          : "초안을 준비했습니다. 필수 슬롯은 채워졌고, 권장 슬롯만 함께 다듬으면 됩니다."
        : "상단의 AI 초안 생성 버튼을 누르면 아이디어 초안을 바탕으로 액터, 흐름, 담당 매핑을 먼저 정리합니다.",
    },
  ];
}

function messageTone(role: WorkshopRole): CSSProperties {
  if (role === "user") return { background: "#f0fdf4", borderColor: "#bbf7d0", justifySelf: "end" };
  if (role === "expert") return { background: "#fff7ed", borderColor: "#fed7aa", justifySelf: "start" };
  if (role === "member") return { background: "#f8fafc", borderColor: "#cbd5e1", justifySelf: "start" };
  return { background: "#fff", borderColor: "#e2e8f0", justifySelf: "start" };
}

function participantMessageRole(member: ServiceFlowParticipant): WorkshopRole {
  const role = member.roleLabel.trim();
  if (role === "domain-expert" || role === "domainExpert") return "expert";
  if (role === "OWNER" || role === "EDITOR" || role === "REVIEWER" || role === "VIEWER") return "member";
  return "ai";
}

function participantOpinion(member: ServiceFlowParticipant, text: string, slots: Record<ServiceFlowSlotKey, boolean>): string {
  const role = member.roleLabel.trim();
  const nextQuestions = missingSlotQuestions(slots, 1);
  if (role === "service-designer") {
    if (text.includes("수정") || text.includes("반려") || text.includes("재처리")) return "예외 흐름으로 반영하겠습니다. 단계별 책임자와 권한 범위도 함께 확인하겠습니다.";
    if (text.includes("권한") || text.includes("열람") || text.includes("관리자")) return "권한 범위를 서비스 흐름의 확인 단계로 정리하겠습니다.";
    return nextQuestions.length ? `흐름에 반영했습니다. 다음으로 확인할 질문은 "${nextQuestions[0]}"입니다.` : "필수 슬롯 기준으로 보면 다음 단계로 넘길 수 있습니다.";
  }
  if (role === "planner") return "아이디어 구체화에서 정리한 목표와 이어지도록 흐름 초안을 맞춰 보겠습니다.";
  if (role === "domain-expert" || role === "domainExpert") return "현업 관점에서는 수정 요청, 반려, 재처리처럼 예외 상황이 실제로 필요한지 확인하는 것이 좋겠습니다.";
  if (role === "serviceFlowExpert") return "단계별 주 담당 액터가 빠지지 않도록 매핑을 같이 점검하겠습니다.";
  return "검토자 관점에서 사용자가 헷갈릴 수 있는 단계와 권한 범위를 확인하겠습니다.";
}

function followUpMessages(text: string, slots: Record<ServiceFlowSlotKey, boolean>, participants: readonly ServiceFlowParticipant[]): WorkshopMessage[] {
  const nextQuestions = missingSlotQuestions(slots, 2);
  const seen = new Set<string>();
  const opinions = participants
    .filter((p) => {
      const key = `${p.name}:${p.roleLabel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p) => ({
      id: uid("msg"),
      role: participantMessageRole(p),
      name: p.name,
      body: participantOpinion(p, text, slots),
    }));
  if (opinions.length) return opinions;
  return [
    {
      id: uid("msg"),
      role: "ai",
      name: "AI 서비스 설계자",
      body: nextQuestions.length
        ? `반영했습니다. 남은 슬롯만 짧게 확인하겠습니다.\n${nextQuestions.map((q) => `- ${q}`).join("\n")}`
        : "반영했습니다. 필수 슬롯은 충족되어 다음 단계로 넘길 수 있습니다.",
    },
  ];
}

function applyChatToFlow(flow: RequirementsServiceFlowV1 | null, text: string): RequirementsServiceFlowV1 | null {
  if (!flow) return null;
  const now = new Date().toISOString();
  let actors = [...flow.actors];
  let steps = [...flow.steps];

  const ensureActor = (name: string, kind: "human" | "system", description: string): string => {
    const found = actors.find((a) => a.name === name);
    if (found) return found.id;
    const id = `actor:${name}`;
    actors = [...actors, { id, name, kind, description }];
    return id;
  };

  const ensureStep = (title: string, purpose: string, primaryActorId: string) => {
    if (steps.some((s) => s.title === title)) return;
    steps = [
      ...steps,
      {
        id: `step:${steps.length + 1}:${title}`,
        order: steps.length + 1,
        title,
        purpose,
        primaryActorId,
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ];
  };

  if (text.includes("참석자") || text.includes("사용자")) ensureActor("참석자", "human", "결과 확인 및 수정 요청을 수행하는 사용자");
  if (text.includes("시스템") || text.includes("자동")) ensureActor("자동 처리 시스템", "system", "자동 변환, 알림, 상태 갱신을 수행");
  if (text.includes("수정") || text.includes("반려") || text.includes("재처리")) {
    const actorId = ensureActor("업무 담당자", "human", "수정 요청과 재처리 여부를 판단");
    ensureStep("수정 요청 및 재처리", "반려나 수정 요청이 발생하면 담당자가 내용을 보완", actorId);
  }
  if (text.includes("권한") || text.includes("관리자") || text.includes("열람")) {
    const actorId = ensureActor("관리자", "human", "열람, 수정, 공유 범위를 관리하는 담당자");
    ensureStep("권한 확인", "사용자별 열람 및 수정 가능 범위를 확인", actorId);
  }
  if (text.includes("기능") || text.includes("후보") || text.includes("알림")) {
    const actorId = ensureActor("알림 시스템", "system", "상태 변경과 승인 요청을 관련자에게 전달");
    ensureStep("기능 후보 정리", "다음 기능 정의 단계로 넘길 후보를 정리", actorId);
  }

  return { ...flow, actors, steps: normalizeOrder(steps), updatedAt: now };
}

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
      if (m.memberType === "AI") {
        const role = (m.aiOrchestrationRole ?? "").trim();
        return role === "planner" || role === "service-designer" || role === "domain-expert" || role === "serviceFlowExpert" || role === "domainExpert";
      }
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
        name: (m.displayName || m.email || (isAi ? "AI 멤버" : "사용자")).slice(0, 28),
        roleLabel: role,
        connection: isAi ? (replying ? "응답중" : "연결됨") : currentUserId && m.userId === currentUserId ? "온라인" : "대기",
        lastResponse: isAi ? (replying ? "응답 대기" : "마지막 응답 성공") : undefined,
      };
    });
  if (!rows.some((p) => p.roleLabel === "service-designer")) {
    rows.splice(1, 0, {
      id: "virtual:service-designer",
      name: "AI 서비스 설계자",
      roleLabel: "service-designer",
      connection: replying ? "응답중" : "연결됨",
      lastResponse: replying ? "응답 대기" : "마지막 응답 성공",
    });
  }
  return rows;
}

export function RequirementsServiceFlowStage({
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
  const showScreenLabels = useShowScreenLabels();
  const [messages, setMessages] = useState<WorkshopMessage[]>(() => initialMessages(Boolean(flow?.steps.length), approval.slots));
  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>("flow");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(flow?.steps[0]?.id ?? null);

  const actors = flow?.actors ?? [];
  const steps = useMemo(() => normalizeOrder(flow?.steps ?? []), [flow?.steps]);
  const humans = actors.filter((a) => a.kind === "human");
  const systems = actors.filter((a) => a.kind === "system");
  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? steps[0] ?? null;
  const participants = useMemo(() => serviceFlowParticipants(members, currentUserId, replying), [members, currentUserId, replying]);

  useEffect(() => {
    if (draftGenerationCount <= 0) return;
    const timer = window.setTimeout(() => {
      const qs = missingSlotQuestions(approval.slots, 3);
      setMessages((prev) => [
        ...prev,
        {
          id: uid("msg"),
          role: "ai",
          name: "AI 서비스 설계자",
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

  const sendMessage = () => {
    const body = input.trim();
    if (!body) return;
    setInput("");
    setReplying(true);
    const nextFlow = applyChatToFlow(flow, body);
    if (nextFlow) onChangeFlow(nextFlow);
    const userMessage: WorkshopMessage = { id: uid("msg"), role: "user", name: "사용자", body };
    window.setTimeout(() => {
      setMessages((prev) => [...prev, userMessage, ...followUpMessages(body, approval.slots, participants)]);
      setReplying(false);
    }, 160);
  };

  return (
    <section className="jyo-service-flow-stage" style={{ height: "100%", minHeight: 0 }}>
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

        <main style={chatWrap} aria-label="협업 채팅">
          <div style={{ flex: "0 0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 900, color: "#0f172a" }}>
              서비스 흐름 정리도 {approval.progressPercent}% · {approval.filledSlotCount}/7
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={onGenerateAiDraft} disabled={!ideationReady || generatingDraft} style={{ ...primaryBtn, opacity: !ideationReady || generatingDraft ? 0.55 : 1 }}>
                {generatingDraft ? "초안 만드는 중..." : "AI 초안 생성"}
              </button>
              <button type="button" onClick={onApproveAll} disabled={!approval.ready} style={{ ...btn, opacity: approval.ready ? 1 : 0.55 }}>
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

          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "0 20px 14px", display: "grid", gap: 10, alignContent: "start" }}>
            {!ideationReady ? (
              <div style={{ border: "1px solid #fde68a", borderRadius: 14, padding: 12, background: "#fffbeb", maxWidth: 620 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", lineHeight: 1.5 }}>{ideationReadyNotice}</div>
                <button type="button" onClick={onRetryGate} style={{ ...btn, marginTop: 8 }}>다시 확인</button>
              </div>
            ) : null}
            {messages.map((message) => (
              <div key={message.id} style={{ ...messageTone(message.role), border: "1px solid", borderRadius: 14, padding: "10px 12px", maxWidth: message.role === "user" ? "78%" : 620, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
                <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 900, color: "#64748b" }}>
                  {message.role === "user" ? "사용자" : message.role === "member" ? `멤버 · ${message.name}` : `AI · ${message.name}`}
                </div>
                <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{message.body}</div>
              </div>
            ))}
            <DraftSummaryCard flowReady={Boolean(actors.length || steps.length)} onOpenCanvas={() => setCanvasOpen(true)} />
            {replying ? <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>AI 서비스 설계자와 업무 전문가가 반영 중입니다...</div> : null}
          </div>

          {canvasOpen ? (
            <DraftCanvas
              actors={actors}
              humans={humans}
              systems={systems}
              steps={steps}
              selectedStep={selectedStep}
              resultTab={resultTab}
              approval={approval}
              actorName={actorName}
              onClose={() => setCanvasOpen(false)}
              onSelectTab={setResultTab}
              onSelectStep={setSelectedStepId}
              onUpdateStep={updateStep}
            />
          ) : null}

          <div style={{ flex: "0 0 auto", padding: "14px 20px 18px", background: "linear-gradient(180deg, rgba(248,250,252,0), #f8fafc 30%)" }}>
            <div style={{ maxWidth: 660, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, border: "1px solid #e2e8f0", borderRadius: 20, background: "#fff", padding: 10, boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)" }}>
              <button type="button" onClick={() => setCanvasOpen(true)} aria-label="액터 및 서비스 흐름 초안 열기" style={{ width: 42, height: 42, borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", color: "#0f172a", fontSize: 24, lineHeight: 1, cursor: "pointer" }}>
                +
              </button>
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

function DraftSummaryCard({ flowReady, onOpenCanvas }: { readonly flowReady: boolean; readonly onOpenCanvas: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenCanvas}
      style={{
        maxWidth: 620,
        textAlign: "left",
        border: "1px solid #bfdbfe",
        borderRadius: 16,
        background: "#eff6ff",
        padding: 14,
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>액터 및 서비스 흐름 초안</div>
      <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, color: "#475569" }}>
        {flowReady ? "하단 + 버튼 또는 이 카드를 눌러 캔버스에서 액터, 흐름, 담당 매핑을 확인하세요." : "AI 초안 생성 후 캔버스에서 액터, 흐름, 담당 매핑을 확인할 수 있습니다."}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, color: "#0f766e" }}>캔버스 열기</div>
    </button>
  );
}

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
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>액터 및 서비스 흐름 초안</div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "#64748b" }}>서비스 흐름 정리도 {approval.progressPercent}% · {approval.filledSlotCount}/7</div>
        </div>
        <button type="button" onClick={onClose} style={{ ...btn, borderRadius: 999 }}>
          닫기
        </button>
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
  return (
    <div style={{ maxWidth: 680, border: "1px solid #bfdbfe", borderRadius: 16, background: "#eff6ff", padding: 14, display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>액터 및 서비스 흐름 초안이 정리됩니다.</div>
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {([...REQUIRED_SLOTS, ...RECOMMENDED_SLOTS] as const).map((slot) => (
            <span key={slot} style={{ border: "1px solid #dbeafe", borderRadius: 999, background: approval.slots[slot] ? "#ecfdf5" : "#fff", color: approval.slots[slot] ? "#047857" : "#64748b", padding: "4px 8px", fontSize: 11, fontWeight: 800 }}>
              {approval.slots[slot] ? "✔" : "□"} {SLOT_LABELS[slot]}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <TabButton active={resultTab === "actors"} onClick={() => onSelectTab("actors")}>액터</TabButton>
        <TabButton active={resultTab === "flow"} onClick={() => onSelectTab("flow")}>서비스 흐름</TabButton>
        <TabButton active={resultTab === "mapping"} onClick={() => onSelectTab("mapping")}>담당 매핑</TabButton>
      </div>
      {actors.length || steps.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {resultTab === "actors" ? (
            <>
              <ActorGroup title="사람 액터" actors={humans} />
              <ActorGroup title="시스템 액터" actors={systems} />
            </>
          ) : resultTab === "flow" ? (
            steps.map((step) => <StepCard key={step.id} step={step} actorName={actorName} active={selectedStep?.id === step.id} onClick={() => onSelectStep(step.id)} />)
          ) : (
            <>
              {steps.map((step) => <StepCard key={step.id} step={step} actorName={actorName} active={selectedStep?.id === step.id} onClick={() => onSelectStep(step.id)} />)}
              {selectedStep ? (
                <div style={{ marginTop: 2, display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>선택 단계 주 담당 액터</div>
                  <select value={selectedStep.primaryActorId} onChange={(e) => onUpdateStep(selectedStep.id, { primaryActorId: e.target.value })} style={{ width: "100%", borderRadius: 10, border: "1px solid #bfdbfe", padding: "8px 10px", fontSize: 13, background: "#fff" }}>
                    <option value="">담당자 선택</option>
                    {actors.map((actor) => (
                      <option key={actor.id} value={actor.id}>{actor.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div style={{ padding: 12, border: "1px dashed #bfdbfe", borderRadius: 12, background: "#fff", fontSize: 13, fontWeight: 700, color: "#64748b", lineHeight: 1.5 }}>
          AI 초안 생성을 누르면 액터, 서비스 흐름, 담당 매핑이 여기에 카드로 표시됩니다.
        </div>
      )}
      {approval.ready && RECOMMENDED_SLOTS.some((slot) => approval.recommendedMissing[slot]) ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", lineHeight: 1.45 }}>
          권장 슬롯이 남아 있어도 승인할 수 있습니다: {RECOMMENDED_SLOTS.filter((slot) => approval.recommendedMissing[slot]).map((slot) => SLOT_LABELS[slot]).join(", ")}
        </div>
      ) : null}
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

function ActorGroup({ title, actors }: { readonly title: string; readonly actors: readonly RequirementsServiceFlowActorV1[] }) {
  return (
    <div>
      <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 900, color: "#64748b" }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {actors.length ? actors.map((actor) => (
          <div key={actor.id} style={{ border: "1px solid #dbeafe", borderRadius: 10, padding: 9, background: "#fff" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{actor.name}</div>
            {actor.description ? <div style={{ marginTop: 3, fontSize: 11.5, lineHeight: 1.4, color: "#64748b" }}>{actor.description}</div> : null}
          </div>
        )) : <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>아직 없음</div>}
      </div>
    </div>
  );
}

function StepCard({ step, actorName, active, onClick }: { readonly step: RequirementsServiceFlowStepV1; readonly actorName: (id: string) => string; readonly active: boolean; readonly onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ textAlign: "left", border: active ? "2px solid #0f766e" : "1px solid #dbeafe", borderRadius: 12, background: active ? "#ecfdf5" : "#fff", padding: 10, cursor: "pointer" }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{step.order}. {step.title}</div>
      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: "#475569" }}>{step.purpose}</div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: step.primaryActorId ? "#475569" : "#b45309" }}>주 담당: {step.primaryActorId ? actorName(step.primaryActorId) : "정해야 함"}</div>
      {step.secondaryActorIds.length ? <div style={{ marginTop: 3, fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>함께 참여: {step.secondaryActorIds.map(actorName).join(", ")}</div> : null}
    </button>
  );
}
