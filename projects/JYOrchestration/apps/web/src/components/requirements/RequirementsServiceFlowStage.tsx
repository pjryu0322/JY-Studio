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

type WorkshopMessage = {
  id: string;
  role: WorkshopRole;
  name: string;
  body: string;
};

const shell: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(170px, 22fr) minmax(360px, 48fr) minmax(260px, 30fr)",
  gap: 12,
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
};

const panel: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#fff",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const panelHeader: CSSProperties = {
  padding: "12px 12px 10px",
  borderBottom: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
};

const btn: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 800,
  color: "#0f172a",
  cursor: "pointer",
};

const tabBtn = (active: boolean): CSSProperties => ({
  border: active ? "1px solid #0f766e" : "1px solid #e2e8f0",
  background: active ? "#ecfdf5" : "#fff",
  color: active ? "#0f766e" : "#475569",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
});

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

function speakerTone(role: WorkshopRole): CSSProperties {
  if (role === "ai") return { borderColor: "#bfdbfe", background: "#eff6ff" };
  if (role === "expert") return { borderColor: "#fed7aa", background: "#fff7ed" };
  return { borderColor: "#bbf7d0", background: "#f0fdf4" };
}

function defaultMessages(hasDraft: boolean): WorkshopMessage[] {
  if (hasDraft) {
    return [
      {
        id: "seed-ai",
        role: "ai",
        name: "AI 서비스 설계자",
        body: "아이디어 초안을 바탕으로 서비스 흐름 초안이 준비되었습니다. 승인자, 예외 흐름, 권한 정책을 함께 확인하겠습니다.",
      },
      {
        id: "seed-expert",
        role: "expert",
        name: "업무 전문가",
        body: "현업 검토 관점에서는 수정 요청, 최종 승인, 외부 공유 제한 같은 운영 규칙을 먼저 확인하는 것이 좋습니다.",
      },
    ];
  }
  return [
    {
      id: "empty-ai",
      role: "ai",
      name: "AI 서비스 설계자",
      body: "먼저 [AI 초안 생성]을 눌러 아이디어 초안 기반의 액터와 서비스 흐름을 만들겠습니다.",
    },
    {
      id: "empty-expert",
      role: "expert",
      name: "업무 전문가",
      body: "빈 화면에서 직접 작성하기보다 AI 초안을 놓고 실제 운영 절차를 검증하는 방식으로 진행합니다.",
    },
  ];
}

function roleLabel(role: WorkshopRole): string {
  if (role === "ai") return "AI";
  if (role === "expert") return "전문가";
  return "사용자";
}

function statusFor(role: WorkshopRole, replying: boolean): string {
  if (role === "ai") return replying ? "응답중" : "online";
  if (role === "expert") return replying ? "검토중" : "대기";
  return "online";
}

