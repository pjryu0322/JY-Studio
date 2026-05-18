export type ParsedKnowledgePackDocument = Readonly<{
  title: string;
  plainText: string;
  detectedType: "html" | "markdown" | "text" | "json" | "yaml" | "openapi" | "unknown";
  warnings: readonly string[];
}>;

const MAX_PLAIN_CHARS = 500_000;

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** script/style 및 태그 제거 후 본문 근사 */
export function stripHtmlToPlainText(html: string): string {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<\/(p|div|h[1-6]|li|tr|br|pre)>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&");
  return collapseWs(t.split(/\r?\n/).map((l) => l.trim()).join("\n"));
}

function detectFromContentType(ct: string, body: string): ParsedKnowledgePackDocument["detectedType"] {
  const c = ct.toLowerCase();
  if (c.includes("html")) return "html";
  if (c.includes("markdown") || c.includes("md")) return "markdown";
  if (c.includes("json")) return "json";
  if (c.includes("yaml")) return "yaml";
  const b = body.trim();
  if (b.startsWith("{") || b.startsWith("[")) return "json";
  if (b.startsWith("openapi:") || b.includes("swagger:")) return "openapi";
  if (b.includes("<html") || b.includes("<!doctype html")) return "html";
  if (b.startsWith("#") || b.includes("\n# ")) return "markdown";
  return "text";
}

/**
 * 수집된 원시 문자열을 검색용 평문으로 변환한다. 외부 HTML 파서 의존성 없음.
 */
export function parseKnowledgePackDocument(input: Readonly<{ raw: string; contentType?: string; sourceType?: string }>): ParsedKnowledgePackDocument {
  const warnings: string[] = [];
  let raw = String(input.raw ?? "");
  if (raw.length > MAX_PLAIN_CHARS) {
    warnings.push(`본문이 ${MAX_PLAIN_CHARS}자를 넘어 잘랐습니다.`);
    raw = raw.slice(0, MAX_PLAIN_CHARS);
  }

  const st = (input.sourceType ?? "").toUpperCase();
  let detected: ParsedKnowledgePackDocument["detectedType"] = "unknown";
  if (st === "MARKDOWN" || st === "TEXT") detected = st === "MARKDOWN" ? "markdown" : "text";
  else if (st === "OPENAPI" || st === "API_REFERENCE") detected = "openapi";
  else detected = detectFromContentType(input.contentType ?? "", raw);

  let plain = raw;
  let title = "";

  if (detected === "html") {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
    title = m ? collapseWs(m[1] ?? "") : "";
    plain = stripHtmlToPlainText(raw);
  } else if (detected === "markdown") {
    plain = raw.replace(/^#{1,6}\s+.+$/gm, (line) => {
      if (!title && line.startsWith("#")) title = line.replace(/^#+\s*/, "").trim();
      return line;
    });
    plain = plain.replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, "\n"));
    plain = collapseWs(plain.replace(/[`*_~]/g, " "));
  } else if (detected === "json" || detected === "openapi" || detected === "yaml") {
    try {
      const j = JSON.parse(raw);
      plain = typeof j === "string" ? j : JSON.stringify(j, null, 2);
      if (typeof j === "object" && j && typeof (j as { info?: { title?: string } }).info?.title === "string") {
        title = String((j as { info: { title: string } }).info.title);
      }
    } catch {
      plain = raw;
      warnings.push("JSON 파싱에 실패해 원문을 텍스트로 처리했습니다.");
    }
  } else {
    plain = collapseWs(raw);
  }

  if (!title && plain.length) {
    title = plain.slice(0, 80).split("\n")[0]?.trim() ?? "";
  }

  return {
    title: title.slice(0, 500),
    plainText: plain,
    detectedType: detected === "unknown" ? "text" : detected,
    warnings,
  };
}
