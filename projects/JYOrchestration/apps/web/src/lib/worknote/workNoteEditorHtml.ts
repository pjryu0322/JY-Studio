/** 메모 본문(HTML·플레인)을 contenteditable에 넣기 위한 최소 변환 */
export function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 저장된 문자열 → 에디터 HTML(플레인은 이스케이프 + 줄바꿈, 이미 HTML이면 그대로) */
export function noteRawToEditorHtml(raw: string): string {
  const t = String(raw ?? "");
  if (!t.trim()) return "<br>";
  if (/<[a-z][\s\S]*>/i.test(t)) return t;
  return escapeHtmlText(t).replace(/\n/g, "<br>");
}

/** 빈 에디터 정규화 → API 저장용 문자열 */
export function editorHtmlToNoteRaw(html: string): string {
  const s = String(html ?? "").trim();
  if (!s || s === "<br>" || s === "<div><br></div>") return "";
  return html;
}

/** 저장 전: 스크립트·위험 속성 제거(브라우저 전용) */
export function sanitizeWorkNoteHtml(html: string): string {
  if (typeof window === "undefined") return html;
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const body = doc.body;
    body.querySelectorAll("script, iframe, object, embed, link, meta").forEach((n) => n.remove());
    body.querySelectorAll("*").forEach((el) => {
      for (const a of [...el.attributes]) {
        const n = a.name.toLowerCase();
        if (n.startsWith("on")) el.removeAttribute(a.name);
        if ((n === "href" || n === "src") && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      }
    });
    return body.innerHTML;
  } catch {
    return html;
  }
}

/** 클립보드 이미지를 JPEG data URL로 축소(가로 최대 px) */
export function imageFileToJpegDataUrl(file: File, maxEdgePx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (!w || !h) {
        reject(new Error("invalid image"));
        return;
      }
      const scale = Math.min(1, maxEdgePx / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("encode failed"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load failed"));
    };
    img.src = url;
  });
}
