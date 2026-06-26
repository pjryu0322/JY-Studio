import { NextRequest } from "next/server";
import { respondKnowledgeGraphRevisionDetail } from "@/lib/project-knowledge/knowledgeGraphRevisionDetailRouteHandler";

type RouteContext = { readonly params: Promise<{ projectId: string; revisionId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { projectId, revisionId } = await context.params;
  return respondKnowledgeGraphRevisionDetail(request, projectId, revisionId);
}
