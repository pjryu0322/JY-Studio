/**
 * 채팅/컴포저 공통: `@@` 직후 질문 대상(멘션) 선택.
 * ASCII 단어 내부(`foo@@`)는 제외하고, 한글 등 비 ASCII 앞 문자는 허용.
 */

export type ComposerAtAtPickerItem = {
  readonly id: string;
  readonly label: string;
  readonly targets: readonly { id: string; name: string }[];
};

export function normalizeComposerAtAtPickerItems(items: readonly ComposerAtAtPickerItem[]): ComposerAtAtPickerItem[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    if (!it.targets || it.targets.length === 0) return false;
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });
}

/** `@@` 바로 앞 한 글자가 멘션 트리거로 허용되는지 */
export function isCharBeforeAtAtAllowed(before: string): boolean {
  return !before || /\s/.test(before) || !/[a-zA-Z0-9]/.test(before);
}

export function parseComposerAtAtTrigger(value: string): { open: boolean; lastIndex: number | null } {
  const idx = value.lastIndexOf("@@");
  if (idx < 0) return { open: false, lastIndex: null };
  const before = idx === 0 ? "" : (value[idx - 1] ?? "");
  if (!isCharBeforeAtAtAllowed(before)) return { open: false, lastIndex: null };
  return { open: true, lastIndex: idx };
}

export function mergeComposerAtAtPick(
  value: string,
  lastIndex: number,
  targets: readonly { id: string; name: string }[],
): string {
  if (!targets.length) return value;
  const fragment = targets.map((t) => `@@${t.name}`).join(" ");
  const before = value.slice(0, lastIndex);
  const afterRaw = value.slice(lastIndex + 2);
  const tail = afterRaw.replace(/^[^\s\n]*/, "");
  const merged = `${before}${fragment}${tail.length ? tail : " "}`.replace(/\s{2,}/g, " ");
  return merged;
}
