# 06. Regression Test Baseline

기록일: 2026-07-12. 명령은 `projects/JYKStore/package.json` 실제 스크립트 기준.

## 1. 사용 가능 스크립트

| 스크립트 | 존재 | 비고 |
|---|---|---|
| `npm run lint` | 예 | `next lint` |
| `npm run test` | 예 | tsx node:test 파일 목록 |
| `npm run test:unit` | 예 | test와 거의 동일(일부 파일 차이 가능) |
| `npm run build` | 예 | `next build` |
| `npm run mcp:test` | 예 | mcp-*.test.ts |
| typecheck | **없음** | `tsc --noEmit` 별도 스크립트 미정의 |
| e2e | **없음** | Playwright 등 미구성 |

## 2. Baseline 표

| 기능 | 테스트/명령 | 기대 결과 | 현재 결과 | 관련 파일 |
|---|---|---|---|---|
| Lint | `npm run lint` | exit 0 | _(실행 기록 하단)_ | `eslint.config.mjs` |
| Unit/Integration suite | `npm test` | 주요 스위트 pass | _(실행 기록 하단)_ | `src/__tests__/**` |
| Build | `npm run build` | production build 성공 | _(실행 기록 하단)_ | Next app |
| Typecheck | 없음 | N/A | **미실행(스크립트 없음)** | `tsconfig.json` |
| E2E | 없음 | N/A | **미실행** | — |
| 로그인/세션 | `auth-session.test.ts`, `admin-auth.test.ts` | 세션 쿠키/가드 | 스위트 포함 | auth routes |
| 역할 | `account-role.test.ts` | USER/PROVIDER/ADMIN | 스위트 포함 | `account-role.ts` |
| Catalog | 수동/코드경로 | PUBLISHED 노출 | 코드상 status 필터 | `pack-catalog-service.ts` |
| Provider Center | `provider-*-ux.test.ts` | 역할 게이트 | 스위트 포함 | provider pages |
| Admin Review | `admin-review-*.test.ts` | 탭/접수/승인 배선 | 스위트 포함 | admin review components |
| Publish gates | release-gate/readiness tests | FAIL 차단 | 스위트 포함 | release-gate libs |
| Export API | `public-export-route.test.ts`, `export-*.test.ts` | 인증/청크 응답 | 스위트 포함 | exports routes |
| Retrieval API | `retrieval-*.test.ts`, `public-api-*.test.ts` | chunk content 매핑 | 스위트 포함 | retrieval libs |
| MCP Bridge | `npm run mcp:test` | tool/resource 계약 | 스위트 포함 | `mcp-server/**` |
| API Key/Quota | `api-key-*.test.ts`, `quota-*.test.ts` | 발급/쿼터 | 스위트 포함 | api-key/quota |
| Health | `runtime-*.test.ts`, `production-safety.test.ts` | env/ready | 스위트 포함 | health routes |
| Builder (현존) | `github-*.test.ts`, KU draft tests | 현재 동작 보증 | 스위트 포함 | Builder libs |

## 3. 수동 스모크 (권장, P28 전)

1. `/login` → USER/PROVIDER/ADMIN
2. `/packs` Catalog 상세
3. `/provider` 진입 게이트
4. `/admin/reviews` 목록/상세
5. API Key로 `POST /api/v1/retrieval/query`
6. `GET /api/v1/exports/package`
7. `npm run mcp:stdio` tool list

## 4. 실행 기록

P27 문서 작성 직후(소스 기능 변경 없음) 실행.

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm run lint` | **PASS** (exit 0) | 기존 unused-var Warning 다수(Builder/admin 잔존). P27 문서와 무관 |
| `npm test` | **FAIL 2 / 592** | 기존 실패: `account-role-registration-ux.test.ts` (Guest/API Key UX 드리프트). P27 문서와 무관 |
| `npm run build` | **FAIL** | 기존: `provider-pack-service.ts` invalid UTF-8. P27 문서와 무관 |
| typecheck | SKIPPED | `package.json`에 typecheck 스크립트 없음 |
| e2e | SKIPPED | e2e 스크립트 없음 |

실패는 모두 **기존 이슈**로 분류한다. P27은 소스 수정을 하지 않는다.
