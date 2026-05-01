import Link from "next/link";
import { PageHeader } from "@/components/ui";

export function ProjectSpecPageHeader({ projectName }: { readonly projectName?: string | null }) {
  return (
    <div data-ui-label="[P-1-3] Page Header — Breadcrumb & execution planning title">
      <div data-ui-label="[P-1-3-1] Header — Back Navigation" style={{ marginBottom: 12 }}>
        <Link href="/" style={{ color: "#333", textDecoration: "none" }}>
          ← 플랫폼 홈(프로젝트 목록)
        </Link>
      </div>

      <nav aria-label="위치" style={{ marginBottom: 12, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
        <Link href="/" style={{ color: "#475569", textDecoration: "none" }}>
          플랫폼 홈
        </Link>
        <span aria-hidden> › </span>
        {projectName ? (
          <>
            <span style={{ color: "#334155", fontWeight: 600 }}>{projectName}</span>
            <span aria-hidden> › </span>
          </>
        ) : null}
        <span style={{ fontWeight: 700, color: "#0f172a" }}>생성 준비</span>
      </nav>

      <PageHeader
        data-ui-label="[P-1-3-2] Header — Page Title"
        title="생성 준비"
        description={
          <>
            플랫폼에서 프로젝트를 다듬고, 프로토타입을 만들기 전 스펙·작업을 준비하는 단계입니다. 내용을 정리한 뒤 AI로 초안을 만들고 후보를 비교·확정하면
            작업(Task) 초안으로 이어집니다. Git·GitHub·Cursor 연결과 실행 정책은 상단 요약 또는 <strong>실행 환경</strong> 영역에서 확인할 수 있습니다. 실제
            프로토타입 생성·결과물 확인은 <strong>프로토타입 생성</strong> 단계에서 진행합니다.
          </>
        }
      />
    </div>
  );
}
