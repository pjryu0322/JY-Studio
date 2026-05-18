# JYOrchestration Overlay Architecture 기반 단계별 보완 작업

> 원본은 작업자 로컬 계획서와 동기화. 저장소 내 구현·문서 진행 상황은 `OVERLAY_ARCHITECTURE_CONTRACTS.md` 참고.

## 작업 목적

현재 JYOrchestration 플랫폼은 이미 다음 구조를 일부 보유하고 있다.

- SingleChat
- Multi-Agent orchestration
- AI Member
- Cursor execution
- Execution review
- Knowledge Pack
- orchestration state
- Stage1 / Stage2 execution flow

이번 작업의 목적은 기존 프로세스를 깨지 않고,
현재 구조 위에 AI Organization Operating System 철학을 점진적으로 반영하는 것이다.

중요:
이번 작업은 “재구축”이 아니라 “Overlay Architecture 기반 보완”이다.

즉:

- 기존 흐름 유지
- 기존 실행 파이프라인 유지
- 기존 UX 유지
- 기존 Stage1/Stage2 유지

를 전제로 한다.

---

# 절대 원칙

## 금지 사항

- Stage1 / Stage2 / ENV_TEST 실행 흐름 변경 금지
- Cursor 실행 흐름 변경 금지
- GitHub 자동화 흐름 변경 금지
- 대규모 리팩토링 금지
- DB 구조 대규모 변경 금지
- orchestration 재작성 금지
- 기존 Prompt 흐름 변경 최소화

---

# 핵심 철학

현재 플랫폼은:

```text
단일 AI Assistant
```

가 아니라,

```text
Visible AI Team Collaboration Platform
```

이다.

또한:

```text
Function-based AI
```

가 아니라,

```text
Identity-based AI Organization
```

방향으로 진화해야 한다.

---

# 작업 전략

현재 구조를 제거하지 말고,
“의미와 계약(Contract)”을 추가하는 방식으로 진행한다.

즉:

| 현재 구조 | 새 의미 |
|---|---|
| ai-facilitator | Orchestration Entry |
| platformAiMembers | AI Identity Catalog |
| requirementsStateJson | Project Orchestration Memory |
| executionReviewWithAiMembers | Review Harness |
| knowledgePackRetrievalService | Knowledge Retrieval Provider |

처럼 “재해석”하는 방향이다.

---

# 1단계. 현행 구조 명명 작업

## 목표

현재 구조가 어떤 역할을 하는지 코드/문서 수준에서 명시한다.

## 작업 내용

다음 구조에 대해 코드 주석 및 문서 보강:

- ai-facilitator
- platformAiMembers
- requirementsStateJson
- executionReviewWithAiMembers
- knowledgePackRetrievalService

## 산출물

- architecture md 문서
- 코드 주석
- 현재 구조 ↔ 철학 매핑표

---

# 2단계. AI Identity Contract 추가

## 목표

AI멤버를 단순 실행 기능이 아니라 “역할 기반 주체”로 정의한다.

## 작업 내용

다음 개념을 타입/상수 기반으로 추가:

- role
- perspective
- capability
- provider
- memoryScope
- knowledgeScope

예시 역할:

- planner
- analyst
- architect
- designer
- developer
- reviewer
- security

## 중요

- 기존 DB 구조 변경 최소화
- 기존 ProjectMember 흐름 유지
- 기존 AI 초대 구조 유지

## 추가 원칙

AI개발자만 Cursor execution 가능하도록 기본 정책 정의.

---

# 3단계. Memory Scope Contract 추가

## 목표

현재 저장 구조에 “기억 의미”를 부여한다.

## 작업 내용

다음 MemoryScope 타입 추가:

```ts
platform
project
role
session
working
```

## 현재 구조 매핑

| 현재 데이터 | 의미 |
|---|---|
| requirementsStateJson | project memory |
| ChatMessage | conversation record |
| MessengerPromptTimelineLog | prompt audit |
| localStorage/sessionStorage | working memory |

## 중요

- DB migration 금지
- 기존 persistence 흐름 유지
- “새 메모리 시스템 구축” 금지

---

# 4단계. Context Assembly Contract 추가

## 목표

프롬프트 조립 과정을 추적 가능하게 만든다.

## 작업 내용

Prompt assembly metadata 추가:

```ts
usedRole
usedMemoryRefs
usedKnowledgePacks
usedStage
tokenBudgetHint
```

## 중요

- 기존 buildPrompt 계열 유지
- 응답 품질 영향 최소화
- Prompt 구조 대규모 변경 금지

---

# 5단계. Knowledge Pack Activation 기초 구조 추가

## 목표

지식팩을 “활성화 가능한 실행형 지식”으로 다룰 기반 마련.

## 작업 내용

runtime helper 수준으로:

```ts
ActiveKnowledgePackRef
```

구조 추가.

포함 항목:

- targetRoles
- activationReason
- priority
- status

## 중요

- 기존 retrieval 흐름 유지
- DB 변경 최소화
- 현재는 activation metadata 중심

---

# 6단계. Review Harness 의미 분리

## 목표

현재 execution review 흐름을 Harness 후보 계층으로 정리한다.

## 작업 내용

executionReviewWithAiMembers 내부 역할 정리:

- member selection
- context build
- model execution
- result aggregation

## 중요

- 기존 실행 흐름 유지
- Stage1/2 영향 금지
- Cursor/GitHub 흐름 영향 금지

---

# 7단계. 진단 보고서/API 보완

## 목표

현재 구조와 철학 반영 상태를 지속적으로 추적 가능하게 만든다.

## 작업 내용

진단 보고서 보완:

- Identity-based AI 관점 추가
- Harness 부재/부분반영 구분 강화
- Persistent Memory 관점 추가
- Context Orchestration 위험도 분석 추가
- Knowledge Activation 부족 영역 추가

---

# 중요 구현 원칙

## 반드시 유지해야 하는 것

- 기존 프로세스
- 기존 UX
- 기존 AI 흐름
- 기존 Stage1/Stage2
- 기존 Cursor execution
- 기존 Git automation

## 우선해야 하는 것

- 타입
- 계약
- metadata
- helper
- 문서
- 구조 의미 명시

## 나중에 해야 하는 것

- 대규모 리팩토링
- orchestration 통합
- memory 재설계
- provider 재구축

---

# 핵심 목표

현재 플랫폼은 이미 AI orchestration의 씨앗을 가지고 있다.

이번 작업의 목표는:

```text
새 플랫폼 구축
```

이 아니라,

```text
현재 플랫폼 위에
AI Organization Operating System 철학을 점진적으로 주입
```

하는 것이다.
