/**
 * Relay: 플랫폼은 로컬 파일을 읽지 않고, Cursor가 보고한 경로 문자열만 glob 정책과 대조한다.
 */

function globToRegex(pattern: string): RegExp {
  let s = "";
  const p = pattern.trim().replace(/\\/g, "/");
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*") {
      if (p[i + 1] === "*") {
        s += ".*";
        i++;
      } else {
        s += "[^/]*";
      }
    } else if ("\\.+*?()[]{}^$|".includes(c)) {
      s += `\\${c}`;
    } else {
      s += c;
    }
  }
  return new RegExp(`^${s}$`, "i");
}

export function fileMatchesAllowedGlob(filePath: string, globPattern: string): boolean {
  const g = globPattern.trim().replace(/\\/g, "/");
  const f = filePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!g || g === "**" || g === "**/*") return true;
  try {
    return globToRegex(g).test(f);
  } catch {
    return false;
  }
}

export function fileMatchesAnyAllowedGlob(filePath: string, globs: string[]): boolean {
  const list = globs.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!list.length) return true;
  return list.some((g) => fileMatchesAllowedGlob(filePath, g));
}

export function filterPathsOutsideAllowedGlobs(
  paths: string[],
  globs: string[]
): string[] {
  const list = globs.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!list.length) return [];
  return paths.filter((p) => !fileMatchesAnyAllowedGlob(p, list));
}
