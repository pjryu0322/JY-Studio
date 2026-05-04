import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";

const reviewAiTitle = () => getWorkspaceAiMember("prototype_review")?.title ?? "AI 검수자";

/** 검토 스레드가 비어 있을 때 한 번만 주입하는 환영 메시지(고정 문구). */
export const PROTOTYPE_REVIEW_WELCOME_MESSAGE = `안녕하세요. ${reviewAiTitle()}입니다.

현재 화면은 생성된 프로토타입 Preview입니다.
직접 보시면서 불편한 점, 수정하고 싶은 점, 추가하고 싶은 기능을 자유롭게 말씀해주세요.

예:
- 첫 화면이 복잡합니다
- 버튼이 잘 안보입니다
- 모바일 화면이 불편합니다
- 회원가입 절차를 단순화하고 싶습니다

의견을 주시면 제가 정리해서 보완작업으로 연결해드리겠습니다.`;
