/**
 * LANBridge 메인 앱
 * 역할: 공유자 / 참여자 / 관리자
 */

class LANBridge {
  constructor() {
    this.connection = null;
    this.role = null; // 'host' | 'join'
    this.serverAddr = null;
    this.roomId = null;
    this.hostName = null;
    this.hostRooms = new Map();
    this.activeRoomId = null;
    this._beforeUnloadHandler = null;
    this.screenStream = null;
    this.screenRoomId = null;
    this.screenSharePolicy = 'stop';
    this.signaling = null; // SignalingClient 인스턴스
  }

  // ============================================
  // 공유자 모드
  // ============================================
  /**
   * 공유자로 시작 (방 생성 및 Offer 준비)
   * @param {string} hostName - 공유자 이름
   * @param {string} serverAddr - 신호 서버 주소
   * @param {string} roomTitle - 방 제목
   * @param {number} maxParticipants - 최대 참여자 수 (기본값: 4)
   * @throws {Error} 방 생성 실패
   */
  async startAsHost(hostName, serverAddr, roomTitle, maxParticipants = 4) {
    console.log('[App] 공유자 시작:', hostName, 'at', serverAddr, '최대인원:', maxParticipants);
    this.role = 'host';
    this.hostName = hostName;
    this.roomTitle = roomTitle;
    this.maxParticipants = maxParticipants;
    this.serverAddr = serverAddr;

    try {
      // SignalingClient 생성
      this.signaling = new SignalingClient(serverAddr);
      
      // 서버 연결 테스트
      await this.signaling.testConnection();

      // 방 생성
      const { roomId } = await this.signaling.createRoom(hostName, roomTitle, maxParticipants);
      console.log('[App] 방 생성됨:', roomId);

      // 다중 피어 연결 매니저 생성 (아직 PeerConnection 없음)
      const connection = new HostConnection(this, roomId);

      const roomInfo = {
        roomId,
        roomTitle,
        hostName,
        serverAddr,
        connection,
        signaling: this.signaling,
        heartbeatTimer: null,
        pendingPollTimer: null,
        closed: false
      };

      this.hostRooms.set(roomId, roomInfo);
      this.activeRoomId = roomId;
      this.roomId = roomId;
      this.connection = connection;

      this._startHostHeartbeat(roomId);

      // 참여자 대기 폴링 시작 (새 참여자 자동 연결)
      this._startPendingParticipantPolling(roomId);

      if (typeof window !== 'undefined') {
        this._beforeUnloadHandler = () => {
          this._closeAllRooms(true);
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
      }

      return { roomId };

    } catch (error) {
      console.error('[App] 공유자 시작 실패:', error.message);
      throw error;
    }
  }

  /**
   * 대기 참여자 폴링 시작
   * @private
   */
  _startPendingParticipantPolling(roomId) {
    const roomInfo = this.hostRooms.get(roomId);
    if (!roomInfo) return;

    // 이미 처리를 시작한 참여자 이름 추적 (서버 pending와 별도 관리)
    const processed = new Set();
    // 순차 연결 큐 (동시 연결로 인한 경합 조건 방지)
    const connectionQueue = [];
    let isConnecting = false;
    const self = this;

    const processNext = async () => {
      if (isConnecting || connectionQueue.length === 0 || roomInfo.closed) return;
      isConnecting = true;
      const name = connectionQueue.shift();

      try {
        await self._connectPendingParticipant(roomId, name);
        console.log(`[App] ✅ ${name} 연결 성공 (대기열 ${connectionQueue.length}명 남음)`);
      } catch (err) {
        console.error(`[App] ❌ ${name} 연결 실패:`, err.message);
        // 실패 시 processed에서 제거하여 재시도 가능
        processed.delete(name);
        // 실패한 피어 정보도 정리
        roomInfo.connection.peers.delete(name);
        // 서버에서 참여자 제거 (빈 슬롯 복구)
        roomInfo.signaling?.removeParticipant(roomId, name).catch(() => {});
      }

      isConnecting = false;
      // 다음 대기 참여자 처리
      processNext();
    };

    const poll = async () => {
      if (roomInfo.closed) return;

      try {
        const pending = await roomInfo.signaling.getPendingParticipants(roomId);
        for (const name of pending) {
          // 이미 연결 완료된 피어 또는 처리 중인 참여자 건너뛰기
          if (processed.has(name)) continue;
          // DataChannel이 열린 피어는 이미 연결 완료
          const existingPeer = roomInfo.connection.peers.get(name);
          if (existingPeer?.dataChannel?.readyState === 'open') continue;

          processed.add(name);
          connectionQueue.push(name);
          console.log(`[App] 새 참여자 발견: ${name} (대기열: ${connectionQueue.length})`);
        }
        // 큐 처리 시작 (이미 처리 중이면 무시)
        processNext();
      } catch (err) {
        // 폴링 오류 무시
      }

      if (!roomInfo.closed) {
        roomInfo.pendingPollTimer = setTimeout(poll, 1500);
      }
    };

    poll();
  }

  /**
   * 대기 참여자에 대해 PeerConnection 생성 + Offer/Answer 교환
   * @private
   */
  async _connectPendingParticipant(roomId, participantName) {
    const roomInfo = this.hostRooms.get(roomId);
    if (!roomInfo || roomInfo.closed) return;

    console.log(`[App] 참여자 연결 시작: ${participantName}`);

    // 기존 실패한 피어 정리
    const oldPeer = roomInfo.connection.peers.get(participantName);
    if (oldPeer) {
      console.log(`[App] ${participantName} 기존 피어 정리 (PC state: ${oldPeer.pc?.connectionState}, DC state: ${oldPeer.dataChannel?.readyState})`);
      try { oldPeer.pc?.close(); } catch {}  
      roomInfo.connection.peers.delete(participantName);
    }

    // 참여자용 Offer 생성
    const offer = await roomInfo.connection.createOfferForPeer(participantName);
    console.log(`[App] ${participantName} Offer 생성 완료 (SDP length: ${offer?.sdp?.length || 0})`);

    // 서버에 Offer 저장 (기존 Answer도 자동 삭제됨)
    await roomInfo.signaling.savePeerOffer(roomId, participantName, offer);
    console.log(`[App] ${participantName} Offer 서버에 저장`);

    // 참여자 Answer 대기 (최대 60초)
    const answer = await roomInfo.signaling.waitForPeerAnswer(roomId, participantName);
    if (!answer) {
      throw new Error(`${participantName} Answer 타임아웃`);
    }
    console.log(`[App] ${participantName} Answer 수신 (SDP length: ${answer?.sdp?.length || 0})`);

    // Answer 적용
    await roomInfo.connection.applyAnswerForPeer(participantName, answer);

    // DataChannel open 이벤트 기반 대기 (최대 30초)
    const peer = roomInfo.connection.peers.get(participantName);
    if (!peer) throw new Error(`${participantName} 피어를 찾을 수 없음`);

    await new Promise((resolve, reject) => {
      const dc = peer.dataChannel;
      // 이미 열려있으면 즉시 성공
      if (dc?.readyState === 'open') {
        console.log(`[App] ✅ ${participantName} DC 이미 open!`);
        return resolve();
      }

      let settled = false;
      const cleanup = () => {
        if (dc) dc.removeEventListener('open', onOpen);
        if (peer.pc) peer.pc.removeEventListener('iceconnectionstatechange', onIceFail);
        clearTimeout(timer);
      };

      const onOpen = () => {
        if (settled) return;
        settled = true;
        cleanup();
        console.log(`[App] ✅ ${participantName} P2P 연결 성공! (DC: open, PC: ${peer.pc?.connectionState})`);
        resolve();
      };

      const onIceFail = () => {
        if (settled) return;
        if (peer.pc?.iceConnectionState === 'failed') {
          settled = true;
          cleanup();
          reject(new Error(`${participantName} ICE 연결 실패`));
        }
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        console.warn(`[App] ${participantName} P2P 타임아웃 (PC: ${peer.pc?.connectionState}, ICE: ${peer.pc?.iceConnectionState}, DC: ${dc?.readyState})`);
        reject(new Error(`${participantName} P2P 연결 확인 타임아웃`));
      }, 30000);

      if (dc) dc.addEventListener('open', onOpen);
      if (peer.pc) peer.pc.addEventListener('iceconnectionstatechange', onIceFail);
    });
  }

