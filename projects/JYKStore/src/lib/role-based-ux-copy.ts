/** Account / Provider role UX copy (testable without React). */

export const ACCOUNT_SECTION_BASIC = "기본 사용";
export const ACCOUNT_SECTION_ROLES = "내 역할";
export const ACCOUNT_SECTION_ROLE_REGISTRATION = "역할 계정 등록";
export const ACCOUNT_SECTION_ROLE_MENUS = "사용자 메뉴";
export const ACCOUNT_SECTION_SETTINGS = "설정";

export const PROVIDER_CENTER_LOGIN_TITLE = "제공자 센터를 이용하려면 로그인이 필요합니다.";
export const PROVIDER_CENTER_LOGIN_CTA = "로그인하고 제공자 센터 열기";

export const ACCOUNT_PROFILE_LOGIN_TITLE = "JYKStore 로그인";
export const ACCOUNT_PROFILE_LOGIN_HINT =
  "기존 계정은 로그인하세요. 계정 생성 시 역할은 하나만 선택할 수 있으며, 제공자와 일반 사용자는 각각 별도 계정이 필요합니다.";

export const ACCOUNT_REGISTER_ROLE_LABEL = "계정 역할 (생성 시 · 변경 불가)";
export const ACCOUNT_REGISTER_ROLE_USER = "일반 사용자";
export const ACCOUNT_REGISTER_ROLE_USER_HINT =
  "지식팩 검색·보관·API 연결 (제공자로 등록하려면 별도 계정)";
export const ACCOUNT_REGISTER_ROLE_PROVIDER = "지식팩 제공자";
export const ACCOUNT_REGISTER_ROLE_PROVIDER_HINT =
  "지식팩 등록·검수 요청 (사용·보관은 별도 사용자 계정)";
export const ACCOUNT_REGISTER_ROLE_ADMIN = "관리자";
export const ACCOUNT_REGISTER_ROLE_ADMIN_HINT = "지식팩 검수·승인 및 운영 콘솔";

export const ACCOUNT_ROLE_SEPARATION_NOTE =
  "한 계정은 하나의 역할만 가집니다. 제공자와 일반 사용자를 모두 쓰려면 계정을 따로 만드세요.";

export const ACCOUNT_USER_NEEDS_PROVIDER_ACCOUNT =
  "제공자 프로필은 제공자 계정에서만 관리합니다. 지식팩을 등록하려면 제공자 계정을 새로 만든 뒤 그 계정으로 로그인하세요.";

export const PROVIDER_CENTER_PROFILE_LINK_LABEL = "프로필 관리";

export const PROVIDER_CENTER_TAGLINE =
  "지식팩 기본정보를 관리하고 검수 요청·공개 상태를 확인합니다.";

export const PROVIDER_CENTER_BEFORE_PROFILE_TITLE = "제공자 권한이 필요합니다.";
export const PROVIDER_CENTER_BEFORE_PROFILE_BODY =
  "현재 계정은 제공자 역할이 아닙니다. 제공자 센터는 제공자 계정으로만 이용할 수 있습니다. 같은 사람이라도 사용자 계정과 제공자 계정은 별도로 발급받아야 합니다.";

export const MY_PACKS_PROVIDER_REDIRECT_TITLE = "내 지식팩은 일반 사용자 계정용입니다.";
export const MY_PACKS_PROVIDER_REDIRECT_BODY =
  "제공자 계정에서는 등록·검수 중인 지식팩을 제공자 센터에서 관리하세요. 보관한 지식팩을 쓰려면 일반 사용자 계정으로 로그인하세요.";

export const PROVIDER_CENTER_REGISTERED_TITLE = "제공자 계정 확인됨";
export const PROVIDER_CENTER_REGISTERED_BODY =
  "현재 계정으로 기존 지식팩의 검수·공개 상태를 관리할 수 있습니다.";

export const PROVIDER_CENTER_NEXT_TASK =
  "지식팩을 등록하고 검수 요청을 제출하세요.";

export const PROVIDER_PAYLOAD_IMPORT_PREP_TITLE = "지식팩 등록";
export const PROVIDER_PAYLOAD_IMPORT_PREP_BODY =
  "외부 생성 도구의 결과물과 원본문서를 등록해 지식팩을 제출할 수 있습니다.";
export const PROVIDER_PAYLOAD_IMPORT_PREP_HINT =
  "기본정보 → 자료 등록 → 유통정보 → 검수요청 순서로 진행하세요.";

export const PROVIDER_PACK_NEW_BLOCKED_TITLE = "지식팩 등록";
export const PROVIDER_PACK_NEW_BLOCKED_BODY =
  "외부 생성 도구의 결과물과 원본문서를 등록해 지식팩을 제출할 수 있습니다.";

export const PROVIDER_PACK_REGISTER_CTA = "지식팩 등록";
export const PROVIDER_PACK_REGISTER_HINT =
  "외부 생성 도구의 결과물과 원본문서를 등록합니다.";
