# JYOrchestration

Web-based AI development orchestration platform.

## Stack
- Next.js
- PostgreSQL
- Prisma

## Structure
- apps/web: frontend
- packages/*: core modules

## 테스트용 시드 데이터 (로컬/개발 전용)

메인 사용자 흐름(로그인 → 프로젝트 → 멤버 → AI 액션)을 빠르게 검증하기 위한 **고정 테스트 계정·프로젝트**를 넣습니다.  
**운영 DB에는 사용하지 마세요.** 평문 비밀번호는 DB에 저장되지 않으며, `bcrypt` 해시만 저장합니다.

### 실행 위치

저장소 루트: `projects/JYOrchestration` (이 디렉터리에서 실행)

### 명령

```bash
# 사용자·프로젝트·HUMAN/AI 멤버만 (idempotent)
npm run seed:test

# 위 + 샘플 AI 액션 3건(REVIEW / TASK_DRAFT / QA_CHECK)
npm run seed:test -- --with-actions
```

환경 변수 `JYO_SEED_WITH_ACTIONS=1` 로도 샘플 액션을 켤 수 있습니다.

### 생성되는 데이터

| 구분 | 내용 |
|------|------|
| 사용자 4명 | owner@jyo.local, editor@jyo.local, reviewer@jyo.local, viewer@jyo.local (비밀번호 공통 `JyoTest!123`) |
| 프로젝트 | 이름 **Web Meeting MVP**, 설명: 웹 기반 화상회의 서비스 검증 프로젝트 |
| HUMAN 멤버 | OWNER / EDITOR / REVIEWER / VIEWER |
| AI 멤버 3명 | OpenAI Reviewer (OPENAI), Draft Assistant, QA Checker (INTERNAL) |
| 선택 액션 | `correlationKey` 접두어 `jyo:test-seed:v1:` 로 중복 방지 |

### 추천 테스트 순서

1. `npx prisma migrate deploy` (또는 개발 중 `migrate dev`)로 스키마 적용  
2. `npm run seed:test`  
3. `owner@jyo.local` / `JyoTest!123` 로 로그인 → **Web Meeting MVP** 진입  
4. `editor@` / `reviewer@` / `viewer@` 로도 로그인해 동일 프로젝트가 **목록에 노출**되는지 확인(멤버십 기준 목록)  
5. 멤버 목록에서 HUMAN 4역할·AI 3명 확인  
6. (선택) `npm run seed:test -- --with-actions` 후 AI 액션 목록에서 샘플 3건 확인  

### 재실행 시

같은 이메일·같은 프로젝트명+소유자·같은 `aiAgentKey`·같은 시드 `correlationKey`는 **건너뛰므로** 데이터가 중복 증가하지 않습니다.

## 자동 테스트 하네스 (API + E2E + 결과 집계)

Next.js는 **동일 워크스페이스에 dev 서버를 하나만** 띄울 수 있습니다. 로컬에서 전체 하네스를 돌릴 때는 **터미널 A**에서 먼저 개발 서버를 실행한 뒤 **터미널 B**에서 테스트를 실행하세요.

### 사전 준비

1. DB 마이그레이션 + `npm run seed:test -- --with-actions` (또는 하네스가 시드를 다시 실행)
2. 터미널 A: `pnpm dev` → `http://127.0.0.1:3000`
3. (E2E 최초 1회) `pnpm --filter web run test:e2e:install` — Chromium 설치

### 명령 (저장소 루트 `projects/JYOrchestration`)

| 명령 | 설명 |
|------|------|
| `npm run test:api` | **이미 3000에서 서버가 떠 있다고 가정.** Vitest API 통합 테스트 (`TEST_BASE_URL=http://127.0.0.1:3000`) |
| `npm run test:e2e` | Playwright E2E. 로컬에서는 기존 dev 서버 **재사용**(`reuseExistingServer`). `CI=true` 이면 자체로 `pnpm dev` 기동 |
| `npm run test:aggregate` | `vitest-raw.json` + `playwright-raw.json` → `.artifacts/test-results/latest.json` |
| `npm run test:all` | 시드 후 **3000 응답 대기** → `test:api` → `test:e2e` → 집계 (**dev는 미리 실행**) |

### 결과 파일

- `.artifacts/test-results/vitest-raw.json` — Vitest JSON 리포터 출력  
- `.artifacts/test-results/playwright-raw.json` — Playwright JSON 리포터 출력  
- `.artifacts/test-results/latest.json` — 위 둘을 합친 요약(집계기)  
- `.artifacts/test-results/history/*.json` — 집계 시점별 복사본
