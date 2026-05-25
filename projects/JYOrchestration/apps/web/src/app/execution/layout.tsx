import type { ReactNode } from "react";

/**
 * `/execution` 전용: 뷰포트 높이 안에서만 레이아웃되도록 플렉스 체인을 닫고
 * 브라우저(body) 전체 스크롤이 생기지 않게 한다.
 */
export default function ExecutionLayout({ children }: { readonly children: ReactNode }) {
  return <div className="jyo-execution-route-root">{children}</div>;
}
