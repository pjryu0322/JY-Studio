/**
 * GitHub Pages 정식 배포 전 보안 점검(OpenAI JSON) — Stage1/ENV_TEST와 무관.
 */

import { githubRestApiBase } from "@/lib/integration/githubRestCommon";
import { composeGithubPagesPreviewUrlFromRepoUrl } from "@/lib/prototype/githubPagesPreviewUrl";
import { openAiJsonCompletion } from "@/lib/prototype/prototypeOpenAiCompletion";
import type { PrototypeRun, PrototypeSecurityFinding } from "@/lib/prototype/prototypeRunTypes";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { appendAiContextToSystemPrompt } from "@/lib/ai/knowledge/aiMemberContextInjection";

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubFileUtf8(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  const base = githubRestApiBase();
  const encPath = path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encPath}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  const text = await res.text().catch(() => "");
  if (!res.ok) return null;
  try {
    const json = JSON.parse(text) as { type?: string; encoding?: string; content?: string };
    if (json.type !== "file" || json.encoding !== "base64" || !json.content) return null;
    return Buffer.from(String(json.content).replace(/\n/g, ""), "base64").toString("utf8");
  } catch {
    return null;
  }
}

const DEFAULT_SCAN_PATHS = [
  "web/package.json",
  "web/index.html",
  "web/vite.config.ts",
  "web/tsconfig.json",
  ".github/workflows/deploy-pages.yml",
] as const;

function buildSecurityAuditSystemPrompt(): string {
  const title = getWorkspaceAiMember("security_reviewer")?.title ?? "AI 보안관";
  return [
    `당신은「${title}」이다. GitHub Pages에 공개 배포될 정적 웹 프로토타입의 보안·프라이버시·운영 리스크를 점검한다.`,
    "응답은 반드시 단일 JSON 객체 하나만 출력한다(설명 문장·마크다운 금지).",
    '스키마: {"passed":boolean,"findings":array}',
    "findings 항목: severity는 HIGH|MEDIUM|LOW, location은 파일 경로 또는 URL/식별자, description은 한국어로 짧게, recommendedAction은 한국어로 구체적 조치.",
    "passed는 HIGH 또는 MEDIUM이 하나라도 있으면 false. LOW만 있거나 findings가 비어 있으면 true.",
    "확실하지 않은 추측성 취약점은 findings에 넣지 말고, 의심만 있으면 LOW 한 건으로만 적는다.",
    "점검 관점: API Key/Secret 노출, .env/config 노출, 개인정보 하드코딩, XSS 위험, 위험한 외부 스크립트, 공개 배포에 부적절한 관리자/테스트 화면, GitHub Pages 공개 URL에 민감정보 포함, 불필요한 디버그 로그, 의존성 취약점 가능성(일반론만·구체 CVE 지어내기 금지), 빌드 산출물 내 민감 문자열(제공된 소스 스니펫 기준).",
  ].join("\n");
}

type LlmAuditRoot = {
  passed?: unknown;
  findings?: unknown;
};

function normalizeFromLlm(raw: LlmAuditRoot): { passed: boolean; findings: readonly PrototypeSecurityFinding[] } {
  const findingsIn = Array.isArray(raw.findings) ? raw.findings : [];
  const out: PrototypeSecurityFinding[] = [];
  let i = 0;
  for (const it of findingsIn) {
    const o = it as Record<string, unknown>;
    const sevRaw = String(o?.severity ?? "").toUpperCase();
    const severity: PrototypeSecurityFinding["severity"] =
      sevRaw === "HIGH" ? "HIGH" : sevRaw === "LOW" ? "LOW" : "MEDIUM";
    const id = String(o?.id ?? "").trim() || `f-${i}`;
    out.push({
      id,
      severity,
      location: String(o?.location ?? "").trim() || "(위치 미상)",
      description: String(o?.description ?? "").trim() || "(설명 없음)",
      recommendedAction: String(o?.recommendedAction ?? "").trim() || "(권장 조치 없음)",
      fixStatus: "OPEN",
    });
    i += 1;
  }
  const hasBlocking = out.some((f) => f.severity === "HIGH" || f.severity === "MEDIUM");
  const passed = !hasBlocking;
  return { passed, findings: out };
}

export type PrototypeDeploySecurityAuditInput = Readonly<{
  run: PrototypeRun;
  repoUrl: string;
  githubToken: string;
  ref: string;
}>;

export async function runPrototypeDeploySecurityAudit(input: PrototypeDeploySecurityAuditInput): Promise<
  | { ok: true; passed: boolean; findings: readonly PrototypeSecurityFinding[] }
  | { ok: false; message: string }
> {
  const parsed = composeGithubPagesPreviewUrlFromRepoUrl(input.repoUrl.trim());
  if (!parsed) return { ok: false, message: "저장소 URL을 해석할 수 없습니다." };
  const ref = String(input.ref ?? "").trim();
  if (!ref) return { ok: false, message: "점검 기준 ref(브랜치 또는 커밋 SHA)가 없습니다." };

  const files: string[] = [];
  for (const p of DEFAULT_SCAN_PATHS) {
    const body = await githubFileUtf8(input.githubToken, parsed.owner, parsed.repo, p, ref);
    if (body) files.push(`--- FILE: ${p} ---\n${body.slice(0, 12000)}`);
  }

  const changed = [...input.run.changedFiles].slice(0, 12);
  for (const rel of changed) {
    const p = rel.replace(/^\/+/, "");
    if (!p.startsWith("web/") || p.includes("..")) continue;
    const body = await githubFileUtf8(input.githubToken, parsed.owner, parsed.repo, p, ref);
    if (body) files.push(`--- FILE: ${p} ---\n${body.slice(0, 8000)}`);
  }

  const previewUrl = String(input.run.previewUrl ?? input.run.suggestedPreviewUrl ?? "").trim();
  const userBlock = [
    `프로젝트 실행 mergeSha: ${String(input.run.mergeSha ?? "").trim() || "(없음)"}`,
    `Pages 예상/프리뷰 URL: ${previewUrl || "(없음)"}`,
    `플래너 요약(일부): ${String(input.run.plannerSummary ?? "").slice(0, 1500)}`,
    "저장소에서 가져온 파일 내용:",
    files.length ? files.join("\n\n") : "(파일을 가져오지 못했습니다. 저장소 권한·ref·경로를 확인하세요.)",
  ].join("\n\n");

  const baseSystem = buildSecurityAuditSystemPrompt();
  const system = await appendAiContextToSystemPrompt({
    aiMemberId: "security_reviewer",
    baseSystem,
    projectId: String(input.run.projectId ?? "").trim(),
  });
  const res = await openAiJsonCompletion<LlmAuditRoot>(system, userBlock);
  if (!res.ok) return { ok: false, message: res.message };
  const norm = normalizeFromLlm(res.data);
  return { ok: true, passed: norm.passed, findings: norm.findings };
}
