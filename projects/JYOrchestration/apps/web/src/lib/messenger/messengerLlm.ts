import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { getPlatformAiMemberById } from "@/lib/ai/platformAiMembers";
import { recordMessengerOpenAi } from "@/lib/debug/promptTimelineStore";
import { MESSENGER_DEFAULT_AI_CATALOG_KEY } from "@/lib/messenger/messengerConstants";
import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";
import { resolveUserOpenAiApiKey } from "@/lib/messenger/resolveUserOpenAiKey";

const MAX_LOG_TRANSCRIPT = 24_000;

export type MessengerLlmLogContext = {
  readonly roomId: string;
  readonly roomTitle: string | null;
  readonly projectId: string | null;
};

/** 자유 대화방(projectId 없음) 전용 AI 기획자 — 단일 소스. */
const MESSENGER_AI_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다. 사용자는 아직 프로젝트로 승격되지 않은 자유 대화방에서 아이디어를 탐색합니다.

역할:
- 사용자의 막연한 아이디어를 서비스 관점으로 정리합니다.
- 질문을 반복하지 말고, 화면 구성·사용 흐름·기능 후보·우선순위를 구체적으로 제안합니다.
- 사용자가 "모르겠다", "제안해줘", "정리해줘", "기술은 모른다", "기획자가 정리해줘"라고 말하면 질문보다 기획 정리를 우선합니다.
- 기술 세부사항을 사용자에게 떠넘기지 않습니다.
- 내부 용어는 사용자에게 노출하지 않습니다.

응답 규칙:
- 한국어로 답합니다.
- 2~5문단 이내로 짧고 실무적으로 답합니다.
- 첫 문장은 사용자의 핵심 의도를 서비스 관점으로 정리합니다.
- 본문에는 구체 제안 1~3개를 포함합니다.
- 가능하면 화면 구성, 사용자 흐름, 기능 후보, 우선순위 중 최소 2개 이상을 포함합니다.
- 마지막 문장은 질문이 아니라 다음 행동 제안으로 끝냅니다.
- 질문은 꼭 필요할 때만 1개만 사용합니다.

