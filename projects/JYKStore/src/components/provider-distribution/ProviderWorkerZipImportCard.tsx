"use client";

import { useState } from "react";
import {
  startProviderWorkerZipImportApi,
  type ProviderWorkerZipImportResponse,
} from "@/lib/provider-center-api";

/**
 * P7: ZIP 업로드 기반 데이터 구조화 카드 (동기 최소 연결).
 *
 * 역할 분리: 이 카드는 ZIP Worker 경로 전용이며, 상단의 Docling 자료 등록/변환
 * 흐름과는 별개의 파이프라인이다. 업로드한 ZIP은 Python Worker가 구조화하고,
 * 결과(chunks/embeddings/vector)를 그대로 Store DB/pgvector에 반영한다.
 *
 * 동기 처리: 버튼을 누르면 서버가 전체 파이프라인을 끝낸 뒤 결과를 반환한다.
 * (async job 전환은 P7.1 예정)
 */
export function ProviderWorkerZipImportCard({
  packId,
  editable,
  onGoToKnowledge,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly onGoToKnowledge?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProviderWorkerZipImportResponse | null>(null);

  const onStart = async () => {
    if (!editable || running || !file) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await startProviderWorkerZipImportApi(packId, file);
      setResult(res);
      if (!res.ok) {
        setError(res.error?.message ?? "데이터 구조화에 실패했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 구조화에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-card">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-indigo-950">ZIP 업로드로 데이터 구조화 (베타)</h3>
        <p className="text-xs text-indigo-900/80">
          자료 묶음(.zip)을 업로드하면 Worker가 구조화·검색데이터까지 한 번에 생성합니다. 위의 Docling
          자료 등록과는 별개 경로입니다.
        </p>
      </div>

      <input
        type="file"
        accept=".zip"
        disabled={!editable || running}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setError(null);
          setResult(null);
        }}
        className="block w-full text-xs text-slate-700 file:mr-3 file:min-h-[40px] file:rounded-xl file:border-0 file:bg-indigo-600 file:px-3 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
      />

      <button
        type="button"
        onClick={() => void onStart()}
        disabled={!editable || running || !file}
        className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {running ? "데이터 구조화 중…" : "데이터 구조화 시작"}
      </button>

      {error ? (
        <div className="space-y-1 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{error}</p>
          {result?.error?.supportRequired ? (
            <p className="text-xs text-red-700">
              문제가 계속되면 관리자에게 문의하세요.
            </p>
          ) : null}
        </div>
      ) : null}

      {result?.ok ? (
        <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="font-semibold">데이터 구조화가 완료되었습니다.</p>
          <p className="text-xs">
            지식 청크 {result.importedChunkCount}개 · 임베딩 {result.importedEmbeddingCount}개
            {result.pgvectorReflected ? " · 벡터 인덱스 반영됨" : ""}
          </p>
          {onGoToKnowledge ? (
            <button
              type="button"
              onClick={onGoToKnowledge}
              className="min-h-[40px] rounded-xl border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-950"
            >
              다음: 지식데이터 확인
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
