/** 자동 초안 API 중복 호출 방지 (동시에 하나만) */
export const specAutoDraftInFlightByProject = new Map<string, boolean>();

/** 자동 초안이 이미 성공한 프로젝트 (DB 저장 전에도 서버 스냅샷이 비어 재실행되는 것 방지) */
export const specAutoDraftSucceededByProject = new Map<string, boolean>();
