import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { legacyBuilderDisabledBody } from "@/lib/legacy-builder-disabled";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";

export async function POST(request: NextRequest) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  return jsonWithClientIdCookie(legacyBuilderDisabledBody(), auth.clientId, { status: 410 });
}
