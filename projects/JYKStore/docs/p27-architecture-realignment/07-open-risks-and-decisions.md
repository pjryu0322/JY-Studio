# 07. Open Risks and Decisions

## Q1. 기존 Published Pack은 SourceDocument·Unit·Chunk 중 무엇에 의존하는가?

**DECIDED**

- Catalog: `KnowledgePack` 메타/상태만 (`pack-catalog-service.ts`)
- Retrieval/Export package·rag-jsonl: active `KnowledgeChunk.content` (`retrieval-response-mapper.ts`, export services)
- Unit 전용 테이블 없음 → Unit은 Chunk 타입으로 저장
- SourceDocument는 출처/검증 메타 및 일부 관계에 사용, Catalog 필수는 아님

## Q2. 내부 Builder UI를 제거해도 Catalog와 Export가 유지되는가?

**RECOMMENDED**

- Catalog: 유지(의존 없음)
- Export/Retrieval: **기존 Chunk 데이터가 남아 있으면** 유지
- 신규 Pack은 Payload Import 없이는 지식 본문 공급 불가 → P28-E 선행 또는 신규 등록 일시 중단

## Q3. Retrieval API는 Chunk 본문을 직접 사용하는가?

**DECIDED** — 예. `src/lib/retrieval/retrieval-response-mapper.ts`에서 `content: item.chunk.content`.

## Q4. MCP는 어떤 API 또는 Service를 호출하는가?

**DECIDED**

- `mcp-server/tool-handlers.ts` → HTTP Public APIs
- Retrieval, graph, exports(package/rag-jsonl/graph/openapi/mcp-manifest) 및 chunk variants
- Prisma 직접 접근 없음 (`production-safety.test.ts` 근거)

## Q5. ProviderProfile을 계정정보로 통합할 때 깨지는 기능은 무엇인가?

**RECOMMENDED**

- 이미 `ensureProviderProfileForAccount` 자동연결이 존재
- 잔여 리스크: 수동 프로필 편집 UI/API (`ProviderProfileEditor`, `/api/v1/provider/profile`)
- Pack `providerProfileId` FK — 프로필 레코드 자체는 KEEP

## Q6. Guest 역할 제거 시 공개 Catalog 접근에 문제가 있는가?

**DECIDED**

- `GUEST` enum 없음. 비로그인 브라우징은 세션 없이 Catalog 접근
- Dead copy `ACCOUNT_GUEST_*` 제거해도 Catalog 무영향
- 일부 테스트(`account-role-registration-ux.test.ts`)는 구 Guest UX 가정 → 정리 필요

## Q7. Ops Token UI 제거 시 운영자 인증은 무엇으로 대체되는가?

**DECIDED**

- Account `ADMIN` 세션 + `requireAdminSession` / `AdminAccessGate`
- Ops Token UI는 이미 없음. `JYKSTORE_ADMIN_OPS_TOKEN`은 로그 마스킹 잔재만

## Q8. PipelineRun 삭제 전에 보존해야 할 Audit 정보는 무엇인가?

**NEEDS_RUNTIME_REPLACEMENT**

- `AuditLog`의 Builder/Admin chunk·submit·approve 이벤트
- `PackReview.submitSnapshot` JSON (제출 당시 게이트)
- PipelineRun/StepLog는 운영 디버깅용 — drop 전 Audit 정규화 권장

## Q9. DB Migration 없이 먼저 제거 가능한 범위는?

**DECIDED**

- UI 탭/메뉴/CTA
- 신규 생성 API 비활성
- 미사용 컴포넌트/카피/테스트
- Admin KU drafts 진입
- **불가:** Chunk/SourceDocument/Pipeline 테이블 drop, Retrieval response shape 변경

## Q10. P28에서 가장 큰 회귀 위험 5개

**RECOMMENDED**

1. approve가 release/quality gate에 묶인 채 평가 API를 끄면 승인 불가
2. auto-prepare/submit 파이프라인 중단 시 신규 검수 패키지 공백
3. Chunk 생성 중단 후 신규 Pack Retrieval 결과 공백
4. MCP/Export가 빈 chunk set을 만나 계약은 지키나 사용성 붕괴
5. Builder 테스트 대량 실패로 CI 신호 마비(차단과 동시에 테스트 정리 필요)

---

## 추가 결정 로그

| 주제 | 상태 | 메모 |
|---|---|---|
| Admin Advanced 재생성 | RECOMMENDED REMOVE UI | 조회 evidence는 유지 |
| Payload Import | BLOCKED (P27 비구현) | P28-E |
| Runtime Index | BLOCKED | Chunk 대체 전제 |
| PackStatus enum 개편 | DEFER | Migration 동반 |
