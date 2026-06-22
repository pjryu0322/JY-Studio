export type MessengerChatRoomDeleteModalVariant = "plain" | "linkedProject";

export function messengerChatRoomDeleteModalCopy(variant: MessengerChatRoomDeleteModalVariant): Readonly<{
  readonly title: string;
  readonly body: string;
  readonly bullets?: readonly string[];
  readonly confirmLabel: string;
}> {
  if (variant === "linkedProject") {
    return {
      title: "프로젝트에 연결된 대화방을 삭제할까요?",
      body:
        "이 대화방은 프로젝트와 연결되어 있습니다.\n" +
        "삭제를 진행하면 대화방, 메시지, 연결된 프로젝트의 기획/구현/검토 관련 정보가 모두 삭제 또는 초기화됩니다.",
      bullets: [
        "대화방 및 메시지",
        "프로젝트 연결 정보",
        "기획단계 대화 및 산출물",
        "Quick Design 결과",
        "구현 준비 정보",
        "구현 작업 목록",
        "CodeTask 정보",
        "검토 준비 정보",
        "프로젝트 관련 실행 상태 및 임시 데이터",
      ],
      confirmLabel: "모두 삭제",
    };
  }
  return {
    title: "대화방을 삭제할까요?",
    body: "이 대화방과 대화 메시지가 삭제됩니다.\n삭제된 정보는 복구할 수 없습니다.",
    confirmLabel: "삭제",
  };
}
