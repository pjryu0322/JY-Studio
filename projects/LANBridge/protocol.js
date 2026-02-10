/**
 * LANBridge 프로토콜 헬퍼 (Deprecated)
 * Note: 현재 사용하지 않음. 추후 제거 예정.
 */
class Protocol {
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `S_${timestamp}_${random}`;
  }

  generatePeerId() {
    const random = Math.random().toString(36).substring(2, 14).toUpperCase();
    return `P_${random}`;
  }
}
