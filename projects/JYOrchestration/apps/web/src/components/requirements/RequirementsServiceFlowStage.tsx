"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";

type WorkshopRole = "ai" | "expert" | "user";

type WorkshopMessage = {
  id: string;
  role: WorkshopRole;
  name: string;
  body: string;
};

type ApprovalState = {
  actorsReady: boolean;
  stepsReady: boolean;
  mapped: boolean;
  approved: boolean;
  ready: boolean;
};

const layout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 22fr) minmax(420px, 48fr) minmax(280px, 30fr)",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
};

const sidePanel: CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  background: "#f8fafc",
  borderRight: "1px solid #e2e8f0",
};

const centerPanel: CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  background: "#fff",
};

const resultPanel: CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  background: "#fbfdff",
  borderLeft: "1px solid #e2e8f0",
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

function defaultMessages(hasDraft: boolean): WorkshopMessage[] {
  return hasDraft
    ? [
        {
          id: "seed-ai",
          role: "ai",
          name: "AI 서비스 설계자",
          body: "서비스 흐름 초안이 준비되었습니다. 승인자, 수정 요청, 예외 흐름만 짧게 확인하겠습니다.",
        },
        {
          id: "seed-expert",
          role: "expert",
          name: "업무 전문가",
          body: "현업 기준으로는 최종 승인자와 외부 공유 제한을 먼저 확인하는 것이 좋습니다.",
        },
      ]
    : [
        {
          id: "empty-ai",
          role: "ai",
          name: "AI 서비스 설계자",
          body: "[AI 초안 생성]으로 액터와 운영 흐름을 먼저 만들겠습니다.",
        },
      ];
}

function speakerStyle(role: WorkshopRole): CSSProperties {
  if (role === "ai") return { background: "#eff6ff", borderColor: "#bfdbfe" };
  if (role === "expert") return { background: "#fff7ed", borderColor: "#fed7aa" };
  return { background: "#f0fdf4", borderColor: "#bbf7d0" };
}

function memberStatus(role: WorkshopRole, replying: boolean): string {
  if (role === "user") return "online";
  if (replying) return role === "expert" ? "응답중" : "응답중";
  return role === "ai" ? "online" : "대기";
}

function insightReplies(text: string): WorkshopMessage[] {
  if (text.includes("승인") || text.includes("결재")) {
    return [
      {
        id: uid("msg"),
        role: "expert",
        name: "업무 전문가",
        body: "승인자는 한 명으로 명확히 두고, 수정 요청자는 별도로 열어두는 구조가 안전합니다.",
      },
    ];
  }
  if (text.includes("수정") || text.includes("참석자")) {
    return [
      {
        id: uid("msg"),
        role: "ai",
        name: "AI 서비스 설계자",
        body: "참석자 수정 요청 단계를 구조화 결과에 반영했습니다. 주 담당 액터를 확인해 주세요.",
      },
    ];
  }
  if (text.includes("모바일")) {
    return [
      {
        id: uid("msg"),
        role: "expert",
        name: "업무 전문가",
        body: "모바일 사용 비중이 높다면 업로드, 검토, 승인 동선을 모바일 우선으로 검증해야 합니다.",
      },
    ];
  }
  if (text.includes("권한") || text.includes("관리자")) {
    return [
      {
        id: uid("msg"),
        role: "ai",
        name: "AI 서비스 설계자",
        body: "관리자 액터와 권한 관리 관점을 구조화 결과에 반영했습니다.",
      },
    ];
  }
  return [
    {
      id: uid("msg"),
      role: "ai",
      name: "AI 서비스 설계자",
      body: "확인했습니다. 이제 실제 승인자, 수정 요청 가능 주체, 알림 필요 여부만 추가로 보면 기능 정리로 넘길 수 있습니다.",
    },
  ];
}

