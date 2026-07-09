# P26 GitHub Auto Collect E2E Checklist

대상 repository: [nhn/tui.grid](https://github.com/nhn/tui.grid)

목표: **TOAST UI Grid** 최소 구현 지식팩 — discovery → 등록 → draft → 승인 → 활성화 → Context/retrieval 노출까지 수동 검증.

## 사전 조건

- JYKStore dev 서버 실행 (`npm run dev`, 포트 3004)
- Provider 프로필·DRAFT 상태 지식팩
- (선택) `JYKSTORE_ADMIN_OPS_TOKEN` 설정 시 Admin API guard 통과
- **GitHub private repo / token UI 사용 금지** (public repo URL만)

## 단계별 확인

### 1. Provider Pack 생성

- **경로:** `/provider/packs/new`
- **기대:** DRAFT 지식팩 생성, `packId` 확보

### 2. GitHub 자동수집 — Repository URL

- **경로:** `/provider/packs/[packId]` → GitHub Repository 자동수집
- **입력:** `https://github.com/nhn/tui.grid`
- **기대:** 분석 버튼 활성, `SELECTED_PATHS` / `FULL_SRC` UI 없음

### 3. Repository 분석 (discovery preview)

- **기대 API:** `POST .../auto-collect/github/discover` (또는 UI 동등 호출)
- **기대 결과:** `nhn/tui.grid`, README/docs/examples 후보, `src`/`test`는 fetch 제외 또는 낮은 우선순위
- **보안:** response/log에 GitHub token 없음

### 4. SourceDocument 자동 등록

- **기대:** README, `docs/en/*.md`, `examples/basic` 등 선택 경로만 등록
- **기대:** `sourceUrl`이 GitHub blob URL, `content` DB 저장 (UI에는 원문 전체 미노출)

### 5. Knowledge Unit draft 생성

- **기대:** `AUTO_KNOWLEDGE_UNIT_DRAFT`, `isActive=false`, `metadata.reviewStatus=pending_review`
- **기대:** SourceDocument 없는 draft 없음

### 6. Provider draft 목록

- **경로:** 동일 Pack 편집 → Knowledge Unit 초안 패널
- **기대:** pending_review 목록, content/출처/evidence 확인 가능
- **기대:** DTO에 `SourceDocument.content` 없음

### 7. Admin approve

- **경로:** `/admin/knowledge-unit-drafts`
- **기대:** pending_review만 승인/반려, 승인 후 `reviewStatus=approved`, draft `isActive=false` 유지
- **실패 시:** AuditLog `ADMIN_CHUNK_UPDATE`, metadata에 content 없음 확인

### 8. Admin activate

- **기대:** approved draft만 [활성화] 버튼
- **기대:** `AUTO_KNOWLEDGE_UNIT` active chunk 생성, draft `activationStatus=activated`
- **기대:** 동일 draft 재활성화 시 409

### 9. Context / retrieval 검증

- **예시 query:** `TOAST UI Grid 컬럼 설정 방법`
- **활성화 전:** draft content 미노출
- **활성화 후:** active chunk content가 retrieval/Context 후보에 포함
- **기대:** Public API response shape 변경 없음

### 10. 회귀 보안

- [ ] GitHub token UI/response/log 노출 없음
- [ ] Provider/Admin DTO에 SourceDocument.content 원문 없음
- [ ] AuditLog metadata에 draft/source content 없음
- [ ] API 오류 응답에 stack trace 없음

## 자동 E2E (CI)

```bash
cd projects/JYKStore
node --import tsx --test src/__tests__/github-auto-collect-e2e.test.ts
```

실제 `api.github.com` 호출 없음 — mock fixture만 사용.

## 실패 시 로그

- `scope=provider-route` / `admin-route` / `github-*` safe route error
- Pack preflight: DRAFT 아님, Provider 프로필 없음
- Draft: `NOT_APPROVED`, `ALREADY_ACTIVATED` 등 service error code
