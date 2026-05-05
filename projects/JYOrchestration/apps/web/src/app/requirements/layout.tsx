import type { ReactNode } from "react";

/**
 * `/requirements` 전용: 뷰포트 높이 안에서만 레이아웃되도록 플렉스 체인을 닫고
 * 브라우저(body) 전체 스크롤이 생기지 않게 한다.
 */
export default function RequirementsLayout({ children }: { readonly children: ReactNode }) {
  return <div className="jyo-requirements-route-root">{children}</div>;
}
