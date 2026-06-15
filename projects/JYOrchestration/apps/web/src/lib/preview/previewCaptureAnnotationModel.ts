export type PreviewCaptureStrokeTool = "pen" | "highlighter" | "dashedPen" | "marker";
export type PreviewCaptureShapeTool = "arrow" | "rect";
export type PreviewCaptureTool = PreviewCaptureStrokeTool | PreviewCaptureShapeTool | "eraser";

export type AnnotationStrokeWidth = 2 | 4 | 8 | 12;

export type AnnotationColor = "#ef4444" | "#2563eb" | "#facc15" | "#111827" | "#ffffff";

export type PreviewCaptureAnnotationStyle = Readonly<{
  readonly color: string;
  readonly strokeWidth: number;
  readonly opacity: number;
  readonly lineDash?: readonly number[];
  readonly lineCap?: CanvasLineCap;
  readonly lineJoin?: CanvasLineJoin;
}>;

export type PreviewCaptureStroke = Readonly<{
  readonly id: string;
  readonly tool: PreviewCaptureStrokeTool;
  readonly points: ReadonlyArray<Readonly<{ readonly x: number; readonly y: number }>>;
  readonly style: PreviewCaptureAnnotationStyle;
}>;

export type PreviewCaptureShape = Readonly<{
  readonly id: string;
  readonly tool: PreviewCaptureShapeTool;
  readonly start: Readonly<{ readonly x: number; readonly y: number }>;
  readonly end: Readonly<{ readonly x: number; readonly y: number }>;
  readonly style: PreviewCaptureAnnotationStyle;
}>;

export type PreviewCaptureAnnotationItem = PreviewCaptureStroke | PreviewCaptureShape;

export type PreviewCaptureAnnotationDocument = Readonly<{
  readonly items: readonly PreviewCaptureAnnotationItem[];
}>;

export type PreviewCaptureAnnotationStyleSummary = Readonly<{
  readonly colors: readonly string[];
  readonly strokeWidths: readonly number[];
  readonly tools: readonly string[];
}>;

export const PREVIEW_CAPTURE_ANNOTATION_DEFAULT_COLOR: AnnotationColor = "#ef4444";
export const PREVIEW_CAPTURE_ANNOTATION_DEFAULT_STROKE_WIDTH: AnnotationStrokeWidth = 4;
export const PREVIEW_CAPTURE_ERASER_SIZE = 16;

export const ANNOTATION_COLOR_OPTIONS: readonly Readonly<{ readonly id: AnnotationColor; readonly label: string }>[] = [
  { id: "#ef4444", label: "빨강" },
  { id: "#2563eb", label: "파랑" },
  { id: "#facc15", label: "노랑" },
  { id: "#111827", label: "검정" },
  { id: "#ffffff", label: "흰색" },
];

export const ANNOTATION_STROKE_WIDTH_OPTIONS: readonly Readonly<{
  readonly value: AnnotationStrokeWidth;
  readonly label: string;
}>[] = [
  { value: 2, label: "얇게" },
  { value: 4, label: "보통" },
  { value: 8, label: "굵게" },
  { value: 12, label: "매우 굵게" },
];

export function isPreviewCaptureStrokeTool(tool: PreviewCaptureTool): tool is PreviewCaptureStrokeTool {
  return tool === "pen" || tool === "highlighter" || tool === "dashedPen" || tool === "marker";
}

export function isPreviewCaptureShapeTool(tool: PreviewCaptureTool): tool is PreviewCaptureShapeTool {
  return tool === "arrow" || tool === "rect";
}

export function buildAnnotationStyle(
  tool: PreviewCaptureStrokeTool | PreviewCaptureShapeTool,
  color: string,
  strokeWidth: AnnotationStrokeWidth,
): PreviewCaptureAnnotationStyle {
  const baseWidth = strokeWidth;
  switch (tool) {
    case "highlighter":
      return {
        color,
        strokeWidth: baseWidth * 2,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
      };
    case "dashedPen":
      return {
        color,
        strokeWidth: baseWidth,
        opacity: 1,
        lineDash: [6, 4],
        lineCap: "round",
        lineJoin: "round",
      };
    case "marker":
      return {
        color,
        strokeWidth: Math.round(baseWidth * 1.75),
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      };
    case "pen":
      return {
        color,
        strokeWidth: baseWidth,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
      };
    case "arrow":
    case "rect":
      return {
        color,
        strokeWidth: baseWidth,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
      };
  }
}

export function emptyPreviewCaptureAnnotationDocument(): PreviewCaptureAnnotationDocument {
  return { items: [] };
}

export function annotationToolSummary(items: readonly PreviewCaptureAnnotationItem[]): readonly PreviewCaptureTool[] {
  const tools = new Set<PreviewCaptureTool>();
  for (const item of items) {
    tools.add(item.tool);
  }
  return [...tools];
}

