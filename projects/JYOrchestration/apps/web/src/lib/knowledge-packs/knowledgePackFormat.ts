import type { KnowledgePackLicenseType } from "@/lib/knowledge-packs/types";

/** 목록·상세·Markdown 등에서 동일하게 쓰는 라이선스 표시 문자열 */
export function formatKnowledgePackLicenseType(type: KnowledgePackLicenseType): string {
  if (type === "MIT") return "MIT";
  if (type === "OPEN_SOURCE") return "Open Source";
  if (type === "COMMERCIAL") return "상용";
  if (type === "UNKNOWN") return "미상/사용자 제공";
  if (type === "PARTNER_LICENSE") return "파트너 라이선스";
  if (type === "USER_PROVIDED_LICENSE") return "사용자 제공 라이선스";
  if (type === "EXTERNAL_SERVICE") return "외부 서비스 연동";
  return type;
}
