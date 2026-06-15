export type PreviewCaptureTool = "pen" | "arrow" | "rect" | "eraser";

export type PreviewCaptureStroke = Readonly<{
  readonly id: string;
  readonly tool: "pen";
  readonly points: ReadonlyArray<Readonly<{ readonly x: number; readonly y: number }>>;
  readonly size: number;
  readonly color: string;
}>;

export type PreviewCaptureShape = Readonly<{
  readonly id: string;
  readonly tool: "arrow" | "rect";
  readonly start: Readonly<{ readonly x: number; readonly y: number }>;
  readonly end: Readonly<{ readonly x: number; readonly y: number }>;
  readonly size: number;
  readonly color: string;
}>;

export type PreviewCaptureAnnotationItem = PreviewCaptureStroke | PreviewCaptureShape;

export type PreviewCaptureAnnotationDocument = Readonly<{
  readonly items: readonly PreviewCaptureAnnotationItem[];
}>;

export const PREVIEW_CAPTURE_ANNOTATION_DEFAULT_COLOR = "#ef4444";
export const PREVIEW_CAPTURE_ANNOTATION_DEFAULT_SIZE = 3;
export const PREVIEW_CAPTURE_ERASER_SIZE = 16;

export function emptyPreviewCaptureAnnotationDocument(): PreviewCaptureAnnotationDocument {
  return { items: [] };
}

export function annotationToolSummary(items: readonly PreviewCaptureAnnotationItem[]): readonly PreviewCaptureTool[] {
  const tools = new Set<PreviewCaptureTool>();
  for (const item of items) {
    if (item.tool === "pen") tools.add("pen");
    else if (item.tool === "arrow") tools.add("arrow");
    else if (item.tool === "rect") tools.add("rect");
  }
  return [...tools];
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function strokeHitByEraser(
  stroke: PreviewCaptureStroke,
  eraserPoints: ReadonlyArray<Readonly<{ readonly x: number; readonly y: number }>>,
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
  eraserPoints: ReadonlyArray<Readonly<{ readonly x: number; readonly y: number }>>,
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
  eraserPoints: ReadonlyArray<Readonly<{ readonly x: number; readonly y: number }>>,
  radius: number = PREVIEW_CAPTURE_ERASER_SIZE,
): readonly PreviewCaptureAnnotationItem[] {
  if (!eraserPoints.length) return items;
  return items.filter((item) => {
    if (item.tool === "pen") return !strokeHitByEraser(item, eraserPoints, radius);
    return !shapeHitByEraser(item, eraserPoints, radius);
  });
}

export function paintPreviewCaptureAnnotations(
  ctx: CanvasRenderingContext2D,
  items: readonly PreviewCaptureAnnotationItem[],
  scale: number,
): void {
  for (const item of items) {
    if (item.tool === "pen") {
      paintPenStroke(ctx, item, scale);
    } else if (item.tool === "arrow") {
      paintArrow(ctx, item.start, item.end, item.size * scale, item.color);
    } else if (item.tool === "rect") {
      paintRect(ctx, item.start, item.end, item.size * scale, item.color);
    }
  }
}

function paintPenStroke(ctx: CanvasRenderingContext2D, stroke: PreviewCaptureStroke, scale: number): void {
  if (stroke.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(stroke.points[0]!.x * scale, stroke.points[0]!.y * scale);
  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i]!;
    ctx.lineTo(p.x * scale, p.y * scale);
  }
  ctx.stroke();
  ctx.restore();
}

export function paintArrow(
  ctx: CanvasRenderingContext2D,
  start: Readonly<{ readonly x: number; readonly y: number }>,
  end: Readonly<{ readonly x: number; readonly y: number }>,
  lineWidth: number,
  color: string,
  coordScale = 1,
): void {
  const sx = start.x * coordScale;
  const sy = start.y * coordScale;
  const ex = end.x * coordScale;
  const ey = end.y * coordScale;
  const angle = Math.atan2(ey - sy, ex - sx);
  const head = Math.max(8, lineWidth * 3);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
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

export function paintRect(
  ctx: CanvasRenderingContext2D,
  start: Readonly<{ readonly x: number; readonly y: number }>,
  end: Readonly<{ readonly x: number; readonly y: number }>,
  lineWidth: number,
  color: string,
  coordScale = 1,
): void {
  const x = Math.min(start.x, end.x) * coordScale;
  const y = Math.min(start.y, end.y) * coordScale;
  const w = Math.abs(end.x - start.x) * coordScale;
  const h = Math.abs(end.y - start.y) * coordScale;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