export function annotationStyleSummary(
  items: readonly PreviewCaptureAnnotationItem[],
): PreviewCaptureAnnotationStyleSummary {
  const colors = new Set<string>();
  const strokeWidths = new Set<number>();
  const tools = new Set<string>();
  for (const item of items) {
    tools.add(item.tool);
    colors.add(item.style.color);
    strokeWidths.add(item.style.strokeWidth);
  }
  return {
    colors: [...colors],
    strokeWidths: [...strokeWidths].sort((a, b) => a - b),
    tools: [...tools],
  };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function strokeHitByEraser(
  stroke: PreviewCaptureStroke,
  eraserPoints: ReadonlyArray<Readonly<{ readonly x: number; y: number }>>,
  radius: number,
): boolean {
  for (const ep of eraserPoints) {
    for (const p of stroke.points) {
      if (dist(ep, p) <= radius) return true;
    }
  }
  return false;
}

function shapeHitByEraser(
  shape: PreviewCaptureShape,
  eraserPoints: ReadonlyArray<Readonly<{ readonly x: number; y: number }>>,
  radius: number,
): boolean {
  const x = Math.min(shape.start.x, shape.end.x) - radius;
  const y = Math.min(shape.start.y, shape.end.y) - radius;
  const w = Math.abs(shape.end.x - shape.start.x) + radius * 2;
  const h = Math.abs(shape.end.y - shape.start.y) + radius * 2;
  for (const ep of eraserPoints) {
    if (ep.x >= x && ep.x <= x + w && ep.y >= y && ep.y <= y + h) return true;
  }
  return false;
}

export function removeAnnotationsHitByEraser(
  items: readonly PreviewCaptureAnnotationItem[],
  eraserPoints: ReadonlyArray<Readonly<{ readonly x: number; y: number }>>,
  radius: number = PREVIEW_CAPTURE_ERASER_SIZE,
): readonly PreviewCaptureAnnotationItem[] {
  if (!eraserPoints.length) return items;
  return items.filter((item) => {
    if ("points" in item) return !strokeHitByEraser(item, eraserPoints, radius);
    return !shapeHitByEraser(item, eraserPoints, radius);
  });
}

function applyStyleToContext(ctx: CanvasRenderingContext2D, style: PreviewCaptureAnnotationStyle, scale: number): void {
  ctx.strokeStyle = style.color;
  ctx.fillStyle = style.color;
  ctx.lineWidth = style.strokeWidth * scale;
  ctx.globalAlpha = style.opacity ?? 1;
  ctx.setLineDash(style.lineDash ? [...style.lineDash] : []);
  ctx.lineCap = style.lineCap ?? "round";
  ctx.lineJoin = style.lineJoin ?? "round";
}

export function paintPreviewCaptureAnnotationItem(
  ctx: CanvasRenderingContext2D,
  item: PreviewCaptureAnnotationItem,
  scale: number,
): void {
  if ("points" in item) {
    paintStroke(ctx, item, scale);
    return;
  }
  if (item.tool === "arrow") {
    paintArrowWithStyle(ctx, item.start, item.end, item.style, scale);
  } else {
    paintRectWithStyle(ctx, item.start, item.end, item.style, scale);
  }
}

export function paintPreviewCaptureAnnotations(
  ctx: CanvasRenderingContext2D,
  items: readonly PreviewCaptureAnnotationItem[],
  scale: number,
): void {
  for (const item of items) {
    paintPreviewCaptureAnnotationItem(ctx, item, scale);
  }
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: PreviewCaptureStroke, scale: number): void {
  if (stroke.points.length < 2) return;
  ctx.save();
  applyStyleToContext(ctx, stroke.style, scale);
  ctx.beginPath();
  ctx.moveTo(stroke.points[0]!.x * scale, stroke.points[0]!.y * scale);
  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i]!;
    ctx.lineTo(p.x * scale, p.y * scale);
  }
  ctx.stroke();
  ctx.restore();
}

function paintArrowWithStyle(
  ctx: CanvasRenderingContext2D,
  start: Readonly<{ readonly x: number; readonly y: number }>,
  end: Readonly<{ readonly x: number; readonly y: number }>,
  style: PreviewCaptureAnnotationStyle,
  coordScale: number,
): void {
  const sx = start.x * coordScale;
  const sy = start.y * coordScale;
  const ex = end.x * coordScale;
  const ey = end.y * coordScale;
  const lineWidth = style.strokeWidth * coordScale;
  const angle = Math.atan2(ey - sy, ex - sx);
  const head = Math.max(8, lineWidth * 3);

  ctx.save();
  applyStyleToContext(ctx, style, coordScale);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - head * Math.cos(angle - Math.PI / 6), ey - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(ex - head * Math.cos(angle + Math.PI / 6), ey - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintRectWithStyle(
  ctx: CanvasRenderingContext2D,
  start: Readonly<{ readonly x: number; readonly y: number }>,
  end: Readonly<{ readonly x: number; readonly y: number }>,
  style: PreviewCaptureAnnotationStyle,
  coordScale: number,
): void {
  const x = Math.min(start.x, end.x) * coordScale;
  const y = Math.min(start.y, end.y) * coordScale;
  const w = Math.abs(end.x - start.x) * coordScale;
  const h = Math.abs(end.y - start.y) * coordScale;

  ctx.save();
  applyStyleToContext(ctx, style, coordScale);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/** @deprecated use paintPreviewCaptureAnnotationItem */
export function paintArrow(
  ctx: CanvasRenderingContext2D,
  start: Readonly<{ readonly x: number; readonly y: number }>,
  end: Readonly<{ readonly x: number; readonly y: number }>,
  lineWidth: number,
  color: string,
  coordScale = 1,
): void {
  paintArrowWithStyle(
    ctx,
    start,
    end,
    { color, strokeWidth: lineWidth / Math.max(coordScale, 1), opacity: 1, lineCap: "round" },
    coordScale,
  );
}

/** @deprecated use paintPreviewCaptureAnnotationItem */
export function paintRect(
  ctx: CanvasRenderingContext2D,
  start: Readonly<{ readonly x: number; readonly y: number }>,
  end: Readonly<{ readonly x: number; readonly y: number }>,
  lineWidth: number,
  color: string,
  coordScale = 1,
): void {
  paintRectWithStyle(
    ctx,
    start,
    end,
    { color, strokeWidth: lineWidth / Math.max(coordScale, 1), opacity: 1 },
    coordScale,
  );
}
