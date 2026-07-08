import { NextRequest } from "next/server";
import { handleExportChunkRequest } from "@/lib/export-chunk-route-handler";

export async function GET(request: NextRequest) {
  return handleExportChunkRequest(request, "graph");
}
