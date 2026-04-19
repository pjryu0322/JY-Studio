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
      <strong style={{ color: "#0f172a" }}>프로젝트 관리</strong> — 공식 진행 단계(아이디어 구체화 → 기능 정리 → 작업 정리 → 생성 준비 → 프로토타입 생성 → 추적)와
      별도로, 이 프로젝트의 <strong>프로젝트 멤버</strong>·설정을 다룹니다.{" "}
      <strong>플랫폼 사용자</strong>(로그인 계정)와 혼동하지 마세요. 계정 전체 목록은 관리자용「플랫폼 사용자」이며, 여기서는 선택한 프로젝트에 속한 사람·AI만
      다룹니다. 스펙·작업 흐름은 상단의 워크플로 링크(특히 아이디어 구체화)에서 이어가세요.
    </div>
  );
}