금지:
- "좋은 아이디어입니다" 반복
- 일반론만 나열
- "어떤 기능이 마음에 드시나요?" 같은 범용 질문
- "어떤 부분을 더 깊이 논의하고 싶으신가요?" 같은 반복 질문
- 오케스트레이션, 슬롯, 프로토타입 패키지, 하네스, Stage1, ENV_TEST, Cursor, GitHub Actions 같은 내부 용어 노출`;

const DOC_COLLABORATION_HINT = `[문서 협업 맥락]
사용자 발화에 문서·PDF·협업 관련 표현이 있습니다. 답변에는 가능한 범위에서 아래 주제 중 최소 2가지 이상을 구체적으로 다루세요: 원본 보존과 PDF 사본 관계, 문서 업로드 후 PDF 변환·공유 흐름, 실시간 참여자 표시, 상대의 페이지·커서·선택 영역, 주석/댓글, 태그/알림, 변경 이력, 문서 비교, PC 화면 구성, 모바일/반응형 화면, 초기 범위와 확장 범위.`;

/** 프로젝트 연결 방 등 레거시 경로용: user/assistant 본문 합산 상한(system 별도). */
const MESSENGER_TRANSCRIPT_CHAR_BUDGET = 36_000;

const MESSENGER_SUMMARY_MAX_CHARS = 3600;
/** 최근 대화 윈도우: 최대 8개 메시지(대략 2~4턴). */
const MESSENGER_RECENT_WINDOW_MAX_MESSAGES = 8;

/** 타임라인용 로그 본문 상한. */
const MAX_LOG_CONVERSATION_CHARS = 14_000;

function truncConversationTail(s: string, max: number): string {
  const t = String(s ?? "").trim();
  if (!t.length) return "(대화 없음)";
  if (t.length <= max) return t;
  return `…(이전 ${t.length - max}자 생략)\n\n${t.slice(-max)}`;
}

function isMessengerFreeRoom(log: MessengerLlmLogContext | undefined): boolean {
  return !String(log?.projectId ?? "").trim();
}

function combinedUserText(transcript: readonly { role: "user" | "assistant"; content: string }[]): string {
  return transcript
    .filter((m) => m.role === "user")
    .map((m) => String(m.content ?? "").trim())
    .join("\n");
}

function userTextMentionsDocCollaboration(transcript: readonly { role: "user" | "assistant"; content: string }[]): boolean {
  return /(문서|PDF|원본|사본|검토|주석|편집|비교|실시간\s*협업|반응형|직관적|UX|화면)/i.test(combinedUserText(transcript));
}

/** 반복적인 저품질 assistant 안내 문구(요약·최근창에서 노출 억제). */
function isLowQualityAssistantReply(text: string): boolean {
  const t = String(text ?? "").trim();
  if (t.length < 16) return false;
  let score = 0;
  if (/좋은 아이디어/i.test(t)) score++;
  if (/어떤 기능이 마음에 드/i.test(t)) score++;
  if (/어떤 부분.*더 깊이|더 깊이 논의/i.test(t)) score++;
  if (/추가하고 싶은 아이디어|추가하고 싶은 기능/i.test(t)) score++;
  if (/구체적으로 어떤 디자인/i.test(t)) score++;
  if (/접근성.*맞춤화|피드백 수집이 중요/i.test(t)) score++;
  return score >= 2;
}

/** user 발화만 줄 단위로 누적(assistant 본문은 요약에 넣지 않음). */
function buildUserOnlyConversationSummary(
  prior: readonly { role: "user" | "assistant"; content: string }[]
): string {
  const bullets: string[] = [];
  for (const m of prior) {
    if (m.role !== "user") continue;
    const raw = String(m.content ?? "").trim().replace(/\s+/g, " ");
    if (raw.length < 3) continue;
    const line = `- ${raw.slice(0, 420)}`;
    if (bullets.length && bullets[bullets.length - 1] === line) continue;
    bullets.push(line);
  }
  return bullets.join("\n").slice(0, MESSENGER_SUMMARY_MAX_CHARS);
}

function takeRecentPriorMessages(
  prior: readonly { role: "user" | "assistant"; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  const start = Math.max(0, prior.length - MESSENGER_RECENT_WINDOW_MAX_MESSAGES);
  return prior.slice(start).map((m) => ({
    role: m.role,
    content:
      m.role === "assistant" && isLowQualityAssistantReply(String(m.content ?? ""))
        ? "[이전 AI 답변은 반복적인 안내라 생략합니다. 요약과 사용자 발화를 우선하세요.]"
        : String(m.content ?? "").trim(),
  }));
}

function buildPlannerSystemBlock(personaLine: string, docHint: boolean): string {
  const parts: string[] = [MESSENGER_AI_SYSTEM];
  if (personaLine.trim()) parts.push(personaLine.trim());
  if (docHint) parts.push(DOC_COLLABORATION_HINT);
  parts.push(
    "[요청 컨텍스트] 마지막 사용자 메시지는 이 배열의 마지막 user 항목으로 원문 전달됩니다. 앞의 [이전 대화 요약]은 user 발화만 줄인 누적 정리이며, 그 다음은 최근 2~4턴(assistant는 저품질 반복 응답은 생략)입니다. 과거 AI의 반복 질문 문구를 본문에서 재사용하지 마세요. 마지막 문장은 질문이 아니라 다음 행동 제안으로 끝내세요."
  );
  return parts.join("\n\n");
}

type MessengerChatTurn = { role: "user" | "assistant"; content: string };

/**
 * 자유 대화방: system + [이전 대화 요약](user만) + 최근 2~4턴 + 마지막 user 원문.
 * 과거 assistant 전문을 무제한 재주입하지 않는다.
 */
function buildFreeMessengerOpenAiMessages(
  transcript: readonly MessengerChatTurn[],
  personaLine: string
): { role: "system" | "user" | "assistant"; content: string }[] {
  const last = transcript[transcript.length - 1]!;
  if (last.role !== "user") {
    throw new Error("MESSENGER_EXPECT_LAST_USER");
  }
  const currentUser = String(last.content ?? "").trim();
  const prior = transcript.slice(0, -1);
  const summary = buildUserOnlyConversationSummary(prior);
  const recent = takeRecentPriorMessages(prior);
  const docHint = userTextMentionsDocCollaboration(transcript);
  const systemContent = buildPlannerSystemBlock(personaLine, docHint);

  const out: { role: "system" | "user" | "assistant"; content: string }[] = [{ role: "system", content: systemContent }];
  if (summary.trim()) {
    out.push({ role: "user", content: `[이전 대화 요약]\n${summary.trim()}` });
  }
  out.push(...recent);
  out.push({ role: "user", content: currentUser });
  return out;
}

function serializeMessengerOpenAiMessagesForLog(p: {
  readonly roomId: string;
  readonly projectId: string | null;
  readonly layout: "free_windowed" | "legacy_tail";
  readonly apiMessages: readonly { role: string; content: string }[];
}): string {
  const chars = p.apiMessages.reduce((acc, m) => acc + String(m.content ?? "").length, 0);
  const block = p.apiMessages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n---\n\n");
  const conv = truncConversationTail(block, MAX_LOG_CONVERSATION_CHARS);
  return [
    `roomId=${p.roomId.trim()}`,
    `projectId=${String(p.projectId ?? "").trim()}`,
    `layout=${p.layout} messages=${p.apiMessages.length} approxChars=${chars}`,
    `[api_messages]\n${conv}`,
  ].join("\n\n---\n\n");
}

/**
 * 레거시(비자유·방어): 최근 접미사만 잘라 전체 대화를 한 덩어리로 전달.
 */
function takeMessengerTranscriptForApi(
  transcript: readonly MessengerChatTurn[],
  maxTotalChars: number
): { readonly messages: MessengerChatTurn[]; readonly droppedEarlier: boolean } {
  if (!transcript.length) return { messages: [], droppedEarlier: false };
  const n = transcript.length;
  const lastIdx = n - 1;
  const lastRaw = String(transcript[lastIdx]!.content ?? "").trim();
  if (lastRaw.length > maxTotalChars) {
    return {
      messages: [{ role: transcript[lastIdx]!.role, content: lastRaw.slice(Math.max(0, lastRaw.length - maxTotalChars)) }],
      droppedEarlier: lastIdx > 0 || lastRaw.length > maxTotalChars,
    };
  }
  let total = 0;
  let start = lastIdx;
  for (let i = lastIdx; i >= 0; i--) {
    const len = String(transcript[i]!.content ?? "").trim().length;
    if (total + len > maxTotalChars && i < lastIdx) break;
    total += len;
    start = i;
  }
  const droppedEarlier = start > 0;
  const messages = transcript.slice(start).map((m) => ({
    role: m.role,
    content: String(m.content ?? "").trim(),
  }));
  return { messages, droppedEarlier };
}

function stripJsonFences(text: string): string {
  let s = String(text ?? "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return s;
}

export type MessengerAiTurnResult =
  | { ok: true; text: string; model: string }
  | { ok: false; code: string; message: string };

export async function runMessengerAiTurn(input: {
  userId: string;
  transcript: readonly { role: "user" | "assistant"; content: string }[];
  logContext?: MessengerLlmLogContext;
}): Promise<MessengerAiTurnResult> {
  const ai = getPlatformAiMemberById(MESSENGER_DEFAULT_AI_CATALOG_KEY);
  const personaLine = ai?.persona ? `페르소나(참고): ${ai.persona}` : "";

  const freeRoom = isMessengerFreeRoom(input.logContext);
  let messages: { role: "system" | "user" | "assistant"; content: string }[];
  let outboundForLog: string;
  let layout: "free_windowed" | "legacy_tail";

  if (freeRoom) {
    try {
      messages = buildFreeMessengerOpenAiMessages(input.transcript, personaLine);
      layout = "free_windowed";
      outboundForLog = input.logContext
        ? serializeMessengerOpenAiMessagesForLog({
            roomId: input.logContext.roomId,
            projectId: input.logContext.projectId,
            layout,
            apiMessages: messages,
          })
        : "";
    } catch {
      const { messages: tail, droppedEarlier } = takeMessengerTranscriptForApi(
        input.transcript,
        MESSENGER_TRANSCRIPT_CHAR_BUDGET
      );
      const contextNote = droppedEarlier
        ? "\n\n[컨텍스트] 토큰 한도로 앞부분이 생략된 최근 발화만 포함됩니다."
        : "";
      const systemContent = `${MESSENGER_AI_SYSTEM}\n\n${personaLine ? `${personaLine}\n\n` : ""}${contextNote}`.trim();
      messages = [{ role: "system", content: systemContent }, ...tail];
      layout = "legacy_tail";
      outboundForLog = input.logContext
        ? serializeMessengerOpenAiMessagesForLog({
            roomId: input.logContext.roomId,
            projectId: input.logContext.projectId,
            layout,
            apiMessages: messages,
          })
        : "";
    }
  } else {
    const { messages: tail, droppedEarlier } = takeMessengerTranscriptForApi(
      input.transcript,
      MESSENGER_TRANSCRIPT_CHAR_BUDGET
    );
    const contextNote = droppedEarlier
      ? "\n\n[컨텍스트] 토큰 한도로 앞부분이 생략된 최근 발화만 포함됩니다."
      : "";
    const systemContent = `${MESSENGER_AI_SYSTEM}\n\n${personaLine ? `${personaLine}\n\n` : ""}${contextNote}`.trim();
    messages = [{ role: "system", content: systemContent }, ...tail];
    layout = "legacy_tail";
    outboundForLog = input.logContext
      ? serializeMessengerOpenAiMessagesForLog({
          roomId: input.logContext.roomId,
          projectId: input.logContext.projectId,
          layout,
          apiMessages: messages,
        })
      : "";
  }

  const { key, source } = await resolveUserOpenAiApiKey(input.userId);
  if (!key) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_chat",
        model: null,
        outbound: outboundForLog || "(로그 없음)",
        ok: false,
        error:
          source === "missing"
            ? "OpenAI API 키가 없습니다. 설정에서 연동하거나 사용자 기본 키를 등록해 주세요."
            : "OpenAI API 키를 사용할 수 없습니다.",
      });
    }
    return {
      ok: false,
      code: "NO_KEY",
      message:
        source === "missing"
          ? "OpenAI API 키가 없습니다. 설정에서 연동하거나 사용자 기본 키를 등록해 주세요."
          : "OpenAI API 키를 사용할 수 없습니다.",
    };
  }
  const model = resolveOpenAiModelFromEnv();
  const res = await postOpenAiChatCompletion({
    apiKey: key,
    model,
    messages,
    temperature: 0.45,
    maxTokens: 950,
  });
  if (!res.ok) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_chat",
        model,
        outbound: outboundForLog,
        ok: false,
        error: res.message,
      });
    }
    return { ok: false, code: res.code, message: res.message };
  }
  const text = String(res.text ?? "").trim();
  if (!text) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_chat",
        model,
        outbound: outboundForLog,
        ok: false,
        error: "모델 응답이 비어 있습니다.",
      });
    }
    return { ok: false, code: "EMPTY", message: "모델 응답이 비어 있습니다." };
  }
  if (input.logContext) {
    await recordMessengerOpenAi({
      userId: input.userId,
      roomId: input.logContext.roomId,
      roomTitle: input.logContext.roomTitle,
      projectId: input.logContext.projectId,
      kind: "messenger_chat",
      model,
      outbound: outboundForLog,
      ok: true,
      replyText: text,
    });
  }
  return { ok: true, text, model };
}

const PROJECT_DRAFT_SYSTEM = `당신은 제품 기획자입니다. 아래 대화를 바탕으로 프로젝트 초안을 JSON 한 개로만 출력하세요.
스키마(필수 키, 한국어 문자열 위주):
{
  "version": 1,
  "titleCandidates": string[3],
  "chosenTitle": string,
  "description": string,
  "problem": string,
  "targetUsers": string,
  "valueProposition": string,
  "mvpScope": string,
  "explicitExclusions": string,
  "featureCandidates": string[],
  "openQuestions": string[],
  "assumptions": string[],
  "confirmedFacts": string[],
  "recommendedAiMembers": string[],
  "nextSteps": string[]
}
확정된 사실과 AI 가정을 섞지 말고, assumptions에는 가정만, confirmedFacts에는 사용자가 말한 사실만 넣으세요.`;

export type MessengerDraftResult =
  | { ok: true; payload: ProjectFromChatDraftPayloadV1; model: string }
  | { ok: false; code: string; message: string };

export async function runMessengerProjectDraft(input: {
  userId: string;
  transcript: string;
  logContext?: MessengerLlmLogContext;
}): Promise<MessengerDraftResult> {
  const userBlock = `대화 로그:\n---\n${input.transcript.slice(0, MAX_LOG_TRANSCRIPT)}\n---\n위만 근거로 JSON을 채우세요.`;
  const { key, source } = await resolveUserOpenAiApiKey(input.userId);
  if (!key) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model: null,
        outbound: [`roomId=${input.logContext.roomId}`, `projectId=${input.logContext.projectId ?? ""}`, `[system]\n${PROJECT_DRAFT_SYSTEM}`, `[user]\n${userBlock}`].join(
          "\n\n---\n\n"
        ),
        ok: false,
        error: source === "missing" ? "OpenAI API 키가 없습니다." : "OpenAI API 키를 사용할 수 없습니다.",
      });
    }
    return {
      ok: false,
      code: "NO_KEY",
      message: source === "missing" ? "OpenAI API 키가 없습니다." : "OpenAI API 키를 사용할 수 없습니다.",
    };
  }
  const model = resolveOpenAiModelFromEnv();
  const res = await postOpenAiChatCompletion({
    apiKey: key,
    model,
    messages: [
      { role: "system", content: PROJECT_DRAFT_SYSTEM },
      {
        role: "user",
        content: userBlock,
      },
    ],
    temperature: 0.3,
    maxTokens: 2500,
    responseFormatJsonObject: true,
  });

  const logOutbound = () =>
    [`roomId=${input.logContext?.roomId ?? ""}`, `projectId=${input.logContext?.projectId ?? ""}`, `[system]\n${PROJECT_DRAFT_SYSTEM}`, `[user]\n${userBlock}`].join(
      "\n\n---\n\n"
    );

  if (!res.ok) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        error: res.message,
      });
    }
    return { ok: false, code: res.code, message: res.message };
  }
  const raw = stripJsonFences(res.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        replyText: String(res.text ?? "").trim() || undefined,
        error: "초안 JSON 파싱에 실패했습니다.",
      });
    }
    return { ok: false, code: "JSON", message: "초안 JSON 파싱에 실패했습니다." };
  }
  if (!parsed || typeof parsed !== "object") {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        error: "초안 형식이 올바르지 않습니다.",
      });
    }
    return { ok: false, code: "JSON", message: "초안 형식이 올바르지 않습니다." };
  }
  const o = parsed as Record<string, unknown>;
  if (Number(o.version) !== 1) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        error: "version은 1이어야 합니다.",
      });
    }
    return { ok: false, code: "JSON", message: "version은 1이어야 합니다." };
  }
  const payload: ProjectFromChatDraftPayloadV1 = {
    version: 1,
    titleCandidates: Array.isArray(o.titleCandidates) ? o.titleCandidates.map((x) => String(x)) : [],
    chosenTitle: String(o.chosenTitle ?? "").trim(),
    description: String(o.description ?? "").trim(),
    problem: String(o.problem ?? "").trim(),
    targetUsers: String(o.targetUsers ?? "").trim(),
    valueProposition: String(o.valueProposition ?? "").trim(),
    mvpScope: String(o.mvpScope ?? "").trim(),
    explicitExclusions: String(o.explicitExclusions ?? "").trim(),
    featureCandidates: Array.isArray(o.featureCandidates) ? o.featureCandidates.map((x) => String(x)) : [],
    openQuestions: Array.isArray(o.openQuestions) ? o.openQuestions.map((x) => String(x)) : [],
    assumptions: Array.isArray(o.assumptions) ? o.assumptions.map((x) => String(x)) : [],
    confirmedFacts: Array.isArray(o.confirmedFacts) ? o.confirmedFacts.map((x) => String(x)) : [],
    recommendedAiMembers: Array.isArray(o.recommendedAiMembers) ? o.recommendedAiMembers.map((x) => String(x)) : [],
    nextSteps: Array.isArray(o.nextSteps) ? o.nextSteps.map((x) => String(x)) : [],
  };
  if (!payload.chosenTitle) {
    if (input.logContext) {
      await recordMessengerOpenAi({
        userId: input.userId,
        roomId: input.logContext.roomId,
        roomTitle: input.logContext.roomTitle,
        projectId: input.logContext.projectId,
        kind: "messenger_project_draft",
        model,
        outbound: logOutbound(),
        ok: false,
        replyText: raw.slice(0, 8000),
        error: "chosenTitle이 비어 있습니다.",
      });
    }
    return { ok: false, code: "JSON", message: "chosenTitle이 비어 있습니다." };
  }
  if (input.logContext) {
    await recordMessengerOpenAi({
      userId: input.userId,
      roomId: input.logContext.roomId,
      roomTitle: input.logContext.roomTitle,
      projectId: input.logContext.projectId,
      kind: "messenger_project_draft",
      model,
      outbound: logOutbound(),
      ok: true,
      replyText: raw.slice(0, 12_000),
    });
  }
  return { ok: true, payload, model };
}
