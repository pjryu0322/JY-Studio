"use client";

import { useMemo, useState, type ReactNode } from "react";
import type {
  GitHubKnowledgeUnitDraftResult,
  GitHubRepositoryDiscoveryResult,
  GitHubSourceRegisterResult,
} from "@/lib/github-auto-collect/github-auto-collect-types";
import {
  clampUiNumber,
  normalizeUiSourceCodeAnalysis,
  selectDefaultGitHubSourceCandidatePaths,
  summarizeExcludedFilesByReason,
} from "@/lib/github-auto-collect/github-auto-collect-ui-utils";
import {
  generateGitHubKnowledgeUnitDraftsApi,
  previewGitHubRepositoryDiscoveryApi,
  registerGitHubSourceDocumentsApi,
} from "@/lib/provider-center-api";
import {
  PROVIDER_GITHUB_ADVANCED_SETTINGS,
  PROVIDER_GITHUB_LABEL_CRAWL_MODE,
  PROVIDER_GITHUB_LABEL_GENERATION_MODE,
  PROVIDER_GITHUB_LABEL_MAX_CANDIDATES,
  PROVIDER_GITHUB_LABEL_MAX_FETCH,
  PROVIDER_GITHUB_LABEL_OVERWRITE_DRAFTS,
  PROVIDER_GITHUB_LABEL_SOURCE_ANALYSIS,
  PROVIDER_GITHUB_PANEL_TITLE,
} from "@/lib/role-based-ux-copy";

const inputClass =
  "min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:opacity-60";

const CRAWL_MODES = [
  { value: "DOCS_ONLY", label: "문서만" },
  { value: "DOCS_AND_EXAMPLES", label: "문서 + 예제" },
  { value: "FULL_REPO_SCAN", label: "전체 스캔" },
] as const;

const SOURCE_CODE_ANALYSIS = [
  { value: "NONE", label: "소스 분석 없음" },
  { value: "METADATA_ONLY", label: "소스 메타데이터만" },
  { value: "ENTRYPOINTS_ONLY", label: "엔트리포인트만" },
] as const;

const MAX_CANDIDATE_FILES_UI = 300;
const MAX_FILES_TO_FETCH_UI = 30;

