# 플랫폼 구조 진단 보고서 (안내)

**본문 파일**: [`apps/web/docs/platform-structure-diagnosis.md`](../apps/web/docs/platform-structure-diagnosis.md)

**Overlay 계획·계약**: [`apps/web/docs/OVERLAY_ARCHITECTURE_STEP_PLAN.md`](../apps/web/docs/OVERLAY_ARCHITECTURE_STEP_PLAN.md) · [`apps/web/docs/OVERLAY_ARCHITECTURE_CONTRACTS.md`](../apps/web/docs/OVERLAY_ARCHITECTURE_CONTRACTS.md)

웹 앱이 떠 있는 환경에서 Markdown 파일로 받으려면 브라우저나 HTTP 클라이언트로 다음을 호출합니다.

`GET /api/diagnostics/platform-structure-report`

예: 로컬 기본 포트인 경우 `http://localhost:3000/api/diagnostics/platform-structure-report`

응답은 `Content-Disposition: attachment`로 `JYOrchestration-platform-structure-diagnosis.md` 파일명을 제안합니다.