export const PROVIDER_PACK_EMPTY_TITLE = "등록한 지식팩이 없습니다.";
export const PROVIDER_PACK_EMPTY_BODY =
  "외부 생성 도구에서 만든 자료를 등록해 검수 요청할 수 있습니다.";

export const PROVIDER_PACK_CREATE_AUTO_ID_HINT =
  "이름과 설명을 입력하면 JYKStore가 지식팩 ID와 요약 설명을 자동 생성합니다.";

export const PROVIDER_PACK_CREATED_BANNER_TITLE = "지식팩 초안 생성 완료";
export const PROVIDER_PACK_CREATED_ID_PREFIX = "JYKStore가 지식팩 ID를 발급했습니다:";
export const PROVIDER_PACK_CREATED_NEXT_TASK =
  "다음 할 일: 기본정보를 확인한 뒤 자료를 등록하고 데이터 구조화·검색 검증을 진행하세요.";
export const PROVIDER_PACK_ID_LABEL = "지식팩 ID";

export const PROVIDER_PACK_WIZARD_BASIC_STEP = "기본정보";
export const PROVIDER_PACK_WIZARD_MATERIALS_STEP = "기존 자료";
/** @deprecated Builder freeze */
export const PROVIDER_PACK_WIZARD_SOURCE_STEP = PROVIDER_PACK_WIZARD_MATERIALS_STEP;
/** @deprecated Builder freeze */
export const PROVIDER_PACK_WIZARD_DRAFT_STEP = "기존 자료";
/** @deprecated Builder freeze */
export const PROVIDER_PACK_WIZARD_INSPECTION_STEP = "검수 요청";
export const PROVIDER_PACK_WIZARD_REVIEW_STEP = "유통정보·검수요청";
export const PROVIDER_PACK_WIZARD_PUBLISH_STEP = "승인·공개";

export const PROVIDER_PACK_TAB_BASIC = "기본정보";
export const PROVIDER_PACK_TAB_BASIC_SHORT = "기본";
export const PROVIDER_PACK_TAB_PAYLOAD = "자료 등록";
export const PROVIDER_PACK_TAB_PAYLOAD_SHORT = "자료";
export const PROVIDER_PACK_TAB_KNOWLEDGE = "데이터 구조화";
export const PROVIDER_PACK_TAB_KNOWLEDGE_SHORT = "구조화";
export const PROVIDER_PACK_TAB_SERVICE_VALIDATION = "검색데이터 생성·검증";
export const PROVIDER_PACK_TAB_SERVICE_VALIDATION_SHORT = "검색검증";
export const PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW = "유통정보·검수요청";
export const PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW_SHORT = "유통·검수";
/** @deprecated Prefer PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW */
export const PROVIDER_PACK_TAB_DISTRIBUTION = PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW;
export const PROVIDER_PACK_TAB_MATERIALS = "기존 자료";
/** @deprecated Prefer PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW */
export const PROVIDER_PACK_TAB_REVIEW = PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW;

export const PROVIDER_PACK_MATERIALS_TITLE = "기존 자료";
export const PROVIDER_PACK_MATERIALS_HINT =
  "검수 대상인 최신 버전의 원천 자료를 확인합니다. 신규 내부 생성·자동수집은 종료되었습니다.";
export const PROVIDER_PACK_MATERIALS_REVIEW_VERSION_LABEL = "검수 대상 버전";
export const PROVIDER_PACK_MATERIALS_NO_VERSION = "등록된 버전이 없습니다.";
export const PROVIDER_PACK_MATERIALS_EMPTY =
  "현재 버전에 등록된 자료가 없습니다. 자료를 등록한 뒤 검수 요청을 진행할 수 있습니다.";

export const PROVIDER_PACK_GO_TO_PAYLOAD_TAB = "자료 등록으로 이동";
export const PROVIDER_PACK_GO_TO_KNOWLEDGE_TAB = "데이터 구조화로 이동";
export const PROVIDER_PACK_GO_TO_DISTRIBUTION_TAB = "유통정보·검수요청으로 이동";
export const PROVIDER_PACK_GO_TO_SERVICE_VALIDATION_TAB = "검색데이터 생성·검증으로 이동";
export const PROVIDER_PACK_GO_TO_MATERIALS_TAB = "기존 자료로 이동";
export const PROVIDER_PACK_GO_TO_REVIEW_TAB = "유통정보·검수요청으로 이동";
/** @deprecated Builder freeze — prefer PROVIDER_PACK_GO_TO_MATERIALS_TAB */
export const PROVIDER_PACK_GO_TO_SOURCE_TAB = PROVIDER_PACK_GO_TO_MATERIALS_TAB;
/** @deprecated Builder freeze */
export const PROVIDER_PACK_GO_TO_DRAFT_TAB = "기존 자료로 이동";
/** @deprecated Builder freeze */
export const PROVIDER_PACK_GO_TO_DRAFT_SHORT = "기존 자료로 이동";
/** @deprecated Builder freeze */
export const PROVIDER_PACK_GO_TO_INSPECTION_TAB = "검수요청으로 이동";
/** @deprecated Builder freeze */
export const PROVIDER_PACK_GO_TO_INSPECTION_SHORT = "검수요청으로 이동";
export const PROVIDER_PACK_NEXT_TASK_MATERIALS =
  "기존 자료를 확인한 뒤 검수 요청을 준비하세요.";
