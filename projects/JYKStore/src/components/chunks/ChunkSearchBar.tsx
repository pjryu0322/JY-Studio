type ChunkSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  tokenCount: number;
  visibleCount: number;
};

export function ChunkSearchBar({ value, onChange, tokenCount, visibleCount }: ChunkSearchBarProps) {
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="chunk 검색: callback, 오류코드, 인증 요청..."
        className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
      />
      {tokenCount > 0 ? (
        <p className="text-xs text-store-muted">
          검색 token {tokenCount}개 기준 {visibleCount}개 chunk가 표시됩니다.
        </p>
      ) : null}
    </>
  );
}
