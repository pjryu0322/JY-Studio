/**
 * LANBridge Signaling Client
 * 시그널링 서버와의 통신을 담당하는 모듈
 */

class SignalingClient {
  /**
   * @param {string} serverAddr - 시그널링 서버 주소 (host:port)
   */
  constructor(serverAddr) {
    this.serverAddr = serverAddr;
    // 현재 페이지의 protocol을 따름 (HTTPS/HTTP 자동 감지)
    this.protocol = (typeof window !== 'undefined' && window.location.protocol) || 'https:';
  }

  /**
   * 서버 URL 생성
   * @param {string} path - API 경로
   * @returns {string} 완전한 URL
   */
  _buildUrl(path) {
    return `${this.protocol}//${this.serverAddr}${path}`;
  }

  /**
   * 서버 연결 테스트
   * @returns {Promise<boolean>}
   * @throws {Error} 서버 연결 실패
   */
  async testConnection() {
    try {
      const response = await fetch(this._buildUrl('/health'), { 
        timeout: 5000 
      });
      
      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Signaling] ✅ 서버 연결 성공:', data.message);
      return true;
    } catch (error) {
      console.error('[Signaling] ❌ 서버 연결 실패:', error.message);
      throw new Error(`시그널링 서버 연결 실패: ${error.message}`);
    }
  }

  /**
   * 방 생성
   * @param {string} hostName - 공유자 이름
   * @param {string} roomTitle - 방 제목
   * @param {number} maxParticipants - 최대 참여자 수
   * @returns {Promise<{roomId: string, expiresIn: number}>}
   * @throws {Error} 방 생성 실패
   */
  async createRoom(hostName, roomTitle, maxParticipants = 4) {
    try {
      console.log('[Signaling] 방 생성 요청:', { hostName, roomTitle, maxParticipants });
      
      const response = await fetch(this._buildUrl('/api/room/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName, roomTitle, maxParticipants })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '방 생성 실패');
      }

      console.log('[Signaling] ✅ 방 생성 성공:', data.roomId);
      return { roomId: data.roomId, expiresIn: data.expiresIn };
      
    } catch (error) {
      console.error('[Signaling] ❌ 방 생성 실패:', error.message);
      throw new Error(`방 생성 실패: ${error.message}`);
    }
  }

  /**
   * Offer 저장
   * @param {string} roomId - 방 ID
   * @param {object} offer - SDP Offer
   * @returns {Promise<void>}
   * @throws {Error} Offer 저장 실패
   */
  async saveOffer(roomId, offer) {
    try {
      console.log('[Signaling] Offer 저장 요청:', roomId);
      
      const response = await fetch(this._buildUrl(`/api/room/${roomId}/offer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Offer 저장 실패');
      }

      console.log('[Signaling] ✅ Offer 저장 성공');
      
    } catch (error) {
      console.error('[Signaling] ❌ Offer 저장 실패:', error.message);
      throw new Error(`Offer 저장 실패: ${error.message}`);
    }
  }

  /**
   * Offer 조회
   * @param {string} roomId - 방 ID
   * @returns {Promise<object>} SDP Offer
   * @throws {Error} Offer 조회 실패
   */
  async getOffer(roomId) {
    try {
      console.log('[Signaling] Offer 조회 요청:', roomId);
      
      const response = await fetch(this._buildUrl(`/api/room/${roomId}/offer`));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.offer) {
        throw new Error(data.error || 'Offer를 찾을 수 없습니다');
      }

      console.log('[Signaling] ✅ Offer 조회 성공');
      return data.offer;
      
    } catch (error) {
      console.error('[Signaling] ❌ Offer 조회 실패:', error.message);
      throw new Error(`Offer 조회 실패: ${error.message}`);
    }
  }

  /**
   * Answer 저장
   * @param {string} roomId - 방 ID
   * @param {object} answer - SDP Answer
   * @param {string} participantName - 참여자 이름
   * @returns {Promise<void>}
   * @throws {Error} Answer 저장 실패
   */
  async saveAnswer(roomId, answer, participantName) {
    try {
      console.log('[Signaling] Answer 저장 요청:', roomId, participantName);
      
      const response = await fetch(this._buildUrl(`/api/room/${roomId}/answer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          answer,
          participantName 
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Answer 저장 실패');
      }

      console.log('[Signaling] ✅ Answer 저장 성공');
      
    } catch (error) {
      console.error('[Signaling] ❌ Answer 저장 실패:', error.message);
      throw new Error(`Answer 저장 실패: ${error.message}`);
    }
  }

  /**
   * Answer 조회 (폴링)
   * @param {string} roomId - 방 ID
   * @param {number} maxAttempts - 최대 시도 횟수 (기본: 600)
   * @param {number} intervalMs - 폴링 간격 (기본: 500ms)
   * @returns {Promise<object|null>} SDP Answer 또는 null
   */
  async waitForAnswer(roomId, maxAttempts = 600, intervalMs = 500) {
    console.log('[Signaling] Answer 대기 시작 (최대 5분)...');
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(this._buildUrl(`/api/room/${roomId}/answer`));
        
        if (!response.ok) {
          if (response.status === 404) {
            console.error('[Signaling] ❌ 방을 찾을 수 없음:', roomId);
            throw new Error('방을 찾을 수 없습니다');
          }
          // 다른 오류는 재시도
          await new Promise(r => setTimeout(r, intervalMs));
          continue;
        }
        
        const data = await response.json();
        
        if (data.success && data.answer) {
          console.log('[Signaling] ✅ Answer 수신 성공!');
          return data.answer;
        }
        
        // waiting 상태면 계속 대기
        if (data.waiting) {
          await new Promise(r => setTimeout(r, intervalMs));
          continue;
        }
        
      } catch (error) {
        console.error('[Signaling] Answer 조회 중 오류:', error.message);
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }
    
    console.warn('[Signaling] ⚠️ Answer 타임아웃 (5분)');
    return null;
  }

  /**
   * 활성 방 목록 조회
   * @returns {Promise<Array>} 방 목록
   * @throws {Error} 조회 실패
   */
  async getRooms() {
    try {
      console.log('[Signaling] 방 목록 조회 요청');
      
      const response = await fetch(this._buildUrl('/api/rooms'));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '방 목록 조회 실패');
      }

      console.log('[Signaling] ✅ 방 목록 조회 성공:', data.rooms.length, '개');
      return data.rooms || [];
      
    } catch (error) {
      console.error('[Signaling] ❌ 방 목록 조회 실패:', error.message);
      throw new Error(`방 목록 조회 실패: ${error.message}`);
    }
  }

  /**
   * 참여자 등록
   * @param {string} roomId - 방 ID
   * @param {string} participantName - 참여자 이름
   * @returns {Promise<{participantCount: number}>}
   * @throws {Error} 등록 실패
   */
  async joinRoom(roomId, participantName) {
    try {
      console.log('[Signaling] 참여자 등록 요청:', roomId, participantName);
      
      const response = await fetch(this._buildUrl(`/api/room/${roomId}/join`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantName })
      });

      if (!response.ok) {
        const data = await response.json();
        
        if (data.code === 'DUPLICATE_NAME') {
          throw new Error('이미 사용 중인 이름입니다');
        } else if (data.code === 'ROOM_FULL') {
          throw new Error(`방이 가득 찼습니다 (${data.currentParticipants}/${data.maxParticipants})`);
        }
        
        throw new Error(data.error || '참여자 등록 실패');
      }

      const data = await response.json();
      console.log('[Signaling] ✅ 참여자 등록 성공');
      return { participantCount: data.participantCount };
      
    } catch (error) {
      console.error('[Signaling] ❌ 참여자 등록 실패:', error.message);
      throw error;
    }
  }

  /**
   * 참여자 제거 (호스트가 호출)
   * @param {string} roomId - 방 ID
   * @param {string} participantName - 참여자 이름
   * @returns {Promise<void>}
   */
  async removeParticipant(roomId, participantName) {
    try {
      await fetch(this._buildUrl(`/api/room/${roomId}/participant/${encodeURIComponent(participantName)}`), {
        method: 'DELETE'
      });
      console.log(`[Signaling] ✅ 참여자 제거: ${participantName}`);
    } catch (err) {
      console.warn(`[Signaling] 참여자 제거 실패:`, err.message);
    }
  }

  /**
   * 방 삭제
   * @param {string} roomId - 방 ID
   * @param {boolean} isKeepalive - keepalive 사용 여부
   * @returns {Promise<void>}
   */
  async deleteRoom(roomId, isKeepalive = false) {
    try {
      console.log('[Signaling] 방 삭제 요청:', roomId);
      
      const response = await fetch(this._buildUrl(`/api/room/${roomId}`), {
        method: 'DELETE',
        keepalive: Boolean(isKeepalive)
      });

      if (response.ok) {
        console.log('[Signaling] ✅ 방 삭제 성공');
      } else {
        console.warn('[Signaling] ⚠️ 방 삭제 실패:', response.status);
      }
      
    } catch (error) {
      console.error('[Signaling] ❌ 방 삭제 중 오류:', error.message);
    }
  }

  /**
   * 방 상태 유지 (heartbeat)
   * @param {string} roomId - 방 ID
   * @returns {Promise<void>}
   */
  async pingRoom(roomId) {
    try {
      await fetch(this._buildUrl(`/api/room/${roomId}/ping`), {
        method: 'POST',
        keepalive: true
      });
    } catch (error) {
      // 무시 (heartbeat 실패는 치명적이지 않음)
    }
  }

  /**
   * 방 정보 조회
   * @param {string} roomId - 방 ID
   * @returns {Promise<object>} 방 정보
   * @throws {Error} 조회 실패
   */
  async getRoomInfo(roomId) {
    try {
      const response = await fetch(this._buildUrl(`/api/room/${roomId}`));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '방 정보 조회 실패');
      }

      return data.room;
      
    } catch (error) {
      console.error('[Signaling] ❌ 방 정보 조회 실패:', error.message);
      throw new Error(`방 정보 조회 실패: ${error.message}`);
    }
  }

  // ============================================
  // Per-participant 시그널링 (다중 피어 지원)
  // ============================================

  /**
   * 대기 중인 참여자 목록 조회 (호스트 폴링용)
   * @param {string} roomId
   * @returns {Promise<string[]>} 대기 참여자 이름 배열
   */
  async getPendingParticipants(roomId) {
    try {
      const response = await fetch(this._buildUrl(`/api/room/${roomId}/pending`));
      if (!response.ok) return [];
      const data = await response.json();
      return data.success ? (data.pending || []) : [];
    } catch {
      return [];
    }
  }

  /**
   * 특정 참여자용 Offer 저장 (호스트가 호출)
   * @param {string} roomId
   * @param {string} participantName
   * @param {object} offer - SDP Offer
   */
  async savePeerOffer(roomId, participantName, offer) {
    const response = await fetch(this._buildUrl(`/api/room/${roomId}/peer/${encodeURIComponent(participantName)}/offer`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer })
    });
    if (!response.ok) throw new Error('Peer Offer 저장 실패');
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Peer Offer 저장 실패');
  }

  /**
   * 자기 전용 Offer 대기 (참여자가 호출, 폴링)
   * @param {string} roomId
   * @param {string} participantName
   * @param {number} maxAttempts - 최대 시도 (기본 120 = 60초)
   * @param {number} intervalMs - 폴링 간격 (기본 500ms)
   * @returns {Promise<object>} SDP Offer
   */
  async waitForPeerOffer(roomId, participantName, maxAttempts = 120, intervalMs = 500) {
    console.log(`[Signaling] ${participantName} 전용 Offer 대기 중...`);
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(this._buildUrl(`/api/room/${roomId}/peer/${encodeURIComponent(participantName)}/offer`));
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.offer) {
            console.log('[Signaling] ✅ Peer Offer 수신');
            return data.offer;
          }
        }
      } catch {}
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('Offer 대기 시간 초과 (60초)');
  }

  /**
   * 참여자 Answer 저장
   * @param {string} roomId
   * @param {string} participantName
   * @param {object} answer - SDP Answer
   */
  async savePeerAnswer(roomId, participantName, answer) {
    const response = await fetch(this._buildUrl(`/api/room/${roomId}/peer/${encodeURIComponent(participantName)}/answer`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer })
    });
    if (!response.ok) throw new Error('Peer Answer 저장 실패');
  }

  /**
   * 특정 참여자의 Answer 대기 (호스트가 호출, 폴링)
   * @param {string} roomId
   * @param {string} participantName
   * @param {number} maxAttempts
   * @param {number} intervalMs
   * @returns {Promise<object|null>}
   */
  async waitForPeerAnswer(roomId, participantName, maxAttempts = 120, intervalMs = 500) {
    console.log(`[Signaling] ${participantName} Answer 대기 중...`);
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(this._buildUrl(`/api/room/${roomId}/peer/${encodeURIComponent(participantName)}/answer`));
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.answer) {
            console.log(`[Signaling] ✅ ${participantName} Answer 수신`);
            return data.answer;
          }
        }
      } catch {}
      await new Promise(r => setTimeout(r, intervalMs));
    }
    console.warn(`[Signaling] ${participantName} Answer 타임아웃`);
    return null;
  }
}

// 전역 노출 (브라우저 환경)
if (typeof window !== 'undefined') {
  window.SignalingClient = SignalingClient;
}

// Node.js 환경 지원
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SignalingClient;
}
