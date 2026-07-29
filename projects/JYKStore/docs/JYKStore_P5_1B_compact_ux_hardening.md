# JYKStore P5.1B — Compact UX Hardening

## 최종 판정

**P5.1B COMPACT UX HARDENING PASSED**

UI만 마무리. Workflow / Data Model / API 변경 없음.

## 1. 변경 사항

- 공통 `UiTooltip` + `tooltip-state` (hover / focus / tap)
- Correction UI 라벨 한글 전용 (`correction-ui-labels.ts`)
- `AdminKnowledgeCorrectionPanel` — 영문 chrome 제거, native `title` 제거
- UX 동작 테스트 보강 (`correction-workbench.test.ts`)

## 2. UI 라벨 변경

| 내부 | UI |
|------|----|
| Blocker | 차단 |
| Warning | 주의 |
| Open | 미처리 |
| Applied | 적용 |
| Regen | 재생성 |
| Done | 완료 |
| Exclude | 제외 |
| Merge | 통합 |
| Delete | 삭제 |
| Correction | 보정 |
| Sync / More / Regenerate / Verify… | 동기화 / 더보기 / 재생성 / 검증… |

Enum·API code는 영문 유지.

## 3. Tooltip 개선

- HTML `title` 미사용
- `role="tooltip"`, `aria-describedby`
- Hover / Keyboard focus / Mobile tap (sticky + outside dismiss / Esc)
- Primary 액션 버튼은 `enableTap={false}` + `aria-label` (탭이 액션을 가로채지 않음)
- ⓘ / 상태 라벨은 tap 툴팁 유지

## 4. 테스트

- Case 선택 / More 메뉴 / 고급 보기 / Primary apply(OPEN만) / 모바일 grid class
- Tooltip state machine (hover·focus·tap·dismiss)
- 패널 소스: `UiTooltip` 사용, 영문 chrome·`title=` 없음
- 결과: **22 pass / 0 fail** (correction + rail UX)

## 5. 최종 판정

| 기준 | 결과 |
|------|------|
| UI 영문화 제거 | ✅ |
| Tooltip 접근성 | ✅ |
| 기본 화면 설명 추가 없음 | ✅ |
| Workflow 변경 없음 | ✅ |
| TS 신규 오류 0 (Correction 경로) | ✅ |
| Regression | ✅ |

**P5.1B COMPACT UX HARDENING PASSED**
