// Knowledge Graph service facade.
// 내부 구현은 src/lib/knowledge-graph/ 하위 모듈로 분리되었다.
// 기존 import 경로/함수 이름 호환을 위해 여기서 재수출한다.
export { getKnowledgeGraphSummary } from "@/lib/knowledge-graph/graph-summary-service";
export { rebuildKnowledgeGraph } from "@/lib/knowledge-graph/graph-rebuild-service";
export { queryKnowledgeGraph } from "@/lib/knowledge-graph/graph-query-service";
export { exportKnowledgeGraph } from "@/lib/knowledge-graph/graph-export-service";
