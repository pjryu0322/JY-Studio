/** contenteditable 루트에 이미지를 캐럿 위치에 삽입합니다. */
export function insertWorkNoteImageAtCaret(root: HTMLDivElement, dataUrl: string): void {
  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "";
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  img.style.display = "block";
  img.style.margin = "8px 0";
  img.style.borderRadius = "8px";

  root.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) {
    const wrap = document.createElement("div");
    wrap.appendChild(img);
    root.appendChild(wrap);
    return;
  }
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    const wrap = document.createElement("div");
    wrap.appendChild(img);
    root.appendChild(wrap);
    return;
  }
  range.deleteContents();
  range.insertNode(img);
  range.setStartAfter(img);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
