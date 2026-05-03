import type { CSSProperties } from "react";

/**
 * 액터·서비스 흐름 정의 화면 채팅 스크롤 영역과 동일한 규격.
 * 다른 워크스페이스(기능 정리 등) 메시지 목록에도 그대로 사용한다.
 */
export const workspaceStandardChatScrollAreaStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  padding: "12px 20px 14px",
  display: "grid",
  gap: 10,
  alignContent: "start",
};
