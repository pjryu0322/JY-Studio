export function ProjectSpecGuideSection() {
  return (
    <section
      data-ui-label="[F-1-2] Function — ProjectSpec Registration Guide"
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>ProjectSpec 등록 안내</h2>
      <p style={{ marginBottom: 8 }}>
        ProjectSpec은 프로젝트의 목표, 범위, 요구사항을 한 문서로 정리하는 기준 문서입니다. 이 문서가
        명확해야 이후 단계에서 FeatureSpec과 Task를 일관된 기준으로 생성할 수 있습니다.
      </p>
      <p style={{ marginBottom: 8 }}>
        ProjectSpec이 부정확하면 기능 우선순위가 흔들리고 구현 범위가 커지며, 이후 일정/품질/검증
        단계에서 재작업이 반복될 수 있습니다. 초기 문서 품질이 전체 개발 효율을 좌우합니다.
      </p>
      <p style={{ marginBottom: 8 }}>
        아래 필수 항목을 기준으로 ProjectSpec을 작성하면 다음 단계의 Feature 분해와 Task 계획이 훨씬
        안정적으로 진행됩니다.
      </p>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        <li>프로젝트 개요</li>
        <li>목표 / 범위</li>
        <li>핵심 사용자 및 유스케이스</li>
        <li>기능 요구사항</li>
        <li>비기능 요구사항</li>
        <li>제약사항 / 가정</li>
        <li>성공 기준 / 수용 기준</li>
        <li>초기 마일스톤</li>
      </ul>
    </section>
  );
}
