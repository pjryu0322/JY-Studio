import { generateKnowledgePackDraftMock, type KnowledgePackDraftInput, type KnowledgePackDraftResult } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";
import { parseKnowledgePackAgentsForDraft } from "@/lib/knowledge-packs/knowledgePackManageFormHelpers";
import type { KnowledgePackPrecheckInput, KnowledgePackPrecheckResult } from "@/lib/knowledge-packs/knowledgePackPrecheckTypes";
import type { KnowledgePackCategory } from "@/lib/knowledge-packs/types";

export type KnowledgePackDraftApiJson = Readonly<{
  ok?: boolean;
  draft?: KnowledgePackDraftResult;
  fallbackUsed?: boolean;
  message?: string;
}>;

export type WizardDraftSourceFields = Readonly<{
  name: string;
  category: KnowledgePackCategory;
  agentsText: string;
  aiProductUrl: string;
  aiPurpose: string;
  aiOfficialDocsUrl: string;
  aiApiDocsUrl: string;
  aiRepositoryUrl: string;
  aiLicenseHint: string;
  aiMemo: string;
}>;

function trimOptional(s: string): string | undefined {
  const t = s.trim();
  return t.length ? t : undefined;
}

export function buildKnowledgePackPrecheckInputFromWizard(w: WizardDraftSourceFields): KnowledgePackPrecheckInput | null {
  const productName = w.name.trim();
  if (!productName) return null;
  return {
    productName,
    productUrl: trimOptional(w.aiProductUrl),
    category: w.category,
    agents: parseKnowledgePackAgentsForDraft(w.agentsText),
    purpose: trimOptional(w.aiPurpose),
    officialDocsUrl: trimOptional(w.aiOfficialDocsUrl),
    apiDocsUrl: trimOptional(w.aiApiDocsUrl),
    repositoryUrl: trimOptional(w.aiRepositoryUrl),
    licenseHint: trimOptional(w.aiLicenseHint),
    memo: trimOptional(w.aiMemo),
  };
}

export type KnowledgePackPrecheckApiJson = Readonly<{
  ok?: boolean;
  result?: KnowledgePackPrecheckResult;
  message?: string;
}>;

export async function requestKnowledgePackPrecheckApi(
  input: KnowledgePackPrecheckInput
): Promise<{ readonly status: number; readonly json: KnowledgePackPrecheckApiJson }> {
  const r = await fetch("/api/knowledge-packs/precheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, agents: [...input.agents] }),
  });
  let json: KnowledgePackPrecheckApiJson = {};
  try {
    json = (await r.json()) as KnowledgePackPrecheckApiJson;
  } catch {
    json = {};
  }
  return { status: r.status, json };
}

export function buildKnowledgePackDraftInputFromWizard(w: WizardDraftSourceFields): KnowledgePackDraftInput | null {
  const productName = w.name.trim();
  if (!productName) return null;
  return {
    productName,
    productUrl: trimOptional(w.aiProductUrl),
    category: w.category,
    agents: parseKnowledgePackAgentsForDraft(w.agentsText),
    purpose: trimOptional(w.aiPurpose),
    officialDocsUrl: trimOptional(w.aiOfficialDocsUrl),
    apiDocsUrl: trimOptional(w.aiApiDocsUrl),
    repositoryUrl: trimOptional(w.aiRepositoryUrl),
    licenseHint: trimOptional(w.aiLicenseHint),
    memo: trimOptional(w.aiMemo),
  };
}

export async function requestKnowledgePackDraftApi(input: KnowledgePackDraftInput): Promise<{
  readonly status: number;
  readonly json: KnowledgePackDraftApiJson;
}> {
  const r = await fetch("/api/knowledge-packs/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  let json: KnowledgePackDraftApiJson = {};
  try {
    json = (await r.json()) as KnowledgePackDraftApiJson;
  } catch {
    json = {};
  }
  return { status: r.status, json };
}

export type ClientDraftFlowOutcome =
  | { readonly kind: "apply"; readonly draft: KnowledgePackDraftResult; readonly message: string }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "local_mock"; readonly draft: KnowledgePackDraftResult; readonly message: string };

const MSG_LLM_FALLBACK = "LLM 설정이 없어 Mock 초안을 생성했습니다. 실제 공식 문서 검토 후 저장하세요.";
const MSG_LLM_OK = "AI 초안이 생성되었습니다. 공식 문서 기준으로 확인 후 저장하세요.";
const MSG_SERVER_FALLBACK = "서버와 통신할 수 없어 로컬 Mock 초안을 채웠습니다. 저장 전 내용을 확인하세요.";
const MSG_NETWORK_FALLBACK = "네트워크 오류로 로컬 Mock 초안을 채웠습니다. 저장 전 내용을 확인하세요.";

/** HTTP 응답만 해석한다. 네트워크 예외는 호출부에서 `local_mock` + MSG_NETWORK_FALLBACK 처리. */
export function interpretKnowledgePackDraftApiResponse(
  input: KnowledgePackDraftInput,
  res: Readonly<{ status: number; json: KnowledgePackDraftApiJson }>
): ClientDraftFlowOutcome {
  if (res.status === 401) {
    return { kind: "error", message: res.json.message ?? "로그인이 필요합니다." };
  }
  if (res.status === 400) {
    return { kind: "error", message: res.json.message ?? "요청이 올바르지 않습니다." };
  }
  if (res.status === 200 && res.json.ok && res.json.draft) {
    const message = res.json.fallbackUsed ? MSG_LLM_FALLBACK : MSG_LLM_OK;
    return { kind: "apply", draft: res.json.draft, message };
  }
  return {
    kind: "local_mock",
    draft: generateKnowledgePackDraftMock(input),
    message: MSG_SERVER_FALLBACK,
  };
}

export const knowledgePackDraftClientMessages = {
  llmFallback: MSG_LLM_FALLBACK,
  llmOk: MSG_LLM_OK,
  serverFallback: MSG_SERVER_FALLBACK,
  networkFallback: MSG_NETWORK_FALLBACK,
} as const;