export const PROVIDER_PACK_NEXT_TASK_SUBMIT =
  "기본정보와 자료를 확인했다면 검수 요청을 제출하세요.";
export const PROVIDER_PACK_NEXT_TASK_WAITING_ADMIN =
  "관리자 검토 결과를 기다려 주세요.";

export const PROVIDER_PACK_REVIEW_READY_TITLE = "검수 요청 준비";
export const PROVIDER_PACK_REVIEW_READY_BODY =
  "기본정보·자료 등록·데이터 구조화·검색데이터 생성·검증·유통정보가 모두 완료되면 검수요청을 제출할 수 있습니다.";

export const PROVIDER_SUBMIT_CTA = "검수 요청 제출";
export const PROVIDER_SUBMIT_CONFIRM =
  "검수 요청을 제출할까요? 제출 후에는 초안 수정이 제한됩니다.";
export const PROVIDER_SUBMIT_ADMIN_FOOTER_NOTICE =
  "제출 후 관리자가 접수·승인하면 카탈로그에 공개됩니다.";

export const PROVIDER_REVIEW_WAITING_TITLE = "검수 요청이 제출되었습니다.";
export const PROVIDER_REVIEW_WAITING_BODY =
  "관리자 접수를 기다리는 중입니다. 승인 전까지 일반 카탈로그와 Context API에는 노출되지 않습니다.";
export const PROVIDER_REVIEW_ACCEPTED_TITLE = "관리자가 검수를 시작했습니다.";
export const PROVIDER_REVIEW_ACCEPTED_BODY =
  "검수 진행 중에는 요청을 회수할 수 없습니다. 결과가 나올 때까지 기다려 주세요.";
export const PROVIDER_REVIEW_WITHDRAW_CTA = "검수 요청 회수";
export const PROVIDER_REVIEW_WITHDRAW_CONFIRM =
  "검수 요청을 회수할까요? 초안(DRAFT) 상태로 돌아가며 다시 수정한 뒤 제출할 수 있습니다.";
export const PROVIDER_REVIEW_WITHDRAW_HINT =
  "관리자가 접수하기 전까지는 검수 요청을 회수할 수 있습니다. 내용을 보완하려면 회수 후 초안에서 수정하세요.";
export const PROVIDER_REVIEW_WITHDRAW_LOCKED_HINT =
  "관리자가 이미 접수한 검수 요청은 회수할 수 없습니다.";
export const PROVIDER_REVIEW_REJECTED_TITLE = "검수 반려됨";
export const PROVIDER_REVIEW_REJECTED_GO_FIX = "자료 확인하러 가기";
export const PROVIDER_REVIEW_REJECTED_ACK_CTA = "반려 사유 확인";
export const PROVIDER_REVIEW_REJECTED_ACK_HINT =
  "반려 사유를 확인하기 전까지 지식팩을 수정할 수 없습니다.";
export const PROVIDER_PACK_LOCKED_REVIEWING =
  "관리자 검수 중입니다. 검수 요청을 회수하기 전까지 편집할 수 없습니다.";
export const PROVIDER_PACK_LOCKED_ADMIN_GENERATION =
  "관리자가 자료를 접수·생성·검토 중입니다. 제공자 쪽 작업이 다시 열릴 때까지 수정할 수 없습니다.";
export const PROVIDER_PACK_LOCKED_GENERATION_REVIEW =
  "관리자가 생성·품질점검한 지식데이터를 검토해 주세요. 아래 상세 검토에서 확인 완료하거나 보완 요청을 작성하세요.";
export const PROVIDER_PACK_LOCKED_WAITING_ADMIN_SERVICE =
  "생성 결과 확인이 완료되었습니다. 관리자 서비스 검증·최종 검수 결과를 기다려 주세요.";
export const PROVIDER_PACK_LOCKED_REJECTION =
  "검수 반려 사유를 확인한 뒤에 수정을 시작할 수 있습니다.";
export const PROVIDER_REVIEW_DEV_ADMIN_HINT =
  "개발자 테스트: 관리자 콘솔에서 검수 대기 목록을 확인하세요.";

export const ADMIN_LOGIN_TITLE = "JYKStore 관리자 로그인";
export const ADMIN_LOGIN_DESCRIPTION =
  "검수 요청된 지식팩을 확인하고 승인 또는 반려합니다.";