  /**
   * 대기 참여자 폴링 중지
   * @private
   */
  _stopPendingParticipantPolling(roomId) {
    const roomInfo = this.hostRooms.get(roomId);
    if (roomInfo?.pendingPollTimer) {
      clearTimeout(roomInfo.pendingPollTimer);
      roomInfo.pendingPollTimer = null;
    }
  }

  // ============================================
  // 참여자 모드
  // ============================================
  /**
   * 활성 방 목록 검색
   * @param {string} serverAddr - 신호 서버 주소
   * @returns {Promise<array>} 방 목록
   * @throws {Error} 서버 연결 실패
   */
  async searchRooms(serverAddr) {
    console.log('[App] 방 검색:', serverAddr);
    this.role = 'join';
    this.serverAddr = serverAddr;

    try {
      // SignalingClient 생성
      this.signaling = new SignalingClient(serverAddr);
      
      await this.signaling.testConnection();
      const rooms = await this.signaling.getRooms();
      
      return rooms;
    } catch (error) {
      throw new Error('신호 서버 연결 실패: ' + error.message);
    }
  }

  /**
   * 방 입장 (Answer 생성 및 전송)
   * @param {string} roomId - 방 ID
   * @param {string} serverAddr - 신호 서버 주소
   * @param {string} participantName - 참여자 이름
   * @throws {Error} 방 입장 실패
   */
  async joinRoom(roomId, serverAddr, participantName) {
    console.log('[App] 방 입장:', roomId, participantName);
    this.role = 'join';
    this.serverAddr = serverAddr;
    this.roomId = roomId;
    this.participantName = participantName;

    // SignalingClient 생성 (아직 없으면)
    if (!this.signaling) {
      this.signaling = new SignalingClient(serverAddr);
    }

    // 참여자 등록 (대기열에 추가됨)
    try {
      await this.signaling.joinRoom(roomId, participantName);
    } catch (error) {
      console.warn('[App] 참여자 등록 실패:', error.message);
      throw error;
    }

    // 호스트가 만든 참여자 전용 Offer 대기 (폴링)
    console.log('[App] 호스트의 Offer 대기 중...');
    const offer = await this.signaling.waitForPeerOffer(roomId, participantName);

    // WebRTC 연결 시작
    this.connection = new JoinConnection(this, roomId);
    
    try {
      // Answer 생성
      const answer = await this.connection.start(offer);

      // Answer 전송 (참여자 전용 경로)
      await this.signaling.savePeerAnswer(roomId, participantName, answer);

      console.log('[App] ✅ 방에 입장했습니다');
    } catch (error) {
      console.error('[App] 방 입장 실패:', error.message);
      throw error;
    }
  }

