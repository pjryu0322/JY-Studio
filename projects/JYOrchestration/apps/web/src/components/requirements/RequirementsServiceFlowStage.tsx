"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";

type WorkshopRole = "ai" | "expert" | "user";
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
  kind: "ai" | "human";
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

const layout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 30fr) minmax(420px, 46fr) minmax(260px, 24fr)",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
};

const sidePanel: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  background: "#f8fafc",
};

const chatPanel: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
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
  if (hasDraft) {
    return [
      {
        id: "seed-ai",
        role: "ai",
        name: "AI 서비스 설계자",
        body: qs.length
          ? `초안을 준비했습니다. 부족한 부분만 확인하겠습니다.\n${qs.map((q) => `- ${q}`).join("\n")}`
          : "초안을 준비했습니다. 필수 슬롯은 채워졌고, 권장 슬롯만 함께 다듬으면 됩니다.",
      },
    ];
  }
  return [
    {
      id: "empty-ai",
      role: "ai",
      name: "AI 서비스 설계자",
      body: "상단의 AI 초안 생성 버튼을 누르면 아이디어 초안을 바탕으로 액터, 흐름, 담당 매핑을 먼저 정리합니다.",
    },
  ];
}

function messageTone(role: WorkshopRole): CSSProperties {
  if (role === "user") return { background: "#f0fdf4", borderColor: "#bbf7d0", justifySelf: "end" };
  if (role === "expert") return { background: "#fff7ed", borderColor: "#fed7aa", justifySelf: "start" };
  return { background: "#f8fafc", borderColor: "#dbeafe", justifySelf: "start" };
}

function followUpMessages(text: string, slots: Record<ServiceFlowSlotKey, boolean>): WorkshopMessage[] {
  const nextQuestions = missingSlotQuestions(slots, 2);
  if (text.includes("수정") || text.includes("반려") || text.includes("재처리")) {
    return [{ id: uid("msg"), role: "ai", name: "AI 서비스 설계자", body: "예외 흐름을 반영했습니다. 단계별 책임자와 권한 범위도 이어서 확인하겠습니다." }];
  }
  if (text.includes("권한") || text.includes("열람") || text.includes("관리자")) {
    return [{ id: uid("msg"), role: "expert", name: "업무 전문가", body: "권한 범위를 반영했습니다. 누가 수정할 수 있는지만 명확하면 기능 후보로 넘기기 좋습니다." }];
  }
  if (text.includes("기능") || text.includes("후보")) {
    return [{ id: uid("msg"), role: "ai", name: "AI 서비스 설계자", body: "기능 후보로 넘길 내용을 표시했습니다. 이제 필수 슬롯이 모두 채워졌는지 확인해 주세요." }];
  }
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

  if (text.includes("참석자") || text.includes("사용자")) {
    ensureActor("참석자", "human", "결과 확인 및 수정 요청을 수행하는 사용자");
  }
  if (text.includes("시스템") || text.includes("자동")) {
    ensureActor("자동 처리 시스템", "system", "자동 변환, 알림, 상태 갱신을 수행");
  }
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
  const serviceMembers = members.filter((m) => {
    if (m.memberType === "AI") {
      const role = (m.aiOrchestrationRole ?? "").trim();
      return role === "service-designer" || role === "domain-expert" || role === "serviceFlowExpert" || role === "domainExpert";
    }
    return Boolean(m.isOwner || (currentUserId && m.userId === currentUserId));
  });
  return serviceMembers.map((m) => {
    const role = roleLabelForMember(m);
    const name = (m.displayName || m.email || (m.memberType === "AI" ? "AI 멤버" : "사용자")).slice(0, 28);
    const isAi = m.memberType === "AI";
    return {
      id: m.memberId,
      name,
      roleLabel: role,
      connection: isAi ? (replying ? "응답중" : "연결됨") : currentUserId && m.userId === currentUserId ? "온라인" : "대기",
      lastResponse: isAi ? (replying ? "응답 대기" : "마지막 응답 성공") : undefined,
      kind: isAi ? "ai" : "human",
    };
  });
}