function WarningList({
  title,
  warnings,
}: {
  readonly title: string;
  readonly warnings?: string[];
}) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
      <p className="font-bold">{title}</p>
      <ul className="mt-1 list-disc space-y-1 break-all pl-4">
        {warnings.map((warning, index) => (
          <li key={`${title}-${index}`}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
const GENERATION_MODES = [
  { value: "MINIMAL", label: "MINIMAL (소규모)" },
  { value: "STANDARD", label: "STANDARD" },
  { value: "FULL", label: "FULL" },
] as const;

function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2 rounded-xl border border-store-border bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between px-3 text-left text-xs font-semibold text-slate-800"
      >
        {title}
        <span className="text-store-muted">{open ? "접기" : "펼치기"}</span>
      </button>
      {open ? <div className="border-t border-store-border px-3 py-2 text-xs">{children}</div> : null}
    </div>
  );
}

export function ProviderGitHubAutoCollectPanel({
  packId,
  disabled,
  onChanged,
  wizardMode = false,
}: {
  readonly packId: string;
  readonly disabled: boolean;
  readonly onChanged: () => Promise<void>;
  readonly wizardMode?: boolean;
}) {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [crawlMode, setCrawlMode] = useState("DOCS_AND_EXAMPLES");
  const [sourceCodeAnalysis, setSourceCodeAnalysis] = useState("NONE");
  const [maxCandidateFiles, setMaxCandidateFiles] = useState(100);
  const [maxFilesToFetch, setMaxFilesToFetch] = useState(10);
  const [generationMode, setGenerationMode] = useState("MINIMAL");
  const [overwriteExistingDrafts, setOverwriteExistingDrafts] = useState(false);

  const [preview, setPreview] = useState<GitHubRepositoryDiscoveryResult | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [registerResult, setRegisterResult] = useState<GitHubSourceRegisterResult | null>(null);
  const [draftResult, setDraftResult] = useState<GitHubKnowledgeUnitDraftResult | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const excludedSummary = useMemo(
    () => (preview ? summarizeExcludedFilesByReason(preview.excludedFiles) : []),
    [preview],
  );

  const togglePath = (path: string, checked: boolean) => {
    setSelectedPaths((prev) => {
      if (checked) return prev.includes(path) ? prev : [...prev, path];
      return prev.filter((p) => p !== path);
    });
  };

  const onPreview = async () => {
    if (disabled) return;
    const url = repositoryUrl.trim();
    if (!url) {
      setError("GitHub Repository URL을 입력해 주세요.");
      return;
    }
    setPreviewing(true);
    setError(null);
    setRegisterResult(null);
    setDraftResult(null);
    try {
      const safeSourceCodeAnalysis = normalizeUiSourceCodeAnalysis(sourceCodeAnalysis);
      const result = await previewGitHubRepositoryDiscoveryApi({
        repositoryUrl: url,
        crawlMode,
        sourceCodeAnalysis: safeSourceCodeAnalysis,
        maxFilesToAnalyze: 5000,
        maxCandidateFiles,
      });
      setPreview(result);
      setSelectedPaths(selectDefaultGitHubSourceCandidatePaths(result.sourceCandidates, 10));
    } catch (err) {
      setPreview(null);
      setSelectedPaths([]);
      setError(err instanceof Error ? err.message : "Repository 분석에 실패했습니다.");
    } finally {
      setPreviewing(false);
    }
  };

  const onRegister = async () => {
    if (disabled || !preview) return;
    if (selectedPaths.length === 0) {
      setError("원천 문서로 등록할 후보 파일을 선택해 주세요.");
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      const safeSourceCodeAnalysis = normalizeUiSourceCodeAnalysis(sourceCodeAnalysis);
      const result = await registerGitHubSourceDocumentsApi(packId, {
        repositoryUrl: repositoryUrl.trim(),
        crawlMode,
        sourceCodeAnalysis: safeSourceCodeAnalysis,
        selectedSourcePaths: selectedPaths,
        maxFilesToAnalyze: 5000,
        maxCandidateFiles,
        maxFilesToFetch,
        licenseStatus: preview.repository.license ?? undefined,
        documentVersion: preview.repository.defaultBranch,
      });
      setRegisterResult(result);
      setDraftResult(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub 원천 문서 등록에 실패했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  const onGenerateDrafts = async () => {
    if (disabled || !registerResult || registerResult.summary.registeredCount === 0) return;
    setGeneratingDrafts(true);
    setError(null);
    try {
      const pathsForDraft =
        registerResult.registeredDocuments.map((d) => d.path).length > 0
          ? registerResult.registeredDocuments.map((d) => d.path)
          : selectedPaths;
      const result = await generateGitHubKnowledgeUnitDraftsApi(packId, {
        sourceDocumentPaths: pathsForDraft,
        generationMode: generationMode as "MINIMAL" | "STANDARD" | "FULL",
        productProfileType: preview?.productProfile?.primaryType,
        overwriteExistingDrafts,
      });
      setDraftResult(result);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge Unit 초안 생성에 실패했습니다.");
    } finally {
      setGeneratingDrafts(false);
    }
  };

  const canGenerateDrafts =
    !disabled && registerResult != null && registerResult.summary.registeredCount > 0;

  return (
    <div id="github-auto-collect" className="mt-4 rounded-2xl border border-store-border bg-slate-50 p-4 scroll-mt-24">
      <h3 className="text-sm font-bold text-slate-900">
        {wizardMode ? PROVIDER_GITHUB_PANEL_TITLE : "GitHub Repository 자동수집"}
      </h3>
      <p className="mt-1 text-xs text-store-muted">
        공개 GitHub 저장소의 README/docs/examples를 탐색해 원천 문서로 등록합니다.
      </p>
      {disabled ? (
        <p className="mt-2 text-xs font-semibold text-amber-800">
          초안(DRAFT) 상태에서만 GitHub 자동수집을 실행할 수 있습니다.
        </p>
      ) : null}

      <label className="mt-3 block text-xs font-semibold" htmlFor="github-repo-url">
        Repository URL
      </label>
      <input
        id="github-repo-url"
        type="url"
        value={repositoryUrl}
        onChange={(e) => setRepositoryUrl(e.target.value)}
        disabled={disabled}
        placeholder="https://github.com/nhn/tui.grid"
        className={inputClass}
      />

      <Collapsible title={PROVIDER_GITHUB_ADVANCED_SETTINGS}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold">
            {PROVIDER_GITHUB_LABEL_CRAWL_MODE}
            <span className="ml-1 font-normal text-store-muted">(crawlMode)</span>
            <select
              value={crawlMode}
              disabled={disabled}
              onChange={(e) => setCrawlMode(e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              {CRAWL_MODES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold">
            {PROVIDER_GITHUB_LABEL_SOURCE_ANALYSIS}
            <span className="ml-1 font-normal text-store-muted">(sourceCodeAnalysis)</span>
            <select
              value={sourceCodeAnalysis}
              disabled={disabled}
              onChange={(e) => setSourceCodeAnalysis(e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              {SOURCE_CODE_ANALYSIS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold">
            {PROVIDER_GITHUB_LABEL_MAX_CANDIDATES}
            <span className="ml-1 font-normal text-store-muted">(maxCandidateFiles)</span>
            <input
              type="number"
              min={1}
              max={MAX_CANDIDATE_FILES_UI}
              value={maxCandidateFiles}
              disabled={disabled}
              onChange={(e) =>
                setMaxCandidateFiles(
                  clampUiNumber(Number(e.target.value), 1, MAX_CANDIDATE_FILES_UI, 100),
                )
              }
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs font-semibold">
            {PROVIDER_GITHUB_LABEL_MAX_FETCH}
            <span className="ml-1 font-normal text-store-muted">(maxFilesToFetch)</span>
            <input
              type="number"
              min={1}
              max={MAX_FILES_TO_FETCH_UI}
              value={maxFilesToFetch}
              disabled={disabled}
              onChange={(e) =>
                setMaxFilesToFetch(clampUiNumber(Number(e.target.value), 1, MAX_FILES_TO_FETCH_UI, 10))
              }
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs font-semibold sm:col-span-2">
            {PROVIDER_GITHUB_LABEL_GENERATION_MODE}
            <span className="ml-1 font-normal text-store-muted">(generationMode)</span>
            <select
              value={generationMode}
              disabled={disabled}
              onChange={(e) => setGenerationMode(e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              {GENERATION_MODES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 flex min-h-[44px] items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={overwriteExistingDrafts}
            disabled={disabled}
            onChange={(e) => setOverwriteExistingDrafts(e.target.checked)}
            className="h-5 w-5"
          />
          {PROVIDER_GITHUB_LABEL_OVERWRITE_DRAFTS}
          <span className="font-normal text-store-muted">(overwriteExistingDrafts)</span>
        </label>

        <p className="mt-2 text-[11px] text-store-muted">
          src 전체 분석과 선택 경로 분석은 아직 UI에서 제공하지 않습니다. 초기 지식팩 생성은
          README/docs/examples 중심을 권장합니다.
        </p>
      </Collapsible>

      {!preview ? (
        <button
          type="button"
          disabled={disabled || previewing}
          onClick={() => void onPreview()}
          className="mt-4 min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
        >
          {previewing ? "분석 중…" : "Repository 분석"}
        </button>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {preview ? (
        <div className="mt-4 space-y-3 rounded-xl border border-store-border bg-white p-3">
          <div className="text-xs text-slate-800">
            <p className="font-bold">{preview.repository.fullName}</p>
            <p className="mt-1 text-store-muted">
              branch {preview.repository.defaultBranch}
              {preview.repository.language ? ` · ${preview.repository.language}` : ""}
              {preview.repository.license ? ` · ${preview.repository.license}` : ""}
              {preview.repository.archived ? " · archived" : ""}
            </p>
            <p className="mt-1">
              파일 {preview.summary.totalFilesDiscovered} · 후보 {preview.summary.candidateFileCount} ·
              제외 {preview.summary.excludedFileCount}
            </p>
          </div>

          <WarningList title="Repository 분석 안내" warnings={preview.warnings} />

          {preview.productProfile ? (
            <div className="rounded-lg border border-store-border bg-slate-50 p-2 text-xs">
              <p>
                제품 유형: <strong>{preview.productProfile.primaryType}</strong> · 신뢰도:{" "}
                {preview.productProfile.confidence.toFixed(2)}
              </p>
              {preview.productProfile.evidence.length > 0 ? (
                <p className="mt-1 break-all text-store-muted">
                  근거: {preview.productProfile.evidence.slice(0, 8).join(", ")}
                </p>
              ) : null}
              {preview.productProfile.warnings.length > 0 ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-amber-900">
                  {preview.productProfile.warnings.join(" ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {excludedSummary.length > 0 ? (
            <Collapsible title={`제외 파일 ${preview.summary.excludedFileCount}개`}>
              <ul className="space-y-1">
                {excludedSummary.map((row) => (
                  <li key={row.reason}>
                    {row.reason} {row.count}
                  </li>
                ))}
              </ul>
              {preview.excludedFiles.length > 0 ? (
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto break-all text-store-muted">
                  {preview.excludedFiles.slice(0, 20).map((f) => (
                    <li key={f.path}>
                      {f.path} ({f.excludeReason})
                    </li>
                  ))}
                </ul>
              ) : null}
            </Collapsible>
          ) : null}

          <div>
            <p className="text-xs font-bold text-slate-900">
              추천 문서 {preview.sourceCandidates.length}개를 찾았습니다.
            </p>
            <ul className="mt-2 space-y-2">
              {preview.sourceCandidates.map((c) => {
                const checked = selectedPaths.includes(c.path);
                const canSelect = c.shouldFetchContent;
                return (
                  <li
                    key={c.path}
                    className="rounded-xl border border-store-border px-3 py-2 text-xs"
                  >
                    <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 shrink-0"
                        checked={checked}
                        disabled={disabled || !canSelect}
                        onChange={(e) => togglePath(c.path, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block break-all font-semibold text-slate-900">{c.path}</span>
                        <span className="mt-1 block text-store-muted">
                          {c.fileClass} · {c.sourceTypeSuggestion} · score {c.score}
                          {c.size ? ` · ${c.size}B` : ""}
                        </span>
                        {!canSelect ? (
                          <span className="mt-1 block text-amber-800">
                            현재 설정에서는 원문 수집 대상이 아닙니다.
                          </span>
                        ) : null}
                        {c.reasonCodes.length > 0 ? (
                          <span className="mt-1 block break-all text-[11px] text-store-muted">
                            {c.reasonCodes.join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <button
            type="button"
            disabled={disabled || registering || selectedPaths.length === 0}
            onClick={() => void onRegister()}
            className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-50"
          >
            {registering ? "등록 중…" : "선택한 문서 등록"}
          </button>
        </div>
      ) : null}

      {registerResult ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
          <p className="font-bold">
            등록 {registerResult.summary.registeredCount}개 / 스킵 {registerResult.summary.skippedCount}개 /
            실패 {registerResult.summary.failedCount}개
          </p>
          <WarningList title="원천 문서 등록 안내" warnings={registerResult.warnings} />
          {registerResult.registeredDocuments.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {registerResult.registeredDocuments.map((d) => (
                <li key={d.path} className="break-all">
                  {d.path} · {d.title} · {d.sourceType}
                  {d.validationStatus ? ` · ${d.validationStatus}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {registerResult.skippedFiles.length > 0 ? (
            <Collapsible title={`스킵 ${registerResult.skippedFiles.length}건`}>
              <ul className="space-y-1 break-all">
                {registerResult.skippedFiles.map((s) => (
                  <li key={s.path}>
                    {s.path}: {s.reason}
                  </li>
                ))}
              </ul>
            </Collapsible>
          ) : null}
          {registerResult.failedFiles.length > 0 ? (
            <Collapsible title={`실패 ${registerResult.failedFiles.length}건`}>
              <ul className="space-y-1 break-all">
                {registerResult.failedFiles.map((f) => (
                  <li key={f.path}>
                    {f.path}: {f.error}
                  </li>
                ))}
              </ul>
            </Collapsible>
          ) : null}
        </div>
      ) : null}

      {!wizardMode ? (
        <button
          type="button"
          disabled={!canGenerateDrafts || generatingDrafts}
          onClick={() => void onGenerateDrafts()}
          className="mt-3 min-h-[44px] w-full rounded-xl bg-slate-800 text-sm font-bold text-white disabled:opacity-50"
        >
          {generatingDrafts ? "초안 생성 중…" : "Knowledge Unit 초안 생성"}
        </button>
      ) : null}

      {!wizardMode && draftResult ? (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950">
          <p className="font-bold">
            초안 생성 {draftResult.summary.generatedDraftCount}개 · 스킵 문서{" "}
            {draftResult.summary.skippedDocumentCount}개 · 실패 {draftResult.summary.failedCount}개
          </p>
          <WarningList title="Knowledge Unit 초안 생성 안내" warnings={draftResult.warnings} />
          <p className="mt-2 text-indigo-900">
            생성된 Knowledge Unit 초안은 아직 공개되지 않습니다. 검토/승인 단계에서 활성화됩니다.
          </p>
          {draftResult.drafts.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {draftResult.drafts.map((d) => (
                <li key={d.id} className="break-all">
                  {d.title}
                  {d.sourcePath ? ` · ${d.sourcePath}` : ""} · {d.reviewStatus} · {d.generatedBy}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
