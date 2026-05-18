export function ProjectSpecGuideSection() {
  return (
    <section
      data-ui-label="[F-1-2] Function — execution planning guide"
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        background: "#fafafa",
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>실행 계획 작성 안내</h2>
      <p style={{ margin: "0 0 12px 0", color: "#444", lineHeight: 1.6 }}>
        실행 계획은 프로젝트의 목표, 범위, 요구사항을 한 문서로 정리해 <strong>실행 준비</strong>를 돕는 기준입니다. 이
        내용이 정리되면 AI 초안·작업(Task) 계획으로 자연스럽게 이어집니다.
      </p>
      <p style={{ margin: "0 0 12px 0", color: "#444", lineHeight: 1.6 }}>
        계획이 모호하면 기능 우선순위가 흔들리고 구현 범위가 커지며, 이후 일정·품질·검증 비용이 커질 수 있습니다.
      </p>
      <p style={{ margin: 0, color: "#444", lineHeight: 1.6 }}>
        아래 필수 항목을 기준으로 실행 계획을 작성하면 다음 단계의 기능 분해와 Task 계획이 훨씬 안정적으로 진행됩니다.
      </p>
    </section>
  );
}
