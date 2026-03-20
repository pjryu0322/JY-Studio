import Link from "next/link";

export function ProjectSpecPageHeader() {
  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Link href="/" style={{ color: "#333", textDecoration: "none" }}>
          ← 프로젝트 목록으로
        </Link>
      </div>

      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 20 }}>
        ProjectSpec 설정
      </h1>
    </>
  );
}
