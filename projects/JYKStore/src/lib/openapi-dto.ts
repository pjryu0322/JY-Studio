export const OPENAPI_SCHEMA_VERSION = "p15.2";
export const OPENAPI_SPEC_VERSION = "3.1.0";

export type OpenApiDocument = Record<string, unknown>;

export type OpenApiBuildOptions = {
  // pack-specific export일 때만 채운다. 없으면 공통(common) schema를 생성한다.
  packId?: string;
  packName?: string | null;
  packDescription?: string | null;
};
