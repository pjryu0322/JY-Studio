export type ParsedPromptSections = {
  projectInfo: {
    name: string;
    description: string;
    projectType: string;
  };
  coreGoals: string[];
  inScope: string[];
  outOfScope: string[];
  targetUsers: string[];
  successCriteria: string[];
  /** [출력 규칙] · [필수 섹션] 등 나머지 블록 */
  extraBlocks: { title: string; bullets: string[] }[];
};

function emptyParsed(): ParsedPromptSections {
  return {
    projectInfo: { name: "", description: "", projectType: "" },
    coreGoals: [],
    inScope: [],
    outOfScope: [],
    targetUsers: [],
    successCriteria: [],
    extraBlocks: [],
  };
}

function splitValueToBullets(value: string): string[] {
  const v = value.trim();
  if (!v) {
    return [];
  }
  const lines = v.split(/\n+/).map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  if (lines.length > 1) {
    return lines;
  }
  return [v];
}

function lineValueAfterPrefix(line: string, prefix: string): string | null {
  const t = line.trim();
  if (!t.startsWith("- ")) {
    return null;
  }
  const rest = t.slice(2).trim();
  if (!rest.toLowerCase().startsWith(prefix.toLowerCase())) {
    return null;
  }
  const idx = rest.indexOf(":");
  if (idx === -1) {
    return null;
  }
  return rest.slice(idx + 1).trim();
}

/**
 * `buildWorkspacePromptText`가 만든 워크스페이스 프롬프트를 구조화한다.
 * 형식이 달라도 빈 필드로 안전하게 동작한다.
 */
export function parsePromptToSections(promptText: string): ParsedPromptSections {
  const out = emptyParsed();
  if (!promptText?.trim()) {
    return out;
  }

  const sectionRegex = /\[([^\]]+)\]/g;
  const headers: { title: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(promptText)) !== null) {
    headers.push({ title: m[1].trim(), start: m.index });
  }
  if (headers.length === 0) {
    return out;
  }

  const preamble = promptText.slice(0, headers[0].start).trim();
  if (preamble) {
    out.extraBlocks.push({
      title: "역할·지시",
      bullets: preamble.split(/\n/).map((l) => l.trim()).filter(Boolean),
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const end = i + 1 < headers.length ? headers[i + 1].start : promptText.length;
    const body = promptText.slice(h.start, end).replace(/^\[[^\]]+\]\s*/m, "").trim();
    const lines = body.split("\n").map((l) => l.trimEnd());

    if (h.title === "프로젝트 정보") {
      for (const line of lines) {
        const n = lineValueAfterPrefix(line, "프로젝트명");
        if (n != null) {
          out.projectInfo.name = n;
          continue;
        }
        const d = lineValueAfterPrefix(line, "설명");
        if (d != null) {
          out.projectInfo.description = d;
          continue;
        }
        const t = lineValueAfterPrefix(line, "유형");
        if (t != null) {
          out.projectInfo.projectType = t;
        }
      }
      continue;
    }

    if (h.title === "Spec 정의 입력") {
      for (const line of lines) {
        const g = lineValueAfterPrefix(line, "핵심 목표");
        if (g != null) {
          out.coreGoals = splitValueToBullets(g);
          continue;
        }
        const sin = lineValueAfterPrefix(line, "In scope");
        if (sin != null) {
          out.inScope = splitValueToBullets(sin);
          continue;
        }
        const sout = lineValueAfterPrefix(line, "Out of scope");
        if (sout != null) {
          out.outOfScope = splitValueToBullets(sout);
          continue;
        }
        const u = lineValueAfterPrefix(line, "대상 사용자");
        if (u != null) {
          out.targetUsers = splitValueToBullets(u);
          continue;
        }
        const s = lineValueAfterPrefix(line, "성공 기준");
        if (s != null) {
          out.successCriteria = splitValueToBullets(s);
        }
      }
      continue;
    }

    const bullets = lines
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2).trim())
      .filter(Boolean);
    out.extraBlocks.push({ title: h.title, bullets: bullets.length ? bullets : lines.filter(Boolean) });
  }

  return out;
}
