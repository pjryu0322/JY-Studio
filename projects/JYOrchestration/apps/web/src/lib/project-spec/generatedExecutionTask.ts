/** OpenAI가 Feature당 생성하는 실행 Task(JSON) — DB 저장 전 검증 대상 */

export type GeneratedExecutionTask = {
  localId: string;
  dependsOn: string[];
  title: string;
  description: string;
  input: string;
  output: string;
  acceptanceCriteria: string[];
  estimatedSize: "S" | "M" | "L";
  priority: "P0" | "P1" | "P2";
  taskKind: "api" | "logic" | "ui" | "data" | "infra" | "test";
};

/** data=스키마·DTO·마이그레이션 등; infra=레거시/배포 인프라(신규 생성은 data 우선) */
export const EXECUTION_TASK_KINDS = ["api", "logic", "ui", "data", "infra", "test"] as const;
export const ESTIMATED_SIZES = ["S", "M", "L"] as const;
export const TASK_PRIORITIES = ["P0", "P1", "P2"] as const;

export const MIN_TASK_TITLE_LEN = 14;
export const MIN_INPUT_OUTPUT_LEN = 6;
