/**
 * LANBridge 공통 설정
 * 서버 포트, API 엔드포인트 등을 중앙에서 관리
 */

// 브라우저 환경에서도 사용 가능하도록 조건부 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ADMIN_PORT: 9000,
    SIGNAL_PORT: 3000,
    
    // API 엔드포인트
    API_ENDPOINTS: {
      HEALTH: '/health',
      ROOMS: '/api/rooms',
      ROOM_CREATE: '/api/room/create',
      ROOM_OFFER: '/api/room/:roomId/offer',
      ROOM_ANSWER: '/api/room/:roomId/answer',
      ROOM_JOIN: '/api/room/:roomId/join',
      ROOM_DELETE: '/api/room/:roomId',
      ROOM_INFO: '/api/room/:roomId'
    },
    
    // 제약 사항
    CONSTRAINTS: {
      MAX_ROOM_LIFETIME: 3600000, // 1시간
      CLEANUP_INTERVAL: 600000,   // 10분
      OFFER_TIMEOUT: 120000,      // 2분
      ICE_TIMEOUT: 10000          // 10초
    }
  };
}