export const ADMIN_ACCESS_REQUIRED_TITLE = "관리자 권한이 필요합니다.";
export const ADMIN_ACCESS_REQUIRED_BODY = "관리자 계정으로 로그인해 주세요.";
export const ADMIN_CONSOLE_TITLE = "관리자 콘솔";
export const ADMIN_WORK_INBOX_TITLE = "오늘 처리할 일";
export const ADMIN_WORK_INBOX_DESCRIPTION =
  "접수·생성·품질점검·제공자 검토·검수 순으로 확인하세요.";
export const ADMIN_WORK_SECTION_ACCEPT_TITLE = "접수해야 할 지식팩";
export const ADMIN_WORK_SECTION_ACCEPT_BODY =
  "제공자가 ZIP 자료 생성을 요청했습니다. 접수한 뒤 생성을 진행하세요.";
export const ADMIN_WORK_SECTION_ACCEPT_CTA = "접수하기";
export const ADMIN_WORK_SECTION_GENERATE_TITLE = "생성 실행이 필요한 지식팩";
export const ADMIN_WORK_SECTION_GENERATE_BODY =
  "접수는 끝났습니다. 지식데이터 생성을 실행하세요.";
export const ADMIN_WORK_SECTION_GENERATE_CTA = "생성 실행하기";
export const ADMIN_WORK_SECTION_QUALITY_TITLE = "품질점검이 필요한 지식팩";
export const ADMIN_WORK_SECTION_QUALITY_BODY =
  "생성이 끝났습니다. 품질을 점검한 뒤 제공자에게 검토를 요청하세요.";
export const ADMIN_WORK_SECTION_QUALITY_CTA = "품질 점검 후 검토 요청";
export const ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE = "제공자 검토 진행";
export const ADMIN_WORK_SECTION_PROVIDER_REVIEW_BODY =
  "제공자가 생성 결과를 확인 중입니다. 관리자 조치 대기가 아닙니다.";
export const ADMIN_WORK_SECTION_PROVIDER_REVIEW_CTA = "검토 요청 내역 보기";
export const ADMIN_WORK_SECTION_PACK_REVIEW_TITLE = "검수 요청 접수";
export const ADMIN_WORK_SECTION_PACK_REVIEW_BODY =
  "제공자 확인이 끝나 관리자 검수가 필요합니다.";
export const ADMIN_WORK_SECTION_PACK_REVIEW_CTA = "검수 시작";
export const ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_TITLE = "검수 진행 중";
export const ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_BODY =
  "관리자가 검수를 시작한 지식팩입니다. 이어서 진행하세요.";
export const ADMIN_WORK_SECTION_PACK_REVIEW_IN_PROGRESS_CTA = "검수 계속하기";
export const ADMIN_WORK_SECTION_PUBLISHED_TITLE = "공개 지식팩";
export const ADMIN_WORK_SECTION_PUBLISHED_BODY =
  "이미 공개된 지식팩입니다. 대기 업무가 아닙니다.";
export const ADMIN_WORK_SECTION_PUBLISHED_CTA = "공개 상세 보기";
export const ADMIN_WORK_FILTER_CATEGORY_ALL = "전체 카테고리";
export const ADMIN_WORK_FILTER_STATUS_ALL = "전체 상태";
export const ADMIN_WORK_FILTER_STATUS_ACCEPT = "접수 대기";
export const ADMIN_WORK_FILTER_STATUS_GENERATE = "생성 실행";
export const ADMIN_WORK_FILTER_STATUS_QUALITY = "품질점검 대기";
export const ADMIN_WORK_FILTER_STATUS_PROVIDER_REVIEW = "제공자 검토 중";
export const ADMIN_WORK_FILTER_STATUS_PACK_REVIEW = "검수 요청 접수";
export const ADMIN_WORK_FILTER_STATUS_PACK_REVIEW_IN_PROGRESS = "검수 진행 중";
export const ADMIN_WORK_FILTER_NO_MATCH = "조건에 맞는 지식팩이 없습니다.";
export const ADMIN_WORK_EMPTY = "지금 처리할 작업이 없습니다.";
export const ADMIN_WORK_SUMMARY_LABEL = "대기";
export const ADMIN_REVIEWS_LIST_TITLE = "검수 대기 지식팩";
export const ADMIN_REVIEWS_OPEN_DETAIL = "검토하기";
export const ADMIN_REVIEWS_STATUS_PENDING = "접수 대기";
export const ADMIN_REVIEWS_STATUS_IN_REVIEW = "검수 중";

