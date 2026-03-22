import { NextResponse } from "next/server";
import { RBAC_FORBIDDEN_CODE } from "@/lib/rbac/projectAccessDenied";

export function forbiddenJsonResponse(message: string) {
  return NextResponse.json(
    {
      success: false,
      code: RBAC_FORBIDDEN_CODE,
      message,
    },
    { status: 403 }
  );
}
