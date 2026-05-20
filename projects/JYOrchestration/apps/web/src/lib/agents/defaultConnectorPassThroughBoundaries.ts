import type { ConnectorPassThroughBoundary } from "@/lib/agents/connectorPassThroughBoundaryTypes";

export const DEFAULT_CONNECTOR_PASS_THROUGH_BOUNDARIES: readonly ConnectorPassThroughBoundary[] =
  [
    {
      id: "cursor.execution.before",
      kind: "cursor_execution",
      connectorId: "cursor",
      operation: "cursor.execution.before",
      description:
        "기존 Cursor 실행 경로 직전에 pass-through record를 생성할 수 있는 후보 경계",
      enabled: true,
      recordOnly: true,
    },
    {
      id: "github.pr.create.before",
      kind: "github_pr",
      connectorId: "github",
      operation: "github.pr.create.before",
      description:
        "기존 GitHub PR 생성 경로 직전에 pass-through record를 생성할 수 있는 후보 경계",
      enabled: true,
      recordOnly: true,
    },
    {
      id: "github.merge.before",
      kind: "github_merge",
      connectorId: "github",
      operation: "github.merge.before",
      description:
        "기존 GitHub merge 경로 직전에 pass-through record를 생성할 수 있는 후보 경계",
      enabled: true,
      recordOnly: true,
    },
    {
      id: "github.status.check.before",
      kind: "github_status",
      connectorId: "github",
      operation: "github.status.check.before",
      description:
        "기존 GitHub 상태 확인 경로 직전에 pass-through record를 생성할 수 있는 후보 경계",
      enabled: true,
      recordOnly: true,
    },
  ] as const;
