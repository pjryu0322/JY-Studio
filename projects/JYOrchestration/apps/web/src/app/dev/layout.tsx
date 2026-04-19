import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * 개발 전용 라우트 세그먼트. 운영 빌드에서는 명시적으로 켠 경우에만 허용합니다.
 * (테스트 결과 API와 동일한 `ENABLE_TEST_RESULTS_UI` 정책)
 */
export default function DevLayout({ children }: { readonly children: ReactNode }) {
  const allow =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_TEST_RESULTS_UI === "true";
  if (!allow) {
    redirect("/");
  }
  return <>{children}</>;
}