  _startHostHeartbeat(roomId) {
    const roomInfo = this.hostRooms.get(roomId);
    if (!roomInfo || roomInfo.heartbeatTimer) return;

    roomInfo.heartbeatTimer = setInterval(() => {
      if (roomInfo.signaling) {
        roomInfo.signaling.pingRoom(roomId).catch(() => {});
      }
    }, 15000);
  }

  _stopHostHeartbeat(roomId) {
    const roomInfo = this.hostRooms.get(roomId);
    if (roomInfo?.heartbeatTimer) {
      clearInterval(roomInfo.heartbeatTimer);
      roomInfo.heartbeatTimer = null;
    }
  }

  async _closeRoom(roomId, isKeepalive) {
    const roomInfo = this.hostRooms.get(roomId);
    if (!roomInfo || roomInfo.closed) return;
    roomInfo.closed = true;

    try {
      if (roomInfo.signaling) {
        await roomInfo.signaling.deleteRoom(roomId);
        console.log('[App] 방이 폐쇄되었습니다');
      }
    } catch (error) {
      console.error('[App] 방 삭제 실패:', error.message);
    }
  }

  _closeAllRooms(isKeepalive) {
    for (const roomId of this.hostRooms.keys()) {
      this._closeRoom(roomId, isKeepalive);
      this._stopHostHeartbeat(roomId);
      this._stopPendingParticipantPolling(roomId);
    }

    if (this._beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
  }

  setActiveRoom(roomId) {
    if (this.hostRooms.has(roomId)) {
      if (this.screenStream && this.screenRoomId && this.screenRoomId !== roomId) {
        if (this.screenSharePolicy === 'stop') {
          this.stopScreenShare();
        }
      }
      this.activeRoomId = roomId;
      this.roomId = roomId;
      this.connection = this.hostRooms.get(roomId)?.connection || null;
    }
  }

  getActiveConnection() {
    if (this.role === 'host' && this.activeRoomId) {
      return this.hostRooms.get(this.activeRoomId)?.connection || null;
    }
    return this.connection;
  }

  getRoomConnection(roomId) {
    return this.hostRooms.get(roomId)?.connection || null;
  }

  async closeHostRoom(roomId, isKeepalive) {
    const roomInfo = this.hostRooms.get(roomId);
    if (!roomInfo) return false;

    if (this.screenRoomId === roomId) {
      await this.stopScreenShare();
    }

    this._stopHostHeartbeat(roomId);
    this._stopPendingParticipantPolling(roomId);
    await this._closeRoom(roomId, isKeepalive);

    try {
      roomInfo.connection?.close?.();
    } catch (error) {
      console.warn('[App] 방 연결 종료 실패:', error.message);
    }

    this.hostRooms.delete(roomId);
    if (this.activeRoomId === roomId) {
      this.activeRoomId = null;
      this.connection = null;
      this.roomId = null;
    }

    return true;
  }

  async startScreenShare(roomId, options = {}) {
    // 보안 컨텍스트 체크
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('화면 공유는 HTTPS 또는 localhost에서만 사용 가능합니다.\n현재 주소를 localhost로 변경하거나 HTTPS를 사용해주세요.');
    }

    const targetRoomId = roomId || this.activeRoomId || this.roomId;
    const connection = this.role === 'host'
      ? this.hostRooms.get(targetRoomId)?.connection
      : this.connection;

    if (!connection?.pc) {
      throw new Error('연결이 준비되지 않았습니다');
    }

    if (this.screenStream) {
      await this.stopScreenShare();
    }

    const videoConstraints = {};
    if (options.frameRate) {
      videoConstraints.frameRate = options.frameRate;
    }
    if (options.width) {
      videoConstraints.width = { ideal: options.width };
    }
    if (options.height) {
      videoConstraints.height = { ideal: options.height };
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: Object.keys(videoConstraints).length > 0 ? videoConstraints : true,
      audio: Boolean(options.includeAudio)
    });

    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error('화면 공유 트랙을 가져올 수 없습니다');
    }

    const audioTrack = stream.getAudioTracks?.()[0] || null;

    if (options.includeAudio && !audioTrack) {
      this.onScreenAudioMissing?.(targetRoomId);
    }

    try {
      await connection.attachScreenTracks?.(stream, track, audioTrack);
    } catch (err) {
      // 실패 시 캡처 스트림 중단
      stream.getTracks()?.forEach(t => t.stop());
      throw err;
    }

    this.screenStream = stream;
    this.screenRoomId = targetRoomId;

    track.onended = () => {
      this.stopScreenShare();
    };

    this.onLocalScreenStream?.(stream, targetRoomId);

    // 화면 공유 시작 알림 전송
    const myName = this.hostName || this.participantName || '';
    try {
      connection?.send?.({
        type: 'screen-share-started',
        from: myName,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      });
    } catch(e) {}

    // 화면 공유 시작 후 재협상 강제 트리거
    if (this.role === 'host') {
      await connection.renegotiate?.({ iceRestart: false });
    } else {
      await connection.requestRenegotiation?.('screen-share-start');
    }

    return true;
  }

  async stopScreenShare() {
    if (!this.screenStream) return;

    const targetRoomId = this.screenRoomId || this.activeRoomId || this.roomId;
    const connection = this.role === 'host'
      ? this.hostRooms.get(targetRoomId)?.connection
      : this.connection;

    // 화면 공유 중지 알림 전송
    const myName = this.hostName || this.participantName || '';
    try {
      connection?.send?.({
        type: 'screen-share-stopped',
        from: myName,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      });
    } catch(e) {}

    try {
      await connection?.detachScreenTracks?.();
    } catch (error) {
      console.warn('[App] 화면 공유 중지 실패:', error.message);
    }

    this.screenStream.getTracks().forEach((track) => track.stop());
    this.screenStream = null;
    this.screenRoomId = null;

    this.onLocalScreenStopped?.(targetRoomId);
  }

  getScreenShareRoomId() {
    return this.screenRoomId;
  }

  isScreenSharing() {
    return Boolean(this.screenStream);
  }

  setScreenSharePolicy(policy) {
    this.screenSharePolicy = policy === 'keep' ? 'keep' : 'stop';
  }

  // ============================================
  // 콜백 (WebRTC 이벤트)
  // ============================================
  onConnectionOpen(roomId) {
    console.log('[App] 💬 DataChannel 열림!', roomId || '');
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.setProperty('color', 'green');
  }

  onConnectionClose(roomId) {
    console.log('[App] 연결 종료', roomId || '');
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.setProperty('color', 'red');

    if (this.screenRoomId && this.screenRoomId === roomId) {
      this.stopScreenShare();
    }

    if (this.role === 'host' && roomId) {
      if (!this.hostRooms.has(roomId)) {
        return;
      }
      this._stopHostHeartbeat(roomId);
      this._stopPendingParticipantPolling(roomId);
      this._closeRoom(roomId, false);
      this.hostRooms.delete(roomId);
      if (this.activeRoomId === roomId) {
        this.activeRoomId = null;
        this.connection = null;
        this.roomId = null;
      }
    }
  }

  onMessage(message) {
    console.log('[App] 메시지 수신:', message);
  }
}

