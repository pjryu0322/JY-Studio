import { NextResponse } from "next/server";
import { loadGraph } from "@/lib/graph/buildGraphFromTemplate";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const family = url.searchParams.get("family")?.trim() || "default/general";
  const docId = url.searchParams.get("docId")?.trim();
  if (!docId) {
    return NextResponse.json({ error: "docId is required" }, { status: 400 });
  }
  const graph = await loadGraph(family, docId);
  if (!graph) return NextResponse.json({ error: "graph not found" }, { status: 404 });
  return NextResponse.json(graph);
}
