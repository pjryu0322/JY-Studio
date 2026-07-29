# JYKStore P6 — Provider · Service Validation · Publish UX

## 최종 판정

**P6 PROVIDER / SERVICE / PUBLISH UX PASSED**

Worker / Inventory / Correction / Public API / MCP 동작은 변경하지 않음. UI·카피·ViewModel 표시만 단순화.

## 1. Provider UX

메뉴 라벨 (탭 id·잠금 순서 유지 — workflow 변경 없음):

1. 기본정보  
2. 자료  
3. 보완 요청  
4. 서비스 미리보기  
5. 게시 현황  

기술 용어 제거·완화:

- Chunk / 청킹 / 구조화 / Token / Embedding / Worker / Internal ID → 업무 표현
- 보완 요청: 업무 템플릿 중심 (문서 누락, 검색 부정확, 최신 아님, 제외 말 것)
- 서비스 미리보기: 질문·답변·출처·관련 문서 + **검색 준비** 카피
- 식별자: Provider 상세에서 숨김

## 2. Service Validation UX

기본 상태 3종만:

- **서비스 가능**
- **주의**
- **게시 불가**

체크리스트·채널·Ops는 **상세 보기**에서만.

## 3. Publish UX

게시 조건 칩:

- 보정 없음
- 서비스 검증 통과
- 제공자 검토 완료

기본 액션:

- **게시**
- **게시 취소** (기존 반려 CTA 카피 매핑, API 동작 유지)

## 4. 변경 화면

- Provider 탭/카피/미리보기/보완/게시 현황 관련 패널
- `AdminServiceValidationWorkbenchPanel`
- `AdminApprovalPublishWorkbenchPanel`
- `AdminProviderReviewPanel` / Supplement 옵션 라벨
- progress / registration readiness 설명 문구

## 5. 테스트

갱신·통과:

- provider-pack-tabs-ux, knowledge-generation-flow, onboarding
- provider-pack-progress, provider-registration-readiness
- search-data / provider-search / structure-boundary UX 문자열
- admin SV/Publish workbench, review tabs/decision CTA (`게시` / `게시 취소`)

## 6. 최종 판정

| 기준 | 결과 |
|------|------|
| Provider 기술 용어 제거 | ✅ |
| SV 3상태 단순화 | ✅ |
| Publish UX 단순화 | ✅ |
| Workflow 변경 없음 | ✅ |
| TS 신규 오류 0 (대상 경로) | ✅ |

**P6 PROVIDER / SERVICE / PUBLISH UX PASSED**