export const ADMIN_REVIEW_TAB_PACKAGE = "패키지";
export const ADMIN_REVIEW_TAB_WARNINGS = "주의";
export const ADMIN_REVIEW_TAB_SOURCES = "문서";
export const ADMIN_REVIEW_TAB_PROCESSING = "처리·검증";
/** @deprecated Use ADMIN_REVIEW_TAB_PROCESSING */
export const ADMIN_REVIEW_TAB_DOCLING = ADMIN_REVIEW_TAB_PROCESSING;
export const ADMIN_REVIEW_TAB_SERVICE_VALIDATION = "운영 로그";
export const ADMIN_REVIEW_TAB_ADVANCED = "고급";
export const ADMIN_REVIEW_EVIDENCE_SECTION_TITLE = "판단 근거";
export const ADMIN_REVIEW_RECEIPT_INFO_TITLE = "접수 정보";
export const ADMIN_REVIEW_CTA_VIEW_PACKAGE = "제출 패키지 보기";
export const ADMIN_REVIEW_WARNING_TAB_HINT_ACCEPTED =
  "승인 전 확인할 항목입니다.";

export const ADMIN_REVIEW_PROCESSING_TAB_HINT =
  "생성 도구, 변환 규격, 파일 무결성, 정규화 결과 및 서비스 준비 상태를 확인합니다.";
export const ADMIN_REVIEW_DOCUMENTS_TAB_HINT =
  "제출된 원본·산출물 파일과 정규화 문서 미리보기를 확인합니다.";
export const ADMIN_REVIEW_DOCUMENTS_EMPTY = "제출된 문서 파일이 없습니다.";
export const ADMIN_REVIEW_SOURCE_DOCS_TITLE = "문서";
export const ADMIN_REVIEW_PROCESSING_TITLE = "처리·검증";

export const ADMIN_REVIEW_DECISION_TITLE = "최종 검수 판단";
export const ADMIN_REVIEW_ACCEPT_TITLE = "검수 요청 접수";
export const ADMIN_REVIEW_ACCEPT_BLOCKED_TITLE = "검수 요청 접수 불가";
export const ADMIN_REVIEW_ACCEPT_BODY =
  "제공자가 제출한 검수 패키지가 생성되었습니다. 접수 후에는 제공자가 요청을 회수할 수 없습니다.";
export const ADMIN_REVIEW_ACCEPT_BLOCKED_BODY =
  "제출 패키지가 없거나 필수 검수 데이터가 부족합니다. 제공자에게 재제출을 요청하세요.";
export const ADMIN_REVIEW_ACCEPTED_HINT =
  "제출된 검수 패키지는 접수되었습니다. WARNING 항목을 확인한 뒤 승인 또는 반려하세요.";
export const ADMIN_REVIEW_CTA_ACCEPT = "검수 접수";
export const ADMIN_REVIEW_ACCEPT_REQUIRED_HINT =
  "승인·반려하려면 먼저 검수 접수를 완료하세요.";
export const ADMIN_REVIEW_ACCEPT_NO_WITHDRAW_HINT =
  "접수 후에는 제공자가 요청을 회수할 수 없습니다.";
export const ADMIN_REVIEW_WARNING_TAB_HINT =
  "접수 후 검수 시 확인할 항목입니다.";
export const ADMIN_REVIEW_WARNING_TAB_HINT_DOCLING =
  "Docling 원본 3파일, 정규화 결과, 유통정보 및 무결성을 기준으로 검수합니다. Legacy 원천 문서·Chunk·Release Gate 기준은 적용하지 않습니다.";
export const ADMIN_REVIEW_BLOCKERS_EMPTY = "차단 이슈 없음";
export const ADMIN_REVIEW_WARNINGS_EMPTY = "주의 이슈 없음";
export const ADMIN_REVIEW_ISSUES_EMPTY = "표시할 주의·차단 이슈가 없습니다.";
export const ADMIN_REVIEW_ADVANCED_TAB_HINT =
  "현재 데이터 기준으로 다시 점검할 수 있습니다. 일반적인 검수 접수/승인 흐름에서는 사용할 필요가 없습니다.";
export const ADMIN_REVIEW_INSPECTION_SUMMARY_TITLE = "검수 요약";
export const ADMIN_REVIEW_NEEDS_ATTENTION_TITLE = "확인 필요 항목";
export const ADMIN_REVIEW_DETAIL_SECTIONS_TITLE = "상세 점검 결과";
export const ADMIN_REVIEW_WARNING_ISSUES_TITLE = "주의 이슈";
export const ADMIN_REVIEW_BLOCKER_ISSUES_TITLE = "차단 이슈";
export const ADMIN_REVIEW_SUBMIT_INFO_TITLE = "제출 정보";

export const ADMIN_REVIEW_ACCEPT_PHASE_READY_TITLE = "접수 가능";
export const ADMIN_REVIEW_ACCEPT_PHASE_READY_BODY =
  "제출 패키지가 정상적으로 생성되었습니다. 접수 후 승인 여부를 최종 판단하세요.";