function applyInsightToFlow(flow: RequirementsServiceFlowV1 | null, text: string): RequirementsServiceFlowV1 | null {
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

  if (text.includes("수정") || text.includes("참석자")) {
    const actorId = ensureActor("참석자", "human", "회의 결과 확인과 수정 요청을 담당하는 사용자");
    ensureStep("수정 요청", "참석자가 초안에 대한 수정 요청을 등록", actorId);
  }
  if (text.includes("관리자") || text.includes("권한")) {
    ensureActor("관리자", "human", "권한, 공유 범위, 운영 정책을 관리");
  }
  if (text.includes("알림")) {
    const actorId = ensureActor("알림 시스템", "system", "상태 변경과 승인 요청을 전달");
    ensureStep("알림 발송", "수정 요청과 승인 상태를 관련자에게 알림", actorId);
  }

  return { ...flow, actors, steps: normalizeOrder(steps), updatedAt: now };
}

export function RequirementsServiceFlowStage({
  ideationReady,
  ideationReadyNotice,
  flow,
  onChangeFlow,
  draftGenerationCount = 0,
  generatingDraft,
  approval,
  onRetryGate,
  onGenerateAiDraft,
  onApproveAll,
}: {
  readonly ideationReady: boolean;
  readonly ideationReadyNotice: string;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
  readonly draftGenerationCount?: number;
  readonly generatingDraft: boolean;
  readonly approval: ApprovalState;
  readonly onRetryGate: () => void;
  readonly onGenerateAiDraft: () => void;
  readonly onApproveAll: () => void;
}) {
  const showScreenLabels = useShowScreenLabels();
  const [messages, setMessages] = useState<WorkshopMessage[]>(() => defaultMessages(Boolean(flow?.steps.length)));
  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(flow?.steps[0]?.id ?? null);

  const actors = flow?.actors ?? [];
  const steps = useMemo(() => normalizeOrder(flow?.steps ?? []), [flow?.steps]);
  const humans = actors.filter((a) => a.kind === "human");
  const systems = actors.filter((a) => a.kind === "system");
  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? steps[0] ?? null;
  const exceptionFlowReflected = steps.some((s) => {
    const text = `${s.title} ${s.purpose}`.toLowerCase();
    return /예외|수정|반려|알림|공유 제한|권한/.test(text);
  });

  useEffect(() => {
    if (selectedStepId && steps.some((s) => s.id === selectedStepId)) return;
    setSelectedStepId(steps[0]?.id ?? null);
  }, [selectedStepId, steps]);

  useEffect(() => {
    if (draftGenerationCount <= 0) return;
    setMessages((prev) => [
      ...prev,
      {
        id: uid("msg"),
        role: "ai",
        name: "AI 서비스 설계자",
        body: "아이디어 초안을 바탕으로 액터와 서비스 흐름 초안을 만들었습니다.",
      },
      {
        id: uid("msg"),
        role: "expert",
        name: "업무 전문가",
        body: "이제 참석자 수정 요청, 최종 승인자, 알림 필요 여부만 확인하면 기능 정리로 넘길 수 있습니다.",
      },
    ]);
  }, [draftGenerationCount]);

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
    const userMessage: WorkshopMessage = { id: uid("msg"), role: "user", name: "사용자", body };
    const nextFlow = applyInsightToFlow(flow, body);
    if (nextFlow) onChangeFlow(nextFlow);
    window.setTimeout(() => {
      setMessages((prev) => [...prev, userMessage, ...insightReplies(body)]);
      setReplying(false);
    }, 160);
  };

  const statusLine = steps.length
    ? `액터 ${actors.length} · 흐름 ${steps.length} · 매핑 ${steps.filter((s) => s.primaryActorId).length}/${steps.length}`
    : "AI 초안 생성 전";
  const progressChecks = [
    { label: "액터 2명 이상", done: approval.actorsReady },
    { label: "흐름 3단계 이상", done: approval.stepsReady },
    { label: "예외 흐름 반영", done: exceptionFlowReflected },
    { label: "승인 가능", done: approval.ready },
  ];

  return (
    <section className="jyo-service-flow-workshop" style={{ height: "100%", minHeight: 0 }}>
      <style>{`
        @media (max-width: 1080px) {
          .jyo-service-flow-workshop-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            overflow-y: auto !important;
          }
        }
        .jyo-service-flow-workshop input,
        .jyo-service-flow-workshop select {
          box-sizing: border-box;
          max-width: 100%;
        }
      `}</style>
      <ScreenLabel label="요구사항-서비스흐름-채팅형워크숍" visible={showScreenLabels} />
      <div className="jyo-service-flow-workshop-grid" style={layout}>
        <aside style={sidePanel}>
          <PanelTitle title="참여 멤버" />
          <div style={{ padding: 12, display: "grid", gap: 8, alignContent: "start", overflowY: "auto" }}>
            {[
              { role: "ai" as const, name: "AI 서비스 설계자", desc: "구조화" },
              { role: "expert" as const, name: "업무 전문가", desc: "검증" },
              { role: "user" as const, name: "사용자", desc: "판단" },
            ].map((m) => (
              <div key={m.role} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 9px", background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 13, color: "#0f172a" }}>{m.name}</strong>
                  <span style={{ fontSize: 11, fontWeight: 900, color: memberStatus(m.role, replying).includes("중") ? "#b45309" : "#047857" }}>
                    {memberStatus(m.role, replying)}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>{m.desc}</div>
              </div>
            ))}

            <ChecklistBlock title="진행 체크" checks={progressChecks} />
            <StatusBlock title="승인 상태" lines={[statusLine, approval.approved ? "승인 완료" : approval.ready ? "승인 가능" : "보완 필요"]} />
            {!ideationReady ? <button type="button" onClick={onRetryGate} style={btn}>다시 확인</button> : null}
          </div>
        </aside>

        <main style={centerPanel}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#475569" }}>협업 채팅</div>
            <button type="button" onClick={onGenerateAiDraft} disabled={!ideationReady || generatingDraft} style={{ ...primaryBtn, opacity: !ideationReady || generatingDraft ? 0.55 : 1 }}>
              {generatingDraft ? "초안 생성 중..." : "AI 초안 생성"}
            </button>
          </div>

          <div style={{ padding: 16, overflowY: "auto", minHeight: 0, flex: "1 1 auto", display: "grid", alignContent: "start", gap: 10 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ ...speakerStyle(m.role), border: "1px solid", borderRadius: 14, padding: "10px 12px", maxWidth: m.role === "user" ? "86%" : "94%", justifySelf: m.role === "user" ? "end" : "start" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
            {replying ? <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>AI와 전문가가 반영 중입니다...</div> : null}
          </div>

          <div style={{ borderTop: "1px solid #e2e8f0", padding: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="예: 참석자도 수정 요청 가능해야 합니다"
                style={{ flex: 1, minWidth: 0, borderRadius: 12, border: "1px solid #cbd5e1", padding: "11px 12px", fontSize: 13 }}
              />
              <button type="button" onClick={sendMessage} style={primaryBtn}>전송</button>
            </div>
          </div>
        </main>

        <aside style={resultPanel}>
          <PanelTitle title="실시간 구조화 결과" />
          <div style={{ padding: 12, overflowY: "auto", display: "grid", gap: 12 }}>
            {!flow || (!actors.length && !steps.length) ? (
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700, lineHeight: 1.5 }}>
                AI 초안을 생성하면 결과가 채워집니다.
              </div>
            ) : (
              <>
                <ActorList title="사람 액터" actors={humans} />
                <ActorList title="시스템 액터" actors={systems} />
                <div>
                  <SectionLabel>서비스 흐름 / 담당 액터 매핑</SectionLabel>
                  <div style={{ display: "grid", gap: 8 }}>
                    {steps.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStepId(s.id)}
                        style={{
                          textAlign: "left",
                          border: selectedStep?.id === s.id ? "2px solid #0f766e" : "1px solid #e2e8f0",
                          borderRadius: 12,
                          background: selectedStep?.id === s.id ? "#ecfdf5" : "#fff",
                          padding: 10,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{s.order}. {s.title}</div>
                        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: s.primaryActorId ? "#475569" : "#b45309" }}>
                          주 담당: {s.primaryActorId ? actorName(s.primaryActorId) : "미지정"}
                        </div>
                        {s.secondaryActorIds.length ? (
                          <div style={{ marginTop: 3, fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>보조: {s.secondaryActorIds.map(actorName).join(", ")}</div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedStep ? (
                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12, display: "grid", gap: 8 }}>
                    <SectionLabel>선택 단계 매핑</SectionLabel>
                    <select
                      value={selectedStep.primaryActorId}
                      onChange={(e) => updateStep(selectedStep.id, { primaryActorId: e.target.value })}
                      style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: "8px 10px", fontSize: 13, background: "#fff" }}
                    >
                      <option value="">주 담당 선택</option>
                      {actors.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.kind === "human" ? "사람" : "시스템"})</option>
                      ))}
                    </select>
                    <select
                      multiple
                      value={selectedStep.secondaryActorIds}
                      onChange={(e) =>
                        updateStep(selectedStep.id, {
                          secondaryActorIds: Array.from(e.currentTarget.options)
                            .filter((o) => o.selected)
                            .map((o) => o.value)
                            .filter((id) => id !== selectedStep.primaryActorId),
                        })
                      }
                      style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: "8px 10px", fontSize: 13, background: "#fff", minHeight: 78 }}
                    >
                      {actors.filter((a) => a.id !== selectedStep.primaryActorId).map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.kind === "human" ? "사람" : "시스템"})</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                  <StatusBlock title="승인 가능 여부" lines={[approval.ready ? "승인 가능" : "승인 조건 미충족", approval.approved ? "승인 완료" : "승인 대기"]} />
                  <button type="button" onClick={onApproveAll} disabled={!approval.ready} style={{ ...primaryBtn, width: "100%", marginTop: 10, opacity: approval.ready ? 1 : 0.55 }}>
                    전체 승인
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function PanelTitle({ title }: { readonly title: string }) {
  return <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{title}</div>;
}

