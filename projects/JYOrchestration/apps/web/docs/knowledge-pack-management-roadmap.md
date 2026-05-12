# 지식팩 관리 고도화 로드맵

JYOrchestration의 지식팩은 **정적 seed 조회 MVP**에서 출발해, **등록·수정·버전·이력·Agent 최적화·검수/승인**까지 갖춘 **운영 가능한 지식 기준 체계**로 확장한다. 이 문서는 방향·데이터 모델 초안·권한·화면 구조·단계별 계획을 정리한다. (DB 마이그레이션·실 API·LLM 연동은 본 문서 범위의 “다음 단계”에서 수행한다.)

---

## 1. 현재 상태 (Phase 1 기준)

- 플랫폼 **정적 seed** 기반 지식팩 5종: Grid 4종(`grid.ag-grid-community`, `grid.tanstack-table`, `grid.tabulator`, `grid.toast-ui-grid`) + 인증 1종(`auth.kakao-login`)
- 라우트: `/knowledge-packs`, `/knowledge-packs/detail`
- AI Agent / 카테고리 필터, 목록, **별도 창** 상세 탭(요약·구현 지침·Cursor 반영·금지사항·검수·미리보기), Mock 미리보기, Markdown보내기
- 주요 코드: `types.ts`, `developerGridPacks.ts`, `developerAuthPacks.ts`, `developerKnowledgePacks.ts`, `knowledgePackSources.ts`, `KnowledgePacksPageClient.tsx`, `KnowledgePackDetailPanel.tsx`, `KnowledgePackApplyPreview.tsx`, `tests/api/knowledgePacksSeed.unit.test.ts`

### 1.2 AI 초안 등록 UX (서버 LLM + Mock fallback)

지식팩 등록은 제품명·제품 URL·공식 문서 URL 등 최소 정보를 입력하면 AI가 지식팩 초안을 생성하고 사용자가 검토·수정·저장하는 방식으로 발전한다.

AI 초안은 **`POST /api/knowledge-packs/draft`** 로 요청한다. 서버는 사용자 OpenAI 연동 키 또는 `OPENAI_API_KEY`(직접)로 OpenAI Chat Completions를 시도하고, 키가 없거나 호출·JSON 파싱 실패 시 **`generateKnowledgePackDraftMock`** 으로 안전하게 대체한다. API Key는 프론트에 노출하지 않는다.

등록 전에는 **`POST /api/knowledge-packs/precheck`** 로 룰 기반 사전점검을 수행한다. 공식 문서·API 명세·라이선스/약관·보안/개인정보 위험·RAG 적합성·사용자 제공 문서 필요성을 점검하고, 판정은 **REGISTERABLE / LIMITED_REGISTERABLE / USER_SOURCE_REQUIRED / NOT_RECOMMENDED** 네 단계다. 사전점검 결과는 AI 초안 생성 요청에 선택 필드로 실려 **warnings·원천자료 안내**에 반영된다. DB 지식팩 저장 시 본문 `precheckSummary`를 넘기면 이력에 `Precheck: …` 한 줄이 추가된다(`PRECHECK` 액션). 별도 사전점검 전용 테이블은 후속.

사전점검은 지식팩 등록 전 품질 게이트로 사용한다. **RAG 1단계**는 원천자료 수집, 파싱, 청크 저장, KEYWORD 검색까지 지원한다. **Embedding/vector store**는 RAG 2단계다. **`POST /api/knowledge-packs/build-prompt-context`** 로 수동 선택 지식팩·검색어 기반 `contextText`를 미리 볼 수 있다. **AI개발자/Cursor 프롬프트 주입**은 1차로 `knowledgePackContextText` 선택 필드로 `buildCursorExecutionPrompt` / 프로토타입 프롬프트 빌더에 `## Knowledge Pack Context` 블록을 삽입하는 방식으로 시작한다. 자동 지식팩 추천/선택은 후속 단계다.

