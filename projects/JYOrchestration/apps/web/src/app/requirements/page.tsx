"use client";

import { Suspense } from "react";
import { WorkflowPageHeader } from "@/components/workflow/primitives/WorkflowPageHeader";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { RequirementsWorkspaceClient } from "@/app/requirements/RequirementsWorkspaceClient";

export default function RequirementsPage() {
  const showScreenLabels = useShowScreenLabels();

  return (
    <div className="relative">
      <ScreenLabel label="요구사항-목록-페이지-섹션" visible={showScreenLabels} />
      <WorkflowPageHeader
        title="요구사항"
        subtitle="아이디어를 실행 가능한 프로젝트 요구사항으로 구체화하는 단계입니다."
        backHref="/"
        backLabel="실행 계획(홈)"
      />

      <Suspense fallback={<div style={{ marginTop: 16, color: "#64748b", fontSize: 14 }}>불러오는 중…</div>}>
        <RequirementsWorkspaceClient />
      </Suspense>

      <details style={{ marginTop: 20, fontSize: 13, color: "#64748b" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, color: "#475569" }}>워크플로 예시 보기 (참고용)</summary>
        <p style={{ marginTop: 10, lineHeight: 1.6 }}>
          실제 화면 위쪽 입력란에서 작업합니다. 예시로는 &quot;논의 중&quot;·&quot;승인됨&quot; 같은 상태 카드나 세션 수 목록은 이제 기본 화면에 표시하지 않습니다. 프로젝트를 만든 뒤 이 페이지에
          <code style={{ margin: "0 4px" }}>?projectId=…</code>가 붙으면 곧바로 요구사항 작성을 시작할 수 있습니다.
        </p>
      </details>
    </div>
  );
}
