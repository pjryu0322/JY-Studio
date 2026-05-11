import type { KnowledgePackLicenseType } from "@/lib/knowledge-packs/types";

/** 목록·상세·Markdown 등에서 동일하게 쓰는 라이선스 표시 문자열 */
export function formatKnowledgePackLicenseType(type: KnowledgePackLicenseType): string {
  if (type === "MIT") return "MIT";
  if (type === "OPEN_SOURCE") return "Open Source";
  return type;
}
