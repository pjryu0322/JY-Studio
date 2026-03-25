import Link from "next/link";

export function ProjectSpecPageHeader() {
  return (
    <header data-ui-label="[P-1-3] Page Header — Backlink & ProjectSpec Title">
      <div data-ui-label="[P-1-3-1] Header — Back Navigation" style={{ marginBottom: 20 }}>
        <Link href="/" style={{ color: "#333", textDecoration: "none" }}>
          ← 프로젝트 목록으로
        </Link>
      </div>

      <h1
        data-ui-label="[P-1-3-2] Header — Page Title"
        style={{ fontSize: 30, fontWeight: 700, marginBottom: 20 }}
      >
        ProjectSpec 설정
      </h1>
    </header>
  );
}