AI 초안 생성 결과는 바로 ACTIVE가 아니라 DRAFT로 저장하며, 라이선스·보안·개인정보·Secret 관련 내용은 검수·승인 대상이다.

실제 원천자료 기반 학습은 **RAG 파이프라인**으로 분리한다. **1단계(현재 구현)**: Prisma `KpKnowledgePackSource` / `Chunk` / `IndexJob`, DNS·사설망까지 고려한 URL fetch 가드, 평문 파싱, 겹침 청크 저장, `POST /api/knowledge-packs/retrieve-context` 표준 응답(`mode=KEYWORD`, `promptContext`, `diagnostics`, `chunkId`, `sourceUrl` 등), 정적 시드 **`POST /api/knowledge-packs/[id]/clone`** 복제, `knowledgePackPromptContextBuilder` / `knowledgePackPromptInjectionAdapter` 로 Agent 프롬프트 주입 준비, 관리 UI의 원천자료·RAG 검색 테스트 섹션. **2단계(다음)**: 임베딩·벡터 저장·의미·하이브리드 검색, Agent별 retrieval 정책, Cursor 실행 파이프라인 자동 주입, AI검수자/AI보안관 체크리스트 자동 보강. Stub 파이프라인(`knowledgePackRagPipeline.ts`)은 2단계용 타입·플레이스홀더로 유지한다.

**RAG 1단계 보완(요약):** retrieve-context 응답 표준화, promptContext·diagnostics, keyword 결과를 프롬프트 블록으로 변환, URL 수집 보안 가드 강화, static seed 복제 후 사용자 지식팩에서 RAG 관리.

**RAG 2단계(요약):** embedding provider, vector store, vector retrieval, hybrid retrieval, Agent별 retrieval policy, Cursor 프롬프트 자동 주입.

향후에는 원천자료 후보를 DB `KpKnowledgePackSource`로 저장하고, 위 파이프라인과 연동한다(1단계에서 시작됨).

---

## 1.1 국내 공개 문서 기반 1차 후보 (정적 seed)

다음은 **온라인 공개 문서**를 바탕으로 한 1차 지식팩 후보며, 현재는 **정적 seed**로 등록되어 있다. 향후 **원천자료 URL 등록 → AI 구조화 → RAG 색인·벡터 저장소**로 확장할 수 있다.

| id | 제품·주제 | 카테고리 | 비고 |
|----|------------|----------|------|
| `grid.toast-ui-grid` | NHN TOAST UI Grid | GRID | 국내 오픈소스 Grid 확장 후보 |
| `auth.kakao-login` | Kakao Login | AUTH | OAuth·인증 연계 확장 후보 |

- TOAST UI Grid: Grid 지식팩 확장, React wrapper·라이선스는 공식 문서에서 버전별 확인.
- Kakao Login(`auth.kakao-login`)은 외부 서비스 연동 지식팩으로 **license type `EXTERNAL_SERVICE`** 로 관리한다 (UI: 외부 서비스).
- 정적 seed는 파일로 **`developerGridPacks`(Grid 4종)**, **`developerAuthPacks`(Auth 1종)**, 엔트리 **`developerKnowledgePacks`(병합·resolver·라벨)** 로 분리했다.
- `references`는 단순 링크 배열을 유지하되, 런타임에서 **`KnowledgePackSource`** 후보로 유도할 수 있다 (`knowledgePackSources.ts`의 `referencesToKnowledgePackSources`). 향후 DB·RAG에서는 동일 개념의 원천자료 단위로 저장한다.
- **`KnowledgePackSource`** 는 RAG 색인의 원천자료 단위다. DB 모델 `kp_knowledge_pack_sources` 및 관리 API·UI로 등록·수집·청크(1단계)가 가능하다. 임베딩·벡터 저장은 다음 단계다.

향후 흐름(참고):

- `KnowledgePackSource` 등록·버전 연동
- 문서 파싱
- 청크 분할
- 임베딩 생성
- 벡터저장소 저장
- Agent별 검색
- 프롬프트 주입

