/** 멤버·설정 등 프로젝트 관리 화면 — 공식 제품 워크플로 스텝과 구분 */
export function ProjectAdminWorkflowScopeNote() {
  return (
    <div
      role="note"
      aria-label="프로젝트 관리 영역 안내"
      style={{
        marginBottom: 16,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: "#f1f5f9",
        fontSize: 13,
        color: "#334155",
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "#0f172a" }}>프로젝트 관리</strong> — 이 화면은 공식 워크플로(요구사항 → 협업 → 기능 → 작업 → 실행 계획 → 실행 → 추적)의
      한 단계가 아니라, 멤버·설정을 다루는 별도 영역입니다. 스펙·작업·실행 계획은 실행 계획(홈)에서 이어가세요.
    </div>
  );
}
