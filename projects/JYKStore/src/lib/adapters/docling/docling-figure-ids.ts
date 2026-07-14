/** Client-safe figure id helpers (no Node crypto). */

/** Route-safe id for `#/pictures/N` → `pictures-N`. */
export function figureRefToRouteParam(ref: string): string {
  const m = /^#\/pictures\/(\d+)$/.exec(ref.trim());
  if (m) return `pictures-${m[1]}`;
  return encodeURIComponent(ref.trim());
}

export function routeParamToFigureRef(param: string): string {
  const trimmed = param.trim();
  const m = /^pictures-(\d+)$/.exec(trimmed);
  if (m) return `#/pictures/${m[1]}`;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}
