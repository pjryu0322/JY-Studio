import type { OpenApiBuildOptions } from "@/lib/openapi-dto";

export const DEFAULT_EXAMPLE_PACK_ID = "easy-auth";

export const COMMON_DESCRIPTION =
  "Public API schema for external AI agents, GPT Actions, Gemini function calling wrappers, Cursor/MCP wrappers, and integration clients. JYKStore returns verified knowledge pack context and exports; it does not generate answers. Only PUBLISHED or VERIFIED knowledge packs are returned; other packs are treated as PACK_NOT_FOUND (404). All operations use a Bearer API Key and no API key is ever included in this schema.";

// 실제 배포 도메인은 placeholder로 유지한다. localhost:3004는 유지한다.
export const OPENAPI_SERVERS = [
  { url: "https://your-jykstore.example.com", description: "Production JYKStore origin" },
  { url: "http://localhost:3004", description: "Local development" },
];

export function buildOpenApiTitle(options: OpenApiBuildOptions): string {
  return options.packId
    ? `JYKStore ${options.packId} Knowledge Pack API`
    : "JYKStore Public API";
}

export function buildOpenApiDescription(options: OpenApiBuildOptions): string {
  return options.packId
    ? options.packDescription?.trim() ||
        `Public API schema for the "${options.packName ?? options.packId}" JYKStore knowledge pack. JYKStore returns verified knowledge pack context and exports; it does not generate answers.`
    : COMMON_DESCRIPTION;
}
