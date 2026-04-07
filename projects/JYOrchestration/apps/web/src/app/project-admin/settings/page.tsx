import Link from "next/link";

export default function ProjectAdminSettingsPage() {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Project Admin · Settings</div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
        이 화면은 내비게이션 구조 정리를 위한 엔트리 포인트입니다. 현재 설정/실행 환경은 프로젝트 상세 화면에서 제공됩니다.
      </div>
      <div style={{ marginTop: 12 }}>
        <Link href="/" style={{ textDecoration: "underline" }}>
          프로젝트 목록으로 이동
        </Link>
      </div>
    </div>
  );
}