export function RequirementsServiceFlowStage({
  ideationReady,
  ideationReadyNotice,
  flow,
  onChangeFlow,
  draftGenerationCount = 0,
  approval,
  members,
  currentUserId,
  onInviteMember,
  onRetryGate,
}: {
  readonly ideationReady: boolean;
  readonly ideationReadyNotice: string;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
  readonly draftGenerationCount?: number;
  readonly approval: ApprovalState;
  readonly members: readonly ProjectMemberForServiceFlow[];
  readonly currentUserId: string | null;
  readonly onInviteMember: () => void;
  readonly onRetryGate: () => void;
}) {
  const showScreenLabels = useShowScreenLabels();
  const [messages, setMessages] = useState<WorkshopMessage[]>(() => initialMessages(Boolean(flow?.steps.length), approval.slots));
  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>("actors");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(flow?.steps[0]?.id ?? null);

  const actors = flow?.actors ?? [];
  const steps = useMemo(() => normalizeOrder(flow?.steps ?? []), [flow?.steps]);
  const humans = actors.filter((a) => a.kind === "human");
  const systems = actors.filter((a) => a.kind === "system");
  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? steps[0] ?? null;
  const participants = useMemo(() => serviceFlowParticipants(members, currentUserId, replying), [members, currentUserId, replying]);
  const hasDomainExpert = participants.some((p) => p.roleLabel === "domain-expert" || p.roleLabel === "domainExpert");

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
            ? `아이디어 초안을 바탕으로 7개 슬롯을 채웠습니다. 부족한 부분만 이어서 질문하겠습니다.\n${qs.map((q) => `- ${q}`).join("\n")}`
            : "아이디어 초안을 바탕으로 7개 슬롯이 모두 채워졌습니다. 승인 전 실제 업무 예외만 한번 확인해 주세요.",
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
      setMessages((prev) => [...prev, userMessage, ...followUpMessages(body, approval.slots)]);
      setReplying(false);
    }, 160);
  };

  return (
    <section className="jyo-service-flow-stage" style={{ height: "100%", minHeight: 0 }}>
      <style>{`
        @media (max-width: 1080px) {
          .jyo-service-flow-stage-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            overflow-y: auto !important;
          }
        }
        .jyo-service-flow-stage input,
        .jyo-service-flow-stage select {
          box-sizing: border-box;
          max-width: 100%;
        }
      `}</style>
      <ScreenLabel label="요구사항-서비스흐름-협업워크숍" visible={showScreenLabels} />

      <div className="jyo-service-flow-stage-grid" style={layout}>
        <aside style={{ ...sidePanel, borderRight: "1px solid #e2e8f0" }} aria-label="실시간 구조화 결과">
          <PanelHeading>실시간 구조화 결과</PanelHeading>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TabButton active={resultTab === "actors"} onClick={() => setResultTab("actors")}>액터</TabButton>
            <TabButton active={resultTab === "flow"} onClick={() => setResultTab("flow")}>서비스 흐름</TabButton>
            <TabButton active={resultTab === "mapping"} onClick={() => setResultTab("mapping")}>액터-단계 매핑</TabButton>
          </div>
          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: 12, display: "grid", gap: 10, alignContent: "start" }}>
            {!flow || (!actors.length && !steps.length) ? (
              <EmptyResult />
            ) : resultTab === "actors" ? (
              <>
                <ActorGroup title="사람 액터" actors={humans} />
                <ActorGroup title="시스템 액터" actors={systems} />
              </>
            ) : resultTab === "flow" ? (
              steps.map((step) => (
                <StepCard key={step.id} step={step} actorName={actorName} active={selectedStep?.id === step.id} onClick={() => setSelectedStepId(step.id)} />
              ))
            ) : (
              <>
                {steps.map((step) => (
                  <StepCard key={step.id} step={step} actorName={actorName} active={selectedStep?.id === step.id} onClick={() => setSelectedStepId(step.id)} />
                ))}
                {selectedStep ? (
                  <div style={{ marginTop: 4, paddingTop: 12, borderTop: "1px solid #e2e8f0", display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>선택 단계 주 담당 액터</div>
                    <select value={selectedStep.primaryActorId} onChange={(e) => updateStep(selectedStep.id, { primaryActorId: e.target.value })} style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: "8px 10px", fontSize: 13, background: "#fff" }}>
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
        </aside>

        <main style={chatPanel} aria-label="협업 채팅">
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 900, color: "#475569" }}>협업 채팅</div>
          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: 16, display: "grid", gap: 10, alignContent: "start" }}>
            {messages.map((message) => (
              <div key={message.id} style={{ ...messageTone(message.role), border: "1px solid", borderRadius: 14, padding: "10px 12px", maxWidth: message.role === "user" ? "86%" : "94%" }}>
                <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 900, color: "#0f172a" }}>{message.name}</div>
                <div style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{message.body}</div>
              </div>
            ))}
            {replying ? <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>AI 서비스 설계자와 업무 전문가가 반영 중입니다...</div> : null}
          </div>
          <div style={{ borderTop: "1px solid #e2e8f0", padding: 12, display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="예: 참석자도 회의록 수정 요청을 할 수 있어야 해요"
              style={{ flex: 1, minWidth: 0, borderRadius: 12, border: "1px solid #cbd5e1", padding: "11px 12px", fontSize: 13 }}
            />
            <button type="button" onClick={sendMessage} style={primaryBtn}>전송</button>
          </div>
        </main>

        <aside style={{ ...sidePanel, borderLeft: "1px solid #e2e8f0" }} aria-label="참여 멤버와 진행 상태">
          <PanelHeading>참여 멤버</PanelHeading>
          <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "0 10px 10px", display: "grid", gap: 10, alignContent: "start" }}>
            <div role="list" style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
              {participants.map((p) => <MemberCard key={p.id} member={p} />)}
            </div>
            {!hasDomainExpert ? (
              <div style={{ border: "1px solid #fed7aa", borderRadius: 10, padding: 10, background: "#fff7ed" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#9a3412", lineHeight: 1.45 }}>
                  업무 전문가가 아직 없습니다. 프로젝트 멤버에서 추가할 수 있습니다.
                </div>
                <button type="button" onClick={onInviteMember} style={{ ...btn, width: "100%", marginTop: 8, borderColor: "#fb923c", color: "#c2410c" }}>
                  멤버 추가
                </button>
              </div>
            ) : null}
            <SlotProgress approval={approval} />
            <StatusBadge label={approval.approved ? "확정 완료" : approval.ready ? "승인 가능" : "필수 슬롯 필요"} tone={approval.approved || approval.ready ? "good" : "wait"} />
            {approval.ready && RECOMMENDED_SLOTS.some((slot) => approval.recommendedMissing[slot]) ? (
              <div style={{ border: "1px solid #fde68a", borderRadius: 10, padding: 9, background: "#fffbeb", fontSize: 12, fontWeight: 800, color: "#92400e", lineHeight: 1.45 }}>
                권장 슬롯이 남아 있어도 승인할 수 있습니다: {RECOMMENDED_SLOTS.filter((slot) => approval.recommendedMissing[slot]).map((slot) => SLOT_LABELS[slot]).join(", ")}
              </div>
            ) : null}
            {!ideationReady ? (
              <div style={{ border: "1px solid #fde68a", borderRadius: 10, padding: 9, background: "#fffbeb" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", lineHeight: 1.4 }}>{ideationReadyNotice}</div>
                <button type="button" onClick={onRetryGate} style={{ ...btn, width: "100%", marginTop: 8 }}>다시 확인</button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function PanelHeading({ children }: { readonly children: string }) {
  return <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{children}</div>;
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

function SlotProgress({ approval }: { readonly approval: ApprovalState }) {
  const ordered = [...REQUIRED_SLOTS, ...RECOMMENDED_SLOTS];
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#fff" }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>서비스 흐름 정리도 {approval.progressPercent}% · {approval.filledSlotCount}/7</div>
      <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
        {ordered.map((slot) => (
          <div key={slot} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 900, color: approval.slots[slot] ? "#047857" : "#64748b" }}>
            <span aria-hidden>{approval.slots[slot] ? "✔" : "□"}</span>
            <span>{SLOT_LABELS[slot]}</span>
            {RECOMMENDED_SLOTS.includes(slot) ? <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}>권장</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ label, tone }: { readonly label: string; readonly tone: "good" | "wait" }) {
  return (
    <div style={{ border: tone === "good" ? "1px solid #a7f3d0" : "1px solid #e2e8f0", background: tone === "good" ? "#ecfdf5" : "#fff", color: tone === "good" ? "#047857" : "#475569", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 900, textAlign: "center" }}>
      {label}
    </div>
  );
}

function TabButton({ active, onClick, children }: { readonly active: boolean; readonly onClick: () => void; readonly children: string }) {
  return (
    <button type="button" onClick={onClick} style={{ border: active ? "1px solid #0f766e" : "1px solid #e2e8f0", background: active ? "#ecfdf5" : "#fff", color: active ? "#0f766e" : "#475569", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
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
          <div key={actor.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 9, background: "#fff" }}>
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
    <button type="button" onClick={onClick} style={{ textAlign: "left", border: active ? "2px solid #0f766e" : "1px solid #e2e8f0", borderRadius: 14, background: active ? "#ecfdf5" : "#fff", padding: 11, cursor: "pointer" }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{step.order}. {step.title}</div>
      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: "#475569" }}>{step.purpose}</div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: step.primaryActorId ? "#475569" : "#b45309" }}>주 담당: {step.primaryActorId ? actorName(step.primaryActorId) : "정해야 함"}</div>
      {step.secondaryActorIds.length ? <div style={{ marginTop: 3, fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>함께 참여: {step.secondaryActorIds.map(actorName).join(", ")}</div> : null}
    </button>
  );
}

function EmptyResult() {
  return (
    <div style={{ padding: 12, border: "1px dashed #cbd5e1", borderRadius: 12, background: "#fff", fontSize: 13, fontWeight: 700, color: "#64748b", lineHeight: 1.5 }}>
      상단의 AI 초안 생성을 누르면 액터, 서비스 흐름, 액터-단계 매핑이 여기에 정리됩니다.
    </div>
  );
}
