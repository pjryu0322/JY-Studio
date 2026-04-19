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
      <strong style={{ color: "#0f172a" }}>프로젝트 관리</strong> — 이 화면은 공식 진행 단계(아이디어 구체화 → 협업 → 기능 정리 → 작업 정리 → 생성 준비 →
      프로토타입 생성 → 추적)의 한 단계가 아니라, 멤버·설정을 다루는 플랫폼 영역입니다. 스펙·작업·생성 준비는 프로젝트 허브(생성 준비)에서
      이어가세요.
    </div>
  );
}
