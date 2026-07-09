import { NextResponse } from "next/server";
import {
  JYKSTORE_SERVICE_NAME,
  JYKSTORE_SERVICE_VERSION,
} from "@/lib/runtime-metadata";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: JYKSTORE_SERVICE_NAME,
    version: JYKSTORE_SERVICE_VERSION,
    status: "alive",
  });
}
