/**
 * 데모 메모 앱 진입점. Task 실행·Cursor가 이 경로를 채워 확장합니다.
 * (빈 페이지면 파이프라인 검증 시 404를 피하기 위한 최소 셸)
 */
export default function NoteDemoPage() {
  return (
    <main
      data-ui-label="[N-1] Note Demo"
      style={{ padding: 24, maxWidth: 560, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>메모 데모</h1>
      <p style={{ color: "#555", lineHeight: 1.6 }}>
        이 화면은 JYOrchestration Task 실행으로 로그인·저장·목록 기능이 붙는 자리입니다. 아직 구현 전이면
        프로젝트에서 Task 프롬프트를 생성한 뒤 실행하세요.
      </p>
    </main>
  );
}