function SectionLabel({ children }: { readonly children: string }) {
  return <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>{children}</div>;
}

function StatusBlock({ title, lines, action }: { readonly title: string; readonly lines: readonly string[]; readonly action?: ReactNode }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 9, background: "#fff" }}>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ display: "grid", gap: 3 }}>
        {lines.map((line) => (
          <div key={line} style={{ fontSize: 11.5, fontWeight: 800, color: "#475569", lineHeight: 1.35 }}>{line}</div>
        ))}
      </div>
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

function ChecklistBlock({ title, checks }: { readonly title: string; readonly checks: readonly { label: string; done: boolean }[] }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 9, background: "#fff" }}>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ display: "grid", gap: 5 }}>
        {checks.map((check) => (
          <div key={check.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 900, color: check.done ? "#047857" : "#64748b" }}>
            <span aria-hidden>{check.done ? "✔" : "□"}</span>
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActorList({ title, actors }: { readonly title: string; readonly actors: readonly RequirementsServiceFlowActorV1[] }) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ display: "grid", gap: 6 }}>
        {actors.length ? actors.map((a) => (
          <div key={a.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 9, background: "#fff" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{a.name}</div>
            {a.description ? <div style={{ marginTop: 3, fontSize: 11.5, color: "#64748b", lineHeight: 1.4 }}>{a.description}</div> : null}
          </div>
        )) : <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>아직 없음</div>}
      </div>
    </div>
  );
}
