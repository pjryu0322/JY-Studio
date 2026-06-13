import type {
  ArtifactContractRuleV1,
  CodeTaskArtifactContractV1,
} from "@/lib/prototype/implementationArtifactContract";
import { SAMPLE_DATA_PRIMARY_FILE_PATH } from "@/lib/prototype/sampleDataCodeTaskPlanner";

export type QualityIssueLevelV1 = "fail" | "warning" | "integration_required";

export type QualityIssueV1 = Readonly<{
  readonly level: QualityIssueLevelV1;
  readonly ruleId: string;
  readonly message: string;
  readonly filePath?: string;
  readonly exportName?: string;
  readonly fieldPath?: string;
}>;

export type ArtifactContractQualityStatusV1 = "pending" | "pass" | "fail";

export type ArtifactContractQualityResultV1 = Readonly<{
  readonly status: ArtifactContractQualityStatusV1;
  /** CodeTask stage contract — fail level 없음 */
  readonly ok: boolean;
  readonly issues: readonly QualityIssueV1[];
  readonly passedChecks: readonly string[];
  readonly integrationRequired: readonly string[];
  /** @deprecated fail-level messages for legacy callers */
  readonly missing: readonly string[];
  readonly warning: readonly string[];
}>;

function countArrayLiteralEntries(source: string, exportName: string): number {
  const re = new RegExp(
    `export\\s+const\\s+${exportName}\\s*(?::[^=]+)?=\\s*\\[([\\s\\S]*?)\\];`,
    "m",
  );
  const match = source.match(re);
  if (!match?.[1]) return 0;
  return (match[1].match(/\{/g) ?? []).length;
}

function readStringFieldInSource(source: string, field: string): string | null {
  const re = new RegExp(`${field}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`, "m");
  const m = source.match(re);
  return m?.[1]?.trim() ?? null;
}

function countArrayFieldInExportObject(source: string, exportName: string, fieldPath: string): number {
  const objRe = new RegExp(
    `export\\s+const\\s+${exportName}\\s*(?::[^=]+)?=\\s*\\{([\\s\\S]*?)\\};`,
    "m",
  );
  const block = source.match(objRe)?.[1] ?? "";
  if (!block) return 0;
  const fieldRe = new RegExp(`${fieldPath}\\s*:\\s*\\[([\\s\\S]*?)\\]`, "m");
  const arr = block.match(fieldRe)?.[1] ?? "";
  return (arr.match(/["'`][^"'`]+["'`]/g) ?? []).length;
}

function ruleMessage(rule: ArtifactContractRuleV1, detail: string): string {
  if (rule.kind === "file_exists") return `${rule.filePath}: ${detail}`;
  if (rule.kind === "export_exists") return `${rule.exportName}: ${detail}`;
  if (rule.kind === "array_min_length") {
    const path = rule.fieldPath ? `${rule.exportName}.${rule.fieldPath}` : rule.exportName;
    return `${path}>=${rule.min}: ${detail}`;
  }
  return `${rule.exportName}.${rule.fieldPath}: ${detail}`;
}

export function evaluateArtifactContractRule(input: {
  readonly rule: ArtifactContractRuleV1;
  readonly repositoryFilePaths: readonly string[];
  readonly sampleDataFileContent: string | null;
}): QualityIssueV1 | null {
  const paths = new Set(input.repositoryFilePaths.map((p) => p.replace(/\\/g, "/")));
  const content = String(input.sampleDataFileContent ?? "").trim();
  const { rule } = input;

  if (rule.kind === "file_exists") {
    if (!paths.has(rule.filePath)) {
      return {
        level: "fail",
        ruleId: rule.ruleId,
        message: ruleMessage(rule, "missing"),
        filePath: rule.filePath,
      };
    }
    return null;
  }

  if (!content) {
    return {
      level: "fail",
      ruleId: rule.ruleId,
      message: ruleMessage(rule, "sampleData content unavailable"),
      filePath: rule.filePath ?? SAMPLE_DATA_PRIMARY_FILE_PATH,
      exportName: "exportName" in rule ? rule.exportName : undefined,
    };
  }

  if (rule.kind === "export_exists") {
    if (!new RegExp(`export\\s+const\\s+${rule.exportName}\\b`).test(content)) {
      return {
        level: "fail",
        ruleId: rule.ruleId,
        message: ruleMessage(rule, "export missing"),
        filePath: rule.filePath,
        exportName: rule.exportName,
      };
    }
    return null;
  }

  if (rule.kind === "object_field_non_empty") {
    const value =
      readStringFieldInSource(content, rule.fieldPath) ??
      (rule.fieldPath === "overview"
        ? content.match(/overview\s*:\s*["'`]([^"'`]+)["'`]/s)?.[1]?.trim()
        : null);
    if (!value) {
      return {
        level: "fail",
        ruleId: rule.ruleId,
        message: ruleMessage(rule, "empty"),
        exportName: rule.exportName,
        fieldPath: rule.fieldPath,
      };
    }
    return null;
  }

  if (rule.kind === "array_min_length") {
    const count = rule.fieldPath
      ? countArrayFieldInExportObject(content, rule.exportName, rule.fieldPath)
      : countArrayLiteralEntries(content, rule.exportName);
    if (count < rule.min) {
      return {
        level: "fail",
        ruleId: rule.ruleId,
        message: ruleMessage(rule, `found ${count}`),
        exportName: rule.exportName,
        fieldPath: rule.fieldPath,
      };
    }
    return null;
  }

  return null;
}

function passedCheckLabel(rule: ArtifactContractRuleV1, count?: number): string {
  if (rule.kind === "file_exists") return `${rule.filePath} 확인`;
  if (rule.kind === "export_exists") return `${rule.exportName} export 확인`;
  if (rule.kind === "array_min_length") {
    const path = rule.fieldPath ? `${rule.exportName}.${rule.fieldPath}` : rule.exportName;
    return count != null ? `${path} ${count}개 확인` : `${path}>=${rule.min} 확인`;
  }
  if (rule.kind === "object_field_non_empty") {
    return `${rule.exportName}.${rule.fieldPath} 확인`;
  }
  return rule.ruleId;
}

export function evaluateCodeTaskArtifactContractQuality(input: {
  readonly contract: CodeTaskArtifactContractV1;
  readonly repositoryFilePaths?: readonly string[] | null;
  readonly sampleDataFileContent?: string | null;
  readonly githubHeadCommitVerified?: boolean;
  readonly stage?: "codeTask" | "integration" | "preview";
}): ArtifactContractQualityResultV1 {
  const paths = (input.repositoryFilePaths ?? []).map((p) => p.replace(/\\/g, "/"));
  const content = input.sampleDataFileContent?.trim() ? input.sampleDataFileContent : null;
  const stage = input.stage ?? input.contract.stage;

  if (input.githubHeadCommitVerified === false) {
    return {
      status: "pending",
      ok: false,
      issues: [
        {
          level: "warning",
          ruleId: "github_head_pending",
          message: "GitHub branch head commit 검증 대기 중",
        },
      ],
      passedChecks: [],
      integrationRequired: [],
      missing: [],
      warning: ["github_head_commit_pending"],
    };
  }

  const issues: QualityIssueV1[] = [];
  const passedChecks: string[] = [];

  for (const rule of input.contract.rules) {
    void stage;
    const issue = evaluateArtifactContractRule({
      rule,
      repositoryFilePaths: paths,
      sampleDataFileContent: content,
    });
    if (issue) {
      issues.push(issue);
    } else if (rule.kind === "array_min_length" && content) {
      const count = rule.fieldPath
        ? countArrayFieldInExportObject(content, rule.exportName, rule.fieldPath)
        : countArrayLiteralEntries(content, rule.exportName);
      passedChecks.push(passedCheckLabel(rule, count));
    } else {
      passedChecks.push(passedCheckLabel(rule));
    }
  }

  const failIssues = issues.filter((i) => i.level === "fail");
  const ok = failIssues.length === 0;

  return {
    status: ok ? "pass" : "fail",
    ok,
    issues,
    passedChecks,
    integrationRequired: [],
    missing: failIssues.map((i) => i.message),
    warning: issues.filter((i) => i.level === "warning").map((i) => i.message),
  };
}

export function buildCustomSummaryFieldContract(input: {
  readonly codeTaskId: string;
  readonly summaryExportName: string;
  readonly summaryArrayField: string;
  readonly minHighlights: number;
}): CodeTaskArtifactContractV1 {
  return {
    codeTaskId: input.codeTaskId,
    branchGroup: "data",
    artifactKind: "data",
    stage: "codeTask",
    files: [SAMPLE_DATA_PRIMARY_FILE_PATH],
    exports: [input.summaryExportName],
    rules: [
      {
        kind: "array_min_length",
        ruleId: "summary_array_field",
        exportName: input.summaryExportName,
        fieldPath: input.summaryArrayField,
        min: input.minHighlights,
      },
    ],
    previewRequired: false,
  };
}
