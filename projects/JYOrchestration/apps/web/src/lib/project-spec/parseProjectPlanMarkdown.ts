import { parseMarkdownSections } from "@/lib/project-spec/parseMarkdownSections";

/** 워크스페이스 Spec 필드와 대응 (전체 문서 → 필드 추출용, 섹션 diff UI 없음) */
export type ProjectPlanFormSlice = {
  specCoreGoals: string;
  specScopeIn: string;
  specScopeOut: string;
  specTargetUsers: string;
  specSuccessCriteria: string;
};

function norm(h: string): string {
  return h.trim().toLowerCase();
}

type Bucket = "goals" | "inScope" | "outScope" | "users" | "success";

function categorizeHeading(heading: string): Bucket {
  const h = norm(heading);
  if (/in\s*scope|범위\s*내|^포함/.test(h)) return "inScope";
  if (/out\s*of\s*scope|범위\s*외|^제외\s*범위/.test(h)) return "outScope";
  if (/사용자|유스케이스|use\s*case|페르소나|이해관계자/.test(h)) return "users";
  if (/성공\s*기준|비기능|수용\s*기준|nfr|마일스톤|제약|가정|리스크|아키텍처|기술\s*스택|알고리즘/.test(h)) {
    return "success";
  }
  if (/개요|목표|goals?|overview|프로젝트/.test(h)) return "goals";
  return "goals";
}

/**
 * `##` 섹션 키워드로 워크스페이스 5필드에 대략 매핑.
 */
export function parseProjectPlanMarkdownToForm(markdown: string): ProjectPlanFormSlice {
  const text = markdown?.trim() ?? "";
  if (!text) {
    return {
      specCoreGoals: "",
      specScopeIn: "",
      specScopeOut: "",
      specTargetUsers: "",
      specSuccessCriteria: "",
    };
  }

  const sections = parseMarkdownSections(text);
  const buckets: Record<Bucket, string[]> = {
    goals: [],
    inScope: [],
    outScope: [],
    users: [],
    success: [],
  };

  for (const s of sections) {
    const b = s.body.trim();
    if (!b && !s.heading) continue;
    if (!s.heading) {
      buckets.goals.push(b);
      continue;
    }
    const key = categorizeHeading(s.heading);
    buckets[key].push(b);
  }

  const join = (xs: string[]) => xs.filter(Boolean).join("\n\n").trim();

  let specCoreGoals = join(buckets.goals);
  const specScopeIn = join(buckets.inScope);
  const specScopeOut = join(buckets.outScope);
  const specTargetUsers = join(buckets.users);
  const specSuccessCriteria = join(buckets.success);

  if (!specCoreGoals) {
    specCoreGoals = text;
  }

  return {
    specCoreGoals,
    specScopeIn,
    specScopeOut,
    specTargetUsers,
    specSuccessCriteria,
  };
}

/** DB에만 필드가 있고 플랜 문서가 없을 때 에디터 초기값용 */
export function buildFallbackProjectPlanMarkdown(input: ProjectPlanFormSlice): string {
  const parts: string[] = ["# 프로젝트 실행 계획 초안", ""];
  if (input.specCoreGoals.trim()) {
    parts.push("## 핵심 목표", "", input.specCoreGoals.trim(), "");
  }
  if (input.specScopeIn.trim()) {
    parts.push("## In scope", "", input.specScopeIn.trim(), "");
  }
  if (input.specScopeOut.trim()) {
    parts.push("## Out of scope", "", input.specScopeOut.trim(), "");
  }
  if (input.specTargetUsers.trim()) {
    parts.push("## 대상 사용자 및 유스케이스", "", input.specTargetUsers.trim(), "");
  }
  if (input.specSuccessCriteria.trim()) {
    parts.push("## 성공 기준 및 비기능·제약", "", input.specSuccessCriteria.trim(), "");
  }
  return parts.join("\n").trim();
}
