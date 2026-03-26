export type DiffLineKind = "equal" | "add" | "del";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
};

/**
 * 줄 단위 LCS 기반 diff. 렌더링은 추가=녹색, 삭제=적색.
 */
export function diffText(a: string, b: string): DiffLine[] {
  const la = a === "" ? [] : a.split("\n");
  const lb = b === "" ? [] : b.split("\n");
  const n = la.length;
  const m = lb.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = la[i] === lb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && la[i] === lb[j]) {
      out.push({ kind: "equal", text: la[i] });
      i++;
      j++;
    } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
      out.push({ kind: "add", text: lb[j] });
      j++;
    } else if (i < n) {
      out.push({ kind: "del", text: la[i] });
      i++;
    }
  }
  return out;
}
