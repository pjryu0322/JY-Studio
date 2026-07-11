# 05. P28 Deletion Plan

원칙: **신규 Builder 생성만 먼저 차단**하고, 기존 Published Pack의 Chunk 읽기·Retrieval·MCP는 유지한다. DB Migration/데이터 삭제는 P28에서 하지 않는다.

## P28-A: UI 진입 차단

```text
[MODIFY] src/components/ProviderPackTabs.tsx / provider-pack-tabs.ts
- 제거할 UI: source/draft/inspection 탭 또는 Builder CTA
- 유지할 UI: basic + review(검수요청) + 향후 payload 탭 placeholder
- 예상 영향: 제공자 생성 경로 축소
- 검증: provider-pack-tabs-ux 테스트 갱신, 수동 /provider/packs/[id]
```

```text
[MODIFY] src/components/ProviderGitHubAutoCollectPanel.tsx
- 제거할 UI: 전체 패널 또는 “지원 종료” 안내로 교체
- 유지: 없음(또는 읽기 전용 기존 source 목록)
- 검증: 직접 URL/hash `#github-auto-collect` 시 안내
```

```text
[MODIFY] src/components/ProviderKnowledgeUnitDraftPanel.tsx / ProviderPackDraftTab.tsx
- 제거: 생성/재생성/병합 CTA
- 유지: 기존 draft 조회(옵션)
```

```text
[MODIFY] src/app/(store)/admin/knowledge-unit-drafts/page.tsx + AccountPageClient 링크
- 제거: 메뉴/진입
- 직접 URL: 안전한 안내 페이지
```

```text
[MODIFY] src/components/AdminReviewAdvancedActionsTab.tsx / AdminReviewDetailSections.tsx
- 제거: 재점검·Chunk 편집·재생성 CTA
- 유지: 제출 패키지/주의/문서 조회
```

```text
[MODIFY] src/lib/role-based-ux-copy.ts
- 제거: ACCOUNT_GUEST_* dead copy, Builder 유도 문구
```

## P28-B: API·Action 차단

```text
[MODIFY] src/app/api/v1/provider/github/repository-discovery/route.ts
[MODIFY] src/app/api/v1/provider/packs/[packId]/auto-collect/github/register/route.ts
[MODIFY] .../auto-collect/github/knowledge-units/draft/route.ts
- 신규 실행 비활성화(410/403 + 명확 메시지)
- 조회성 필요 시 GET만 유지
- 호출자: ProviderGitHubAutoCollectPanel, provider-center-api.ts
- 회귀: 기존 SourceDocument 읽기 API 유지
```

```text
[MODIFY] provider structure/chunk/retrieval evaluate routes (생성성 POST)
- 신규 평가 실행 비활성 또는 admin-only 임시 유지
- approve가 게이트에 묶여 있으면 approve 정책 선변경 필요 → 아니면 REPLACE 단계로 이관
```

```text
[MODIFY] admin knowledge-unit-drafts decision/activate routes
- 신규 활성화 차단
```

```text
[MODIFY] admin chunks generate / bulk edit routes
- 생성·수정 차단, list/get 유지 가능
```

## P28-C: Service 정리

호출자 0건 확인 후 제거 후보:

- `src/lib/github-auto-collect/**` (UI/API 차단 후)
- `src/lib/knowledge-unit-draft/**` (생성 경로 차단 후)
- Admin KU activation services
- 미사용 panel re-exports

선행: 테스트 목록에서 해당 파일 제거/rewrite.

## P28-D: Legacy 데이터 읽기 유지

필수 유지:

- `KnowledgeChunk` active rows for PUBLISHED packs
- Retrieval/Export/Context/MCP Public APIs
- Catalog status filtering
- PackReview history + submitSnapshot JSON
- AuditLog / ApiUsageLog rows

금지:

- Prisma drop, truncate, migrate remove columns
- Published pack status mass update

## P28-E: 후속 대체 설계 (구현은 별도 Phase)

- Payload Import API
- Distribution Manifest
- Runtime Adapter (index from payload)
- MCP는 Public API 계약 유지한 채 백엔드만 교체

## 즉시 제거 가능 vs 대체 후 vs DB 보류

| 구분 | 대상 |
|---|---|
| 즉시 제거 가능 (P28-A/B) | GitHub UI, KU draft 생성 CTA, Admin KU page 진입, Chunk 편집 CTA, dead Guest copy, Ops token 잔재 문서 |
| 대체 후 제거 | auto-pipeline chunk regen, quality/release gates as approve blockers, chunk retrieval internals |
| DB 정리 보류 | KnowledgeChunk, SourceDocument, PipelineRun, quality report tables |

## 검증 방법 (단계 공통)

1. `npm run lint`
2. `npm test` (차단 후 실패 테스트 정리)
3. 수동: Catalog 상세, Retrieval query, MCP tool smoke
4. Admin: 기존 REVIEWING pack 접수/승인 경로(게이트 정책 변경 시 시나리오 재작성)