---

## 2. 문제 인식

1. 운영 관점에서 **등록·수정·버전·이력**이 없다.
2. **카테고리 ↔ 지식팩**은 자연스럽게 1:N 관계로 고정해야 한다.
3. **Agent ↔ 카테고리** 매핑은 지식팩 내부 `agents[]`만으로는 부족하며, **별도 설정**(사용 모드·우선순위)이 필요하다.
4. 상세에 보이는 모든 섹션은 향후 **편집 가능한 버전 단위 콘텐츠**와 맞춰야 한다.
5. 사용자가 **최종 지식팩을 직접 자유 서술**하면 품질·보안·라이선스 리스크가 크다.
6. **원본 입력 → AI 구조화 → 검수·승인 → 활성화** 파이프라인이 필요하다.
7. **정적 seed는 유지**하되, 이후 **DB 기반**으로 치환 가능한 경계를 둔다.

---

## 3. 지식팩 운영 원칙

- 지식팩은 단순 문서가 아니라 **AI Agent 실행 기준 관리 체계**다. (기획·분석·설계·디자인·개발·검수·보안 참조 기준)
- **Scope**: `PLATFORM` | `ORGANIZATION` | `USER` | `PROJECT`
  - 일반 병합 우선순위: `PROJECT > ORGANIZATION > USER > PLATFORM`
  - 보안/라이선스: 하위 Scope가 상위보다 **완화 불가**, 강화만 가능
- **카테고리**는 지식팩의 대표 분류(추후 태그로 보조 분류 확장 가능).
- **Agent–카테고리** 관계는 `AgentCategoryMapping` 등 **별도 설정**으로 관리한다.
- 최종 본문은 **원본 등록 → AI 구조화 → Agent별 최적화 → 검수/승인 → ACTIVE**를 거친다.

---

## 4. 권장 등록·운영 흐름

1. **원본 등록** (이름, 카테고리, 제품/기술, 벤더, 라이선스, URL·파일·설명, Scope, 적용 Agent 후보, 주의사항 등) → `Raw Knowledge Source` / Draft
2. **AI 구조화** (요약, 권장/비권장, 기능, 제약, 구현 지침, Cursor 규칙, 금지, 검수·보안 체크리스트, 대체, 참고, 미리보기 정의 등)
3. **Agent별 최적화** (프로필별 주입 요약·필수 규칙·금지·체크리스트)
4. **검수/승인** (품질·라이선스·보안·주입 안전성·Scope 적절성)
5. **활성화** 및 이후 수정 시 **새 버전 + 이력 보존**

상태 후보: `DRAFT` → `REVIEW_REQUESTED` → `APPROVED` → `ACTIVE` / `ARCHIVED` (세부는 구현 시 조정 가능)

---

## 5. 권장 데이터 모델 초안 (스키마 전 단계)

런타임 타입 초안은 `src/lib/knowledge-packs/knowledgePackManagementTypes.ts`에 정리한다. DB 테이블은 Phase 3에서 도입한다.

| 개념 | 설명 |
|------|------|
| **KnowledgePack** | id, scope, categoryId, name, description, vendor?, licenseType, status, currentVersionId, 감사 필드 |
| **KnowledgePackVersion** | knowledgePackId, version, changeSummary, sourceType, status, 감사 필드 |
| **KnowledgePackSection** | versionId, sectionKey(SUMMARY, …, PREVIEW_SPEC), content, sortOrder |
| **AgentKnowledgeProfile** | versionId, agentRole, purpose, promptInjectionSummary, mustIncludeRules, forbiddenRules, checklist |
| **AgentCategoryMapping** | agentRole, categoryId, enabled, usageMode, priority |
| **KnowledgePackHistory** | knowledgePackId, versionId?, action, actorId, actorType, summary, createdAt |
| **KnowledgePackSource** | knowledgePackId, sourceType(URL/FILE/TEXT/MANUAL), title, url?, fileId?, rawText?, 감사 필드 |

