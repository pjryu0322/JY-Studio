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

### Dev 요약 API (선택)

로컬에서만, `.env.local` 등에 다음을 넣은 뒤:

`ENABLE_DEV_TEST_SEED_API=true`

브라우저 또는 `GET /api/dev/test-seed-summary` 로 프로젝트 ID·멤버 ID·시드 액션 ID를 JSON으로 확인할 수 있습니다.  
`NODE_ENV=production` 이면 항상 404입니다.

시드 스크립트(`packages/db/scripts/seed-test-data.mjs`)와 `apps/web/src/lib/dev/testSeedConstants.ts`의 프로젝트명·소유자 이메일·correlation 접두어는 **동기화**해 두었습니다.
