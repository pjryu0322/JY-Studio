# AI Team Execution Runtime Level 3 — Live E2E 실제 실행 및 Evidence 반영 (최종)

> **대상:** 운영자(로컬 환경). Cursor/CI는 live E2E를 수행·PASS로 기록하지 않으며, `docs/runtime/evidence/*.md` 원문을 커밋하지 않는다.

## 현재 결론

소스·helper·runbook·scan 작업은 `main`에 반영 완료.

| 항목 | 상태 |
|------|------|
| PR #13 — Runtime 1차 연결 | 완료 |
| PR #14 — Timeline / Run Log 가시화 | 완료 |
| Live E2E helper + lib + scan | 완료 |
| Evidence review 문서 | 완료 |
| 운영자 evidence | **없으면 보류** |
| Level 3 다음 단계 | **evidence PASS 전 보류** |

다음 작업은 **운영자가 로컬에서 Live E2E를 수행 → evidence 생성 → scan → manual-e2e에 요약만 반영**이다.

관련:

- `ai-team-runtime-level3-live-e2e-runbook.md` — API·env·실패 분류
- `ai-team-runtime-level3-manual-e2e.md` — 최종 판정 (커밋 대상)
- `ai-team-runtime-level3-evidence-review.md` — evidence 검토 로그

---

## 절대 금지

- evidence 없이 PASS 처리
- Cursor가 live E2E 수행·PASS 기록
- Runtime / DB schema / Stage1·2 / ENV_TEST 로직 변경
- read-only 검증 계층·신규 H 계층 추가
- session cookie, token, password, API key 원문을 커밋·문서·evidence에 기록
- `docs/runtime/evidence/*.md` 원문 커밋

---

## 1. main 최신화

```bash
git checkout main
git pull origin main
git status
```

기대: working tree clean, `main` 최신.

---

## 2. 로컬 앱 실행

```bash
cd projects/JYOrchestration/apps/web
npm install
npx prisma generate
npm run dev
```

브라우저: `http://localhost:3000`

확인: 로그인, DB, 프로젝트 화면, Cursor/GitHub 연동, AI Reviewer / Security / SCM Manager.

---

## 3. 일반 Task Runtime 실행

**금지:** ENV_TEST, Stage1, Stage2 환경검증 Task.

**필수:** `ExecutionSetup.requireApprovalBeforeApply = true`

목표:

```text
AI개발자 실행 → branch/commit/PR → Review → Security → approval_waiting
```

---

## 4. Session cookie 확보

DevTools → Cookies → 요청 `Cookie` 전체 문자열. 민감정보 — 채팅·git·evidence·manual-e2e 원문 금지.

---

## 5. Evidence Helper — 승인 전 (E2E A)

```bash
cd projects/JYOrchestration/apps/web

JYO_BASE_URL=http://localhost:3000 \
JYO_PROJECT_ID=<projectId> \
JYO_TASK_ID=<taskId> \
JYO_SESSION_COOKIE='<cookie>' \
node scripts/ai-team-runtime-live-e2e-check.mjs
```

성공: `execution-runs success` ~ `stage order` PASS, `Evidence written: ...`

출력 (gitignore): `docs/runtime/evidence/ai-team-runtime-live-e2e-YYYY-MM-DD-HHMMSS.md`

---

## 6. Evidence Helper — 승인 후 (E2E B)

`approval_waiting` 확인 후 (`JYO_APPROVE=1`은 Task 상태 변경):

```bash
JYO_APPROVE=1 \
JYO_PROJECT_ID=<projectId> \
JYO_TASK_ID=<taskId> \
JYO_SESSION_COOKIE='<cookie>' \
node scripts/ai-team-runtime-live-e2e-check.mjs
```

성공: `WARNING: ...`, `Approve API: PASS`, approval/scm·`teamRuntime.status` 실제와 일치, `Evidence written: ...`

---

## 7. Evidence Scan

```bash
cd projects/JYOrchestration/apps/web
node scripts/scan-live-e2e-evidence.mjs
```

기대:

```text
Evidence files: 1 이상
Live E2E conclusion: PASS / PARTIAL / FAIL
Sensitive pattern hits: 0
```

민감정보 감지 시: evidence 원문 커밋 금지 → 제거/삭제 후 재생성 → manual-e2e에는 요약만.

---

## 8. ENV_TEST / Stage1 / Stage2 (E2E C)

ENV_TEST Task 실행 후:

```text
PR_OPENED terminal success 유지
일반 Review/Security/Approval/SCM 미진입
Stage1 / Stage2 회귀 없음
```

---

## 9. Manual E2E 문서 갱신

대상: `ai-team-runtime-level3-manual-e2e.md`

### Evidence PASS

```md
## Live Evidence 반영

- Evidence generated: yes
- Evidence file: docs/runtime/evidence/<filename> (원문 gitignore, 요약만 반영)
- Live E2E result: PASS
- execution-runs API: PASS
- Timeline length/order: PASS
- Approval/SCM transition: PASS
- ENV_TEST preservation: PASS/PARTIAL
- Sensitive pattern hits: 0

## 결론

- Level 3 Timeline 운영 검증: PASS
- Level 3 다음 단계 진입 가능 여부: 가능
```

### PARTIAL / FAIL

결론 절에 PARTIAL/FAIL·보류·실패 사유 기록 (manual-e2e 내 템플릿 참고).

---

## 10. 다음 단계 판정

**진행 가능:** 자동 검증 PASS, live API·timeline PASS, E2E A/B/C 충족, 민감정보 없음 → **TaskHistory / appendTaskProgressLog Timeline 통합**

**보류:** evidence 없음, 환경 미준비, API/timeline 실패, approval/scm 불일치, ENV_TEST 회귀, 민감정보 evidence

---

## 11. 운영자 결과 보고 (채팅/이슈)

```md
## Live E2E 실행 결과
- E2E A 일반 Task Runtime:
- E2E B 승인 후 SCM 재개:
- E2E C ENV_TEST 보존:

## Evidence
- evidence 생성 여부:
- evidence 파일명:
- scan 결과:
- 민감정보 포함 여부:
- execution-runs API:
- timeline length/order:
- approval/scm 상태:

## 문서 갱신
- ai-team-runtime-level3-manual-e2e.md 갱신 여부:
- 최종 판단:
- 다음 단계 진입 가능 여부:

## 다음 작업 제안
- TaskHistory / appendTaskProgressLog Timeline 통합
```

---

## 최종 주의

병목은 **운영자 live evidence 미생성**이다. evidence PASS 전까지 TaskHistory 통합·Role Run·Retry/Cancel/Resume으로 진행하지 않는다.