export const ADMIN_REVIEW_ACCEPT_PHASE_WARNING_TITLE = "접수 가능 · 주의 항목 있음";
export const ADMIN_REVIEW_ACCEPT_PHASE_WARNING_BODY =
  "제출 패키지는 생성되었고, WARNING 항목이 있습니다. 접수 후 상세 검수를 진행하세요.";
export const ADMIN_REVIEW_ACCEPT_PHASE_BLOCKED_TITLE = "접수 불가";
export const ADMIN_REVIEW_ACCEPT_PHASE_BLOCKED_BODY =
  "제출 패키지에 차단 이슈가 있습니다. 제공자에게 보완 후 재제출을 요청하세요.";

export const ADMIN_REVIEW_STATE_GATE_REQUIRED_TITLE = "릴리스 게이트 필요";
export const ADMIN_REVIEW_STATE_GATE_REQUIRED_BODY =
  "공개 승인 전 최종 품질 점검이 아직 실행되지 않았습니다. 먼저 릴리스 게이트를 최종 점검하세요.";
export const ADMIN_REVIEW_STATE_READY_TITLE = "승인 가능";
export const ADMIN_REVIEW_STATE_READY_BODY =
  "검수 요청이 접수되었습니다. 승인하면 Capability 기준으로 카탈로그·다운로드·API가 공개됩니다.";
export const ADMIN_REVIEW_STATE_WARNING_TITLE = "주의 후 승인 가능";
export const ADMIN_REVIEW_STATE_WARNING_BODY = "";
export const ADMIN_REVIEW_STATE_BLOCKED_TITLE = "승인 불가";
export const ADMIN_REVIEW_STATE_BLOCKED_BODY =
  "최신 점검 결과 기준으로 차단 이슈가 있습니다. 반려 사유를 작성해 제공자에게 보완을 요청하세요.";
export const ADMIN_REVIEW_STATE_PUBLISHED_TITLE = "이미 공개됨";
export const ADMIN_REVIEW_STATE_PUBLISHED_BODY = "이 지식팩은 이미 승인·공개된 상태입니다.";
export const ADMIN_REVIEW_STATE_NOT_REVIEWING_TITLE = "검수 대기 상태가 아님";
export const ADMIN_REVIEW_STATE_NOT_REVIEWING_BODY =
  "현재 상태가 REVIEWING이 아니어서 승인/반려를 진행할 수 없습니다.";
export const ADMIN_REVIEW_STATE_REFRESH_REQUIRED_TITLE = "제출 데이터 확인 필요";
export const ADMIN_REVIEW_STATE_REFRESH_REQUIRED_BODY =
  "원천 문서 또는 점검 데이터가 변경되어 현재 결과만으로는 승인 여부를 판단하기 어렵습니다. 제출 패키지와 주의 항목을 확인하거나 제공자에게 재제출을 요청하세요.";
export const ADMIN_REVIEW_STATE_CHANGED_TITLE = "제출 후 변경 감지";
export const ADMIN_REVIEW_STATE_CHANGED_BODY =
  "제출 당시 검수 패키지와 현재 데이터가 다릅니다. 관리자는 기존 제출 패키지 기준으로 판단하거나 제공자에게 재제출을 요청할 수 있습니다.";

export const ADMIN_REVIEW_CTA_RELEASE_GATE = "릴리스 게이트 재점검";
export const ADMIN_REVIEW_CTA_APPROVE = "승인 및 공개";
export const ADMIN_REVIEW_CTA_REJECT = "반려";
export const ADMIN_REVIEW_CTA_REFRESH_ALL = "현재 데이터 기준 전체 재점검";
export const ADMIN_REVIEW_CTA_RETRIEVAL_REEVAL = "검색 품질 재평가";
export const ADMIN_REVIEW_ADVANCED_ACTIONS_TITLE = "고급 작업";
export const ADMIN_REVIEW_SUBMIT_SNAPSHOT_TITLE = "제출된 검수 패키지";
export const ADMIN_REVIEW_CTA_STRUCTURE = "구조/품질 재점검";
export const ADMIN_REVIEW_CTA_CHUNK = "청킹 품질 재점검";
export const ADMIN_REVIEW_CTA_RETRIEVAL_GENERATE = "검색 평가 케이스 재생성";
export const ADMIN_REVIEW_CTA_RETRIEVAL_RUN = "검색 품질 재점검";
export const ADMIN_REVIEW_REFRESH_REASONS_TITLE = "재점검 필요 항목";
export const ADMIN_REVIEW_REJECT_COLLAPSED_HINT =
  "재점검 후에도 문제가 해결되지 않으면 반려할 수 있습니다.";
export const ADMIN_REVIEW_REJECT_OPEN = "반려 사유 입력 열기";
export const ADMIN_REVIEW_VIEW_SOURCE = "원문 보기";
export const ADMIN_REVIEW_VIEW_VALIDATION = "검증 결과 보기";