function insightReplies(text: string): WorkshopMessage[] {
  const lower = text.toLowerCase();
  const replies: WorkshopMessage[] = [];
  if (text.includes("승인") || text.includes("결재")) {
    replies.push({
      id: uid("msg"),
      role: "expert",
      name: "업무 전문가",
      body: "실제 조직에서는 최종 승인자와 수정 요청 가능 범위를 분리해 두는 편이 안전합니다.",
    });
  }
  if (text.includes("수정") || text.includes("참석자")) {
    replies.push({
      id: uid("msg"),
      role: "ai",
      name: "AI 서비스 설계자",
      body: "참석자 수정 요청 가능성을 서비스 흐름의 예외/보완 단계로 반영하겠습니다.",
    });
  } else if (text.includes("모바일") || lower.includes("mobile")) {
    replies.push({
      id: uid("msg"),
      role: "expert",
      name: "업무 전문가",
      body: "모바일 사용 비중이 높다면 업로드, 검토, 승인 화면을 모바일 우선 정책으로 검증해야 합니다.",
    });
  } else if (text.includes("관리자") || text.includes("권한")) {
    replies.push({
      id: uid("msg"),
      role: "ai",
      name: "AI 서비스 설계자",
      body: "관리자 권한과 공유 제한 정책을 구조화 결과에 반영할 수 있도록 액터와 흐름을 확인하겠습니다.",
    });
  } else if (text.includes("알림")) {
    replies.push({
      id: uid("msg"),
      role: "ai",
      name: "AI 서비스 설계자",
      body: "승인 요청과 수정 요청에는 알림 트리거가 필요합니다. 다음 기능 정리 후보에도 반영하겠습니다.",
    });
  } else {
    replies.push({
      id: uid("msg"),
      role: "ai",
      name: "AI 서비스 설계자",
      body: "좋습니다. 현재 흐름에서 실제 승인자, 수정 요청 가능 주체, 모바일 사용 비중 중 아직 불명확한 항목을 우선 확인하겠습니다.",
    });
  }
  return replies;
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
  const ensureStep = (title: string, purpose: string, primaryActorId: string, secondaryActorIds: string[] = []) => {
    if (steps.some((s) => s.title === title)) return;
    steps = [
      ...steps,
      {
        id: `step:${steps.length + 1}:${title}`,
        order: steps.length + 1,
        title,
        purpose,
        primaryActorId,
        secondaryActorIds,
        approved: false,
        updatedAt: now,
      },
    ];
  };

  if (text.includes("관리자") || text.includes("권한")) {
    ensureActor("관리자", "human", "권한, 정책, 외부 공유 범위를 관리하는 운영 담당자");
  }
  if (text.includes("수정") || text.includes("참석자")) {
    const attendeeId = ensureActor("참석자", "human", "회의 결과를 확인하고 수정 요청을 남기는 사용자");
    ensureStep("수정 요청", "참석자가 회의록 초안에 대한 수정 요청을 등록", attendeeId);
  }
  if (text.includes("알림")) {
    const systemId = ensureActor("알림 시스템", "system", "승인 요청과 수정 요청 상태를 관련자에게 전달");
    ensureStep("알림 발송", "수정 요청과 최종 승인 상태를 관련자에게 알림", systemId);
  }

  return { ...flow, actors, steps: normalizeOrder(steps), updatedAt: now };
}

