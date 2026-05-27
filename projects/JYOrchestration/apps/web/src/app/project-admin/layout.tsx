import type { ReactNode } from "react";

/** `/project-admin/*` — 플랫폼 레일 옆 본문이 뷰포트 높이 안에서 스크롤되도록 flex 체인을 닫는다. */
export default function ProjectAdminLayout({ children }: { readonly children: ReactNode }) {
  return <div className="jyo-project-admin-route-root">{children}</div>;
}
