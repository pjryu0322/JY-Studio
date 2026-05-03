import type { FeaturePlanningSlotsLlmContext } from "@/lib/featurePlanning/buildFeaturePlanningSlotsContext";

export function buildFeaturePlanningInitializeSystemPrompt(): string {
  const slotTypes = "CORE, DOMAIN, UI, FLOW, DATA, AUTH, TASK, MENU, SCREEN, CUSTOM";
  return `You are a Korean **AI service planner** preparing the "기능 정리" workspace **before prototype generation**.

## Goal (critical)
Generate **prototype planning domains** — high-level categories for **features, menus, screens, data, admin ops, shared components, and build tasks**.

## Step ownership (critical)
**User roles / actors / "누가 쓰는지"** are already defined in the **previous step** (액터 및 서비스 흐름). They are **INPUT CONTEXT ONLY**.
- Do **NOT** create a top-level slot named like **사용자 역할**, **역할 정의**, **액터**, **사용자 구분**, or any slot whose main job is listing actors again.
- Do **NOT** ask the user to redefine who the users are, whether an admin exists, or to enumerate roles again.
- **Instead**: attach role context to **items** using **roleTags** (array of short Korean labels taken from confirmed actors, e.g. "일반 사용자", "관리자", "팀 관리자") on items under **핵심 기능**, **화면 목록**, **화면별 기능**, **관리자 기능**, etc.

## Preferred top-level slotName examples (dynamic; mix/match by domain)
- 핵심 기능, 메뉴 구조, 화면 목록, 화면별 기능, 데이터 구조, 관리자 기능, 공통 컴포넌트, 프로토타입 Task
- Avoid duplicating the previous step: no standalone "사용자 역할" planning slot.

## Wrong pattern (do NOT do this)
Do **NOT** create slots whose **slotName** is a sequential **업무 처리 단계** (workflow step) as top-level titles, e.g.:
- 녹취파일 업로드, 텍스트 변환, … as **slotName** (those belong as **items** under **핵심 기능**).

## Items rule (critical for first UX)
Under each slot, **items** must stay **light**: **at most 2 items** at generation time; **name** short (≤40 Korean chars); **description** one line. Optionally **roleTags** (0–3 strings) when the capability clearly targets specific actors from context.
Do **not** dump long enumerations.

## Rules
1) Prefer **5~8** meaningful slots; merge redundant domains.
2) Each slot MUST include: slotId, slotKey, slotName, slotType (one of: ${slotTypes}), description (short Korean), reason, sourceRefs (IDEATION | ACTOR_FLOW | PROJECT_CONTEXT with sourceId and summary), items (1–2 per rule; items may include **roleTags** string array when relevant).
3) Use ideation + actor/service flow as **evidence** for structure — never mirror the flow doc as a list of step-shaped **slotName** titles.
4) recommendedOrder: ordered slotIds (usually 핵심 기능 → 메뉴/화면 → 데이터 → 관리/공통 → Task).
5) prototypeReadiness: READY | NEEDS_REVIEW | INSUFFICIENT, missingItems[], notes.

Output ONLY valid JSON (no markdown fences). Shape:
{
  "slots": [ ... ],
  "recommendedOrder": [ "SLOT-001", ... ],
  "prototypeReadiness": { "status": "NEEDS_REVIEW", "missingItems": [], "notes": "" },
  "priorStepActorRoles": [ "optional copy of confirmed actor names for persistence" ]
}

If **priorStepActorRoles** is omitted, it will be filled server-side from the previous step; you may echo the same list for clarity.`;
}

export function buildFeaturePlanningInitializeUserPrompt(ctx: FeaturePlanningSlotsLlmContext): string {
  const rolesBlock =
    ctx.confirmedActorRoleNames.length > 0
      ? ctx.confirmedActorRoleNames.map((n) => `- ${n}`).join("\n")
      : "(이전 단계에서 이름이 확보되지 않았습니다. 그래도 역할 전용 슬롯은 만들지 말고, 항목 roleTags는 비우거나 일반적인 라벨만 사용하세요.)";

  const base = `[프로젝트명]
${ctx.projectName}

[프로젝트 설명]
${ctx.projectDescription}

[1. 아이디어 구체화 산출물 / 정리 결과]
${ctx.ideationDeliverablesText}

[2. 액터 및 서비스 흐름 정의 — JSON 전문]
${ctx.actorServiceFlowText}

[이전 단계에서 확정된 액터·역할 이름 — 참조 전용]
${rolesBlock}
위 역할 이름은 **기능/화면/메뉴 항목의 roleTags**로만 쓰고, **별도의 "사용자 역할" 최상위 슬롯을 만들지 마세요.**

[3. 대화·요약 맥락]
${ctx.conversationSummaryText}

위 맥락만으로 JSON 응답을 생성하세요.

[대화 UX — 별도 단계]
채팅 첫 메시지는 다른 모델 호출로 생성된다. 이 JSON에서는 **슬롯 구조와 가벼운 항목**만 출력한다.`;

  if (!ctx.forceRegenerate) return base;

  return `${base}

[재생성 모드]
저장된 정리가 **업무 처리 절차** 위주였을 수 있다. 이번 응답은 **프로토타입 제작에 필요한 구조**로 다시 짜야 한다.
내부 용어「슬롯」은 쓰지 말 것.`;
}