export const PROVIDER_PACK_ID_READONLY_HINT =
  "JYKStore가 발급한 고유 식별자입니다. 수정할 수 없습니다.";
/** @deprecated Removed from basic-info UI — kept for source/compat checks */
export const PROVIDER_PACK_AUTO_SUMMARY_LABEL = "자동 생성 요약";
/** @deprecated Removed from basic-info UI — kept for source/compat checks */
export const PROVIDER_PACK_ADVANCED_SUMMARY_EDIT = "고급 요약 수정";

export const PROVIDER_PACK_SHORT_SUMMARY_LABEL = "한 줄 요약";
export const PROVIDER_PACK_SHORT_SUMMARY_HINT =
  "지식팩의 핵심 용도와 제공 내용을 한두 문장으로 작성해 주세요.";
export const PROVIDER_PACK_SHORT_SUMMARY_DRAFT_HINT =
  "등록 자료를 기반으로 작성된 초안일 수 있습니다. 공개 전에 내용을 확인해 주세요.";
export const PROVIDER_PACK_DESCRIPTION_HINT =
  "이 지식팩이 어떤 사용자를 위해 어떤 정보를 제공하는지 작성해 주세요.";
export const PROVIDER_PACK_VERSION_CHANGELOG_LABEL_PREFIX = "버전 변경사항";
export const PROVIDER_PACK_SAVE_DRAFT = "임시 저장";
export const PROVIDER_PACK_SAVE_AND_GO_PAYLOAD = "저장 후 자료 등록";
export const PROVIDER_PACK_SAVE_DRAFT_SUCCESS = "기본정보를 저장했습니다.";

export const PROVIDER_PACK_DRAFT_EMPTY_SOURCES =
  "등록된 원천 자료가 없습니다. 자료 등록 탭에서 외부 생성 도구 결과물을 등록하세요.";
export const PROVIDER_GITHUB_ADVANCED_SETTINGS_EXPAND = "고급 설정 펼치기";

export const PROVIDER_PACK_SOURCE_STEP_TITLE = "등록된 자료를 확인하세요.";
export const PROVIDER_PACK_SOURCE_METHOD_GITHUB = "GitHub에서 가져오기";
export const PROVIDER_PACK_SOURCE_METHOD_GITHUB_BADGE = "종료됨";
export const PROVIDER_PACK_SOURCE_METHOD_MANUAL = "문서 직접 등록";

export const PROVIDER_GITHUB_PANEL_TITLE = "GitHub에서 가져오기";
export const PROVIDER_GITHUB_ADVANCED_SETTINGS = "고급 설정";
export const PROVIDER_GITHUB_LABEL_CRAWL_MODE = "수집 범위";
export const PROVIDER_GITHUB_LABEL_SOURCE_ANALYSIS = "소스 분석 방식";
export const PROVIDER_GITHUB_LABEL_MAX_CANDIDATES = "분석 후보 파일 수";
export const PROVIDER_GITHUB_LABEL_MAX_FETCH = "가져올 문서 수";
export const PROVIDER_GITHUB_LABEL_GENERATION_MODE = "초안 생성 범위";
export const PROVIDER_GITHUB_LABEL_OVERWRITE_DRAFTS = "기존 초안 덮어쓰기";

export const PROVIDER_PACK_BASIC_INFO_SUMMARY = "기본정보 수정";
export const PROVIDER_PACK_PRE_REVIEW_CHECKS_SUMMARY = "검수 전 점검";

export const PROVIDER_PACK_DRAFT_STEP_INTRO =
  "내부 참조지식 생성 기능은 종료되었습니다.";
export const PROVIDER_PACK_DRAFT_GENERATE_CTA = "Knowledge Unit 후보 생성";
export const PROVIDER_PACK_DRAFT_GENERATING =
  "지식팩 초안과 기본 점검을 준비하는 중…";
export const PROVIDER_PACK_DRAFT_GENERATE_DONE =
  "내부 생성 기능은 종료되었습니다.";
export const PROVIDER_PACK_DRAFT_VIEW_LIST = "초안 목록 보기";
export const PROVIDER_PACK_REVIEW_SUBMIT_CTA = "검수 요청 제출";
export const PROVIDER_PACK_INSPECTION_AUTO_TITLE = "점검 결과";
export const PROVIDER_PACK_REVIEW_PREREQ_TITLE = "검수 요청 전 필요한 작업";
export const PROVIDER_PACK_REVIEW_INCOMPLETE_TITLE = "검수 요청 불가";
export const PROVIDER_PACK_REVIEW_INCOMPLETE_BODY =
  "필수 검수 데이터가 부족합니다. 기존 자료를 확인하거나 관리자에게 문의하세요.";
export const PROVIDER_PACK_GO_TO_INSPECTION_REPAIR = "기존 자료 확인";