export function RequirementsServiceFlowStage({
  ideationReady,
  ideationReadyNotice,
  flow,
  onChangeFlow,
  draftGenerationCount = 0,
}: {
  readonly ideationReady: boolean;
  readonly ideationReadyNotice: string;
  readonly flow: RequirementsServiceFlowV1 | null;
  readonly onChangeFlow: (next: RequirementsServiceFlowV1) => void;
  readonly draftGenerationCount?: number;
}) {
  const showScreenLabels = useShowScreenLabels();
  const [messages, setMessages] = useState<WorkshopMessage[]>(() => defaultMessages(Boolean(flow?.steps.length)));
  const [input, setInput] = useState("");
  const [replying, setReplying] = useState(false);
  const [tab, setTab] = useState<"actors" | "flow">("actors");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(flow?.steps[0]?.id ?? null);

  const actors = flow?.actors ?? [];
  const steps = useMemo(() => normalizeOrder(flow?.steps ?? []), [flow?.steps]);
  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? steps[0] ?? null;
  const humans = actors.filter((a) => a.kind === "human");
  const systems = actors.filter((a) => a.kind === "system");

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
        body: "아이디어 초안을 바탕으로 사람 액터, 시스템 액터, 서비스 흐름 초안을 만들었습니다.",
      },
      {
        id: uid("msg"),
        role: "expert",
        name: "업무 전문가",
        body: "실제 운영에서는 참석자 수정 요청 단계, 최종 승인자, 개인정보 보호와 외부 공유 제한을 확인해야 합니다.",
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
    }, 180);
  };

  const readyText = steps.length
    ? `액터 ${actors.length}개 · 흐름 ${steps.length}단계 · 주 담당 ${steps.filter((s) => s.primaryActorId).length}/${steps.length}`
    : "AI 초안 생성 대기";

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
        .jyo-service-flow-workshop textarea,
        .jyo-service-flow-workshop select {
          box-sizing: border-box;
          max-width: 100%;
        }
      `}</style>
      <ScreenLabel label="요구사항-서비스흐름-워크숍-섹션" visible={showScreenLabels} />

      {!ideationReady ? (
        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 13, fontWeight: 700, lineHeight: 1.55 }}>
          {ideationReadyNotice}
        </div>
      ) : null}

      <div className="jyo-service-flow-workshop-grid" style={shell}>
        <aside style={panel}>
          <div style={panelHeader}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>참여 멤버</div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: "#64748b" }}>{readyText}</div>
          </div>
          <div style={{ padding: 12, display: "grid", gap: 10, overflowY: "auto" }}>
            {[
              { role: "ai" as const, name: "AI 서비스 설계자", desc: "초안 생성·구조화" },
              { role: "expert" as const, name: "업무 전문가", desc: "현실 검증·예외 흐름" },
              { role: "user" as const, name: "사용자", desc: "업무 맥락·최종 판단" },
            ].map((m) => (
              <div key={m.role} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{m.name}</div>
                  <span style={{ fontSize: 10.5, fontWeight: 900, color: statusFor(m.role, replying).includes("중") ? "#b45309" : "#047857" }}>
                    {statusFor(m.role, replying)}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>
                  {roleLabel(m.role)} · {m.desc}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main style={panel}>
          <div style={panelHeader}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>협업 채팅</div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: "#64748b" }}>
              필요한 정보만 짧게 확인하고, 답변은 우측 구조화 결과에 반영합니다.
            </div>
          </div>
          <div style={{ padding: 12, overflowY: "auto", minHeight: 0, flex: "1 1 auto", display: "grid", alignContent: "start", gap: 10 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ ...speakerTone(m.role), border: "1px solid", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
            {replying ? (
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>AI 서비스 설계자와 업무 전문가가 검토 중입니다...</div>
            ) : null}
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
              placeholder="예: 참석자도 수정 요청 가능해야 합니다 / 모바일 사용 비중이 높습니다"
              style={{ flex: 1, minWidth: 0, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", fontSize: 13 }}
            />
            <button type="button" onClick={sendMessage} style={{ ...btn, borderColor: "#0f766e", background: "#0f766e", color: "#fff" }}>
              전송
            </button>
          </div>
        </main>

        <aside style={panel}>
          <div style={panelHeader}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>구조화 결과</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button type="button" style={tabBtn(tab === "actors")} onClick={() => setTab("actors")}>
                액터
              </button>
              <button type="button" style={tabBtn(tab === "flow")} onClick={() => setTab("flow")}>
                서비스 흐름
              </button>
            </div>
          </div>
          <div style={{ padding: 12, overflowY: "auto", minHeight: 0, display: "grid", gap: 12 }}>
            {!flow || (!actors.length && !steps.length) ? (
              <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 12, background: "#f8fafc", color: "#64748b", fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
                빈 목록을 직접 작성하지 않습니다. 먼저 상단의 [AI 초안 생성]으로 워크숍 초안을 만드세요.
              </div>
            ) : tab === "actors" ? (
              <>
                <ActorGroup title="사람 액터" actors={humans} />
                <ActorGroup title="시스템 액터" actors={systems} />
              </>
            ) : (
              <>
                {steps.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStepId(s.id)}
                    style={{
                      textAlign: "left",
                      border: selectedStep?.id === s.id ? "2px solid #0f766e" : "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 10,
                      background: selectedStep?.id === s.id ? "#ecfdf5" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>
                      {s.order}. {s.title}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: s.primaryActorId ? "#475569" : "#b45309" }}>
                      주 담당: {s.primaryActorId ? actorName(s.primaryActorId) : "미지정"}
                    </div>
                    {s.secondaryActorIds.length ? (
                      <div style={{ marginTop: 3, fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>
                        보조: {s.secondaryActorIds.map(actorName).join(", ")}
                      </div>
                    ) : null}
                  </button>
                ))}
                {selectedStep ? (
                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12, display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>선택 단계 액터 매핑</div>
                    <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 900, color: "#64748b" }}>
                      주 담당 액터
                      <select
                        value={selectedStep.primaryActorId}
                        onChange={(e) => updateStep(selectedStep.id, { primaryActorId: e.target.value })}
                        style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13, background: "#fff" }}
                      >
                        <option value="">주 담당 선택</option>
                        {actors.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.kind === "human" ? "사람" : "시스템"})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 900, color: "#64748b" }}>
                      보조 액터
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
                        style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13, background: "#fff", minHeight: 86 }}
                      >
                        {actors
                          .filter((a) => a.id !== selectedStep.primaryActorId)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.kind === "human" ? "사람" : "시스템"})
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ActorGroup({ title, actors }: { readonly title: string; readonly actors: readonly RequirementsServiceFlowActorV1[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {actors.length ? (
          actors.map((a) => (
            <div key={a.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{a.name}</div>
              {a.description ? (
                <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>{a.description}</div>
              ) : null}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12.5, color: "#94a3b8", fontWeight: 700 }}>아직 정의되지 않았습니다.</div>
        )}
      </div>
    </div>
  );
}