---

## 6. 권한 구조 초안

| 역할 | 예시 권한 |
|------|-----------|
| 일반 사용자 | 프로젝트 지식팩 초안, 본인 초안 수정, AI 구조화 요청 |
| 프로젝트 관리자 | 프로젝트 지식팩 승인·활성화, 프로젝트 Scope 편집 |
| 조직 관리자 | 조직 지식팩 등록·승인, 조직 표준 |
| 플랫폼 관리자 | 플랫폼 기본 지식팩, 카테고리, Agent 매핑 |
| AI검수자 / AI보안관 | 품질·보안/라이선스 검토 (워크플로 단계로 반영) |

원칙: 플랫폼 지식팩은 일반 사용자 직접 수정 불가. 보안/라이선스는 하위 Scope에서 완화 불가.

---

## 7. 관리 화면 구조 제안

- 전역: `/knowledge-packs`(조회) 외 `/knowledge-packs/manage`, `/categories`, `/agent-mapping`, `/history`, `/review` 등 (단계적 도입)
- 메뉴: 목록, 등록, 카테고리, Agent 매핑, 승인 대기, 변경 이력
- 상세 확장: 기본 정보, 버전 이력, 섹션, Agent 프로필, 미리보기, 테스트, 검수 결과, 활성화
- **등록 Wizard** (원본 → AI 구조화 → Agent 최적화 → 검수 → 승인/활성화): Phase 2에서 UI 초안

---

## 8. 단계별 구현 로드맵

| Phase | 내용 |
|-------|------|
| **1 (현재)** | 정적 seed, 조회·상세·미리보기, **관리 확장 지점 UI**, 본 로드맵 문서 |
| **2** | 등록 Wizard·원본 입력·AI 결과 Preview·Agent Preview·이력/Mock 매핑 화면 |
| **3 (진행)** | DB 모델: KnowledgePack, Version, Section, History + **RAG 1단계** Source·Chunk·IndexJob, 수집·청크·키워드 검색 API |
| **4** | LLM 기반 구조화·Agent 프로필 자동 초안·보안/라이선스 추출 |
| **5** | 검수/승인 워크플로, ACTIVE 지정, 이전 버전 보존 |
| **6** | Agent 실행 컨텍스트 주입 (매핑·Scope 병합·프로필 추출·프롬프트 연동·테스트 하네스) |
| **7 (RAG 2)** | 임베딩·벡터 DB·의미 검색·`retrieve-context` 벡터 모드·프롬프트 주입 |

---

## 9. 이번 MVP에서 유지할 것 / 제외할 것

**유지**

- 5종 seed **핵심 문구·구조** 훼손 없음 (기존 Grid 3종 문맥 유지, 신규 2종은 별도 id)
- 기존 조회·상세·테스트·파이프라인(Stage1/ENV_TEST/GitHub/Cursor) 비변경

**제외 (다음 단계)**

- DB 마이그레이션, 실제 등록/수정 API, 실제 LLM 호출, Agent 런타임 프롬프트 주입

---

## 10. 다음 개발 단계 제안

1. Phase 2: `/knowledge-packs/manage` 라우트 스텁 + Wizard 와이어프레임
2. Phase 3: Prisma 스키마 초안 및 마이그레이션 설계 리뷰
3. seed → DB **이중 공급**(읽기 경로 추상화)으로 점진 전환
4. 플랫폼 관리자 전용 네비 게이트 연결

---

## 참고 파일

- 제품 코드: `apps/web/src/lib/knowledge-packs/*`, `apps/web/src/components/knowledge-packs/*`
- 설계용 타입: `apps/web/src/lib/knowledge-packs/knowledgePackManagementTypes.ts`
- 작업 프롬프트 원문: `jyorchestration_knowledge_pack_management_roadmap_cursor_prompt.md` (외부 보관 시)