export const PROVIDER_KU_DRAFT_PANEL_TITLE = "자동 추출 결과";
export const PROVIDER_KU_CANDIDATE_LABEL = "Knowledge Unit 후보";
export const PROVIDER_KU_EVIDENCE_DRAFT_RESULT = "초안 생성 결과";
export const PROVIDER_KU_LOAD_FAILED = "자동 추출 결과를 불러오지 못했습니다.";
export const PROVIDER_KU_REGENERATE_FAILED = "자동 추출 재생성에 실패했습니다.";
export const PROVIDER_KU_EMPTY_LIST = "표시할 자동 추출 결과가 없습니다.";
export const PROVIDER_KU_PROCESSING_TITLE = "원천 문서 처리 현황";
export const PROVIDER_KU_PROCESSING_DETAIL_TOGGLE = "상세 보기";
export const PROVIDER_KU_STATUS_GENERATED = "Unit 생성 완료";
export const PROVIDER_KU_STATUS_DUPLICATE = "중복 제외";
export const PROVIDER_KU_STATUS_EXCLUDED = "생성 제외";
export const PROVIDER_KU_STATUS_UNSUPPORTED = "지원 제외";
export const PROVIDER_KU_STATUS_FAILED = "처리 실패";
export const PROVIDER_KU_PREVIEW_GENERATION_BADGE = "미리보기 생성";
export const PROVIDER_KU_REVIEW_GUIDANCE =
  "아래 Knowledge Unit 후보를 검토하세요. 문제가 없으면 점검 단계로 이동할 수 있습니다. 수정이 필요한 후보는 내용 보기와 근거 보기를 확인한 뒤 보완하세요.";
export const PROVIDER_KU_EXCLUDED_GUIDANCE =
  "생성 제외·지원 제외 문서는 지식팩 품질을 위해 자동으로 건너뛴 자료입니다.";
export const PROVIDER_KU_RESET_BUTTON = "Knowledge Unit 후보 초기화";
export const PROVIDER_KU_REGENERATE_BUTTON = "자동 추출 재생성";
export const PROVIDER_KU_RESET_CONFIRM =
  "시스템이 생성한 Knowledge Unit 초안을 초기화합니다. 검토 대기/대체됨 상태의 자동 생성 초안과 생성 리포트가 삭제됩니다. 원천 문서는 삭제되지 않습니다. 초기화 후 다시 자동 추출을 실행할 수 있습니다.";
export const PROVIDER_KU_RESET_SUCCESS = "초기화 완료. Knowledge Unit 후보를 다시 생성하세요.";
export const PROVIDER_KU_DUPLICATE_CARD_HINT =
  "유사한 Knowledge Unit이 감지되었습니다. 대표 Unit으로 병합되었는지 확인하세요.";
export const PROVIDER_KU_REVIEW_STATUS_PENDING = "검토 대기";
export const PROVIDER_KU_CONTENT_VIEW = "내용 보기";
export const PROVIDER_KU_EVIDENCE_VIEW = "근거 보기";

export const PROVIDER_REVIEW_READONLY_HINT =
  "관리자가 지식팩 품질과 공개 여부를 검토하고 있습니다. 승인 전까지 일반 카탈로그와 Context API에는 노출되지 않습니다.";

export const PROVIDER_SUBMIT_READINESS_TITLE = "검수 요청 준비";
export const PROVIDER_SUBMIT_PROVIDER_TASKS_TITLE = "제공자가 해야 할 일";
export const PROVIDER_SUBMIT_ADMIN_TASKS_TITLE = "검수 제출 후 관리자 확인 항목";
export const PROVIDER_SUBMIT_ADMIN_REVIEW_NOTICE =
  "제공자는 기존 자료와 검수 상태를 확인하고 검수 요청을 제출합니다. 관리자는 검수 단계에서 최종 공개 여부를 판단합니다.";

/** @deprecated Use ProviderOnboardingStepper instead of numbered list on provider page */
export const PROVIDER_CENTER_ONBOARDING_STEPS = [
  "기본정보",
  "자료 등록",
  "유통정보",
  "검수 요청",
  "승인·공개",
] as const;

export const PROVIDER_PROFILE_FOOTER_HINT =
  "표시명·소개는 상단 프로필에서 언제든 수정할 수 있습니다.";

export const PROVIDER_PROFILE_MENU_LABEL = "제공자 정보";
export const PROVIDER_PROFILE_EDIT_TITLE = "제공자 정보 수정";
export const PROVIDER_PROFILE_SAVE_CTA = "저장";
export const PROVIDER_PROFILE_SAVE_SUCCESS = "제공자 정보를 저장했습니다.";
export const PROVIDER_ACCOUNT_MENU_LABEL = "계정 정보";

export const PROVIDER_PACK_STATUS_UX: Record<string, string> = {
  DRAFT: "초안",
  REVIEWING: "검토 요청됨",
  PUBLISHED: "공개됨",
  VERIFIED: "검수 승인됨",
};
