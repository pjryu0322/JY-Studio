/** 메모 레일에서 sourceId를 targetId 위치로 이동한 id 순서. 불가 시 null */
export function reorderWorkNoteMemoIds(
  orderedIds: readonly string[],
  sourceId: string,
  targetId: string,
): readonly string[] | null {
  const src = sourceId.trim();
  const tgt = targetId.trim();
  if (!src || !tgt || src === tgt) return null;
  const ids = [...orderedIds];
  const from = ids.indexOf(src);
  const to = ids.indexOf(tgt);
  if (from < 0 || to < 0) return null;
  ids.splice(from, 1);
  ids.splice(to, 0, src);
  return ids;
}
