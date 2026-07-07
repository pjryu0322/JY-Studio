import {
  OPENAPI_SCHEMA_VERSION,
  OPENAPI_SPEC_VERSION,
  type OpenApiBuildOptions,
  type OpenApiDocument,
} from "@/lib/openapi-dto";
import {
  DEFAULT_EXAMPLE_PACK_ID,
  OPENAPI_SERVERS,
  buildOpenApiDescription,
  buildOpenApiTitle,
} from "@/lib/openapi/openapi-config";
import { buildComponents } from "@/lib/openapi/openapi-components";
import { buildPaths } from "@/lib/openapi/openapi-paths";
import { bearerSecurity } from "@/lib/openapi/openapi-security";
import { assertOpenApiSchemaShape } from "@/lib/openapi/openapi-validation";

/**
 * JYKStore Public API의 OpenAPI 3.1 schema를 생성하는 final assembler.
 * 세부 구성(config/security/examples/components/paths/validation)은 src/lib/openapi/ 모듈로 분리되어 있다.
 * options.packId가 있으면 pack-specific(title/description/example) schema를 생성한다.
 * schema에는 실제 API Key 값을 절대 포함하지 않는다(dummy만 사용).
 */
export function buildOpenApiSchema(options: OpenApiBuildOptions = {}): OpenApiDocument {
  const examplePackId = options.packId ?? DEFAULT_EXAMPLE_PACK_ID;

  // 공통 schema에만 discovery endpoint(/api/v1/openapi.json)를 포함한다.
  const includeDiscovery = !options.packId;

  const document: OpenApiDocument = {
    openapi: OPENAPI_SPEC_VERSION,
    info: {
      title: buildOpenApiTitle(options),
      version: OPENAPI_SCHEMA_VERSION,
      description: buildOpenApiDescription(options),
    },
    servers: OPENAPI_SERVERS,
    security: bearerSecurity(),
    paths: buildPaths(examplePackId, includeDiscovery),
    components: buildComponents(),
  };

  assertOpenApiSchemaShape(document);
  return document;
}
