import type { OpenApiDocument } from "@/lib/openapi-dto";

const DISCOVERY_PATH = "/api/v1/openapi.json";

// discovery endpoint(무인증)를 제외한 필수 보호 path 목록.
const REQUIRED_PROTECTED_PATHS = [
  "/api/v1/retrieval/query",
  "/api/v1/graph/query",
  "/api/v1/exports/package",
  "/api/v1/exports/rag-jsonl",
  "/api/v1/exports/graph",
  "/api/v1/exports/package/chunk",
  "/api/v1/exports/rag-jsonl/chunk",
  "/api/v1/exports/graph/chunk",
  "/api/v1/exports/mcp-manifest",
  "/api/v1/exports/openapi",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * 개발 중 schema 조립 실수를 잡기 위한 lightweight validation.
 * 운영 응답을 깨뜨리지 않도록 throw하지 않고, 문제 발견 시 개발 모드에서만 경고한다.
 */
export function assertOpenApiSchemaShape(document: OpenApiDocument): void {
  const issues: string[] = [];

  const paths = asRecord(document.paths);
  if (!paths) {
    issues.push("paths object is missing");
  }

  // BearerAuth security scheme 존재 확인
  const components = asRecord(document.components);
  const securitySchemes = asRecord(components?.securitySchemes);
  if (!securitySchemes || !("BearerAuth" in securitySchemes)) {
    issues.push("components.securitySchemes.BearerAuth is missing");
  }

  const operationIds: string[] = [];
  const includesDiscovery = Boolean(paths && DISCOVERY_PATH in paths);

  if (paths) {
    for (const [pathKey, pathValue] of Object.entries(paths)) {
      const pathItem = asRecord(pathValue);
      if (!pathItem) continue;
      for (const [method, opValue] of Object.entries(pathItem)) {
        const operation = asRecord(opValue);
        if (!operation) continue;

        if (typeof operation.operationId === "string") {
          operationIds.push(operation.operationId);
        }

        const hasSecurity = Array.isArray(operation.security) && operation.security.length > 0;
        if (pathKey === DISCOVERY_PATH) {
          // discovery endpoint는 인증을 요구하지 않아야 한다.
          if (hasSecurity) {
            issues.push(`${method.toUpperCase()} ${pathKey} should not require authentication`);
          }
        } else if (!hasSecurity) {
          issues.push(`${method.toUpperCase()} ${pathKey} is missing security (BearerAuth)`);
        }
      }
    }

    // 필수 보호 path 존재 확인
    for (const requiredPath of REQUIRED_PROTECTED_PATHS) {
      if (!(requiredPath in paths)) {
        issues.push(`required path ${requiredPath} is missing`);
      }
    }
  }

  // operationId 중복 확인
  const seen = new Set<string>();
  for (const id of operationIds) {
    if (seen.has(id)) {
      issues.push(`duplicate operationId: ${id}`);
    }
    seen.add(id);
  }

  // common schema에만 discovery endpoint가 포함된다.
  // (pack-specific schema이면 title로 판별하여 discovery가 없어야 한다)
  const info = asRecord(document.info);
  const title = typeof info?.title === "string" ? info.title : "";
  const isCommonSchema = title === "JYKStore Public API";
  if (isCommonSchema && !includesDiscovery) {
    issues.push("common schema should include the discovery endpoint");
  }
  if (!isCommonSchema && includesDiscovery) {
    issues.push("pack-specific schema should not include the discovery endpoint");
  }

  // JSON 직렬화 가능 여부 확인
  try {
    JSON.stringify(document);
  } catch {
    issues.push("document is not JSON-serializable");
  }

  if (issues.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(`[openapi-schema] shape validation warnings:\n- ${issues.join("\n- ")}`);
  }
}
