/**
 * WebRTC 모듈 - 공유자/참여자 역할 분리
 * HostConnection: Offer 생성자 (공유자)
 * JoinConnection: Answer 생성자 (참여자)
 */

const RTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 10
};

/**
 * 기본 ICE 수집 대기 함수 (공통 로직)
 * @param {RTCPeerConnection} pc - 피어 연결 객체
 * @returns {Promise} ICE 수집 완료 시 resolve
 */
function waitForICE(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);

    // 타임아웃: 10초 후 무조건 진행
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, 10000);
  });
}

// ============================================
// 대용량 메시지 청크 전송/수신 유틸리티
// ============================================
const CHUNK_SIZE = 14000; // ~14KB per chunk (안전 마진)
const BUFFER_THRESHOLD = 65536; // 64KB - bufferedAmount 임계값

/**
 * 대용량 메시지를 청크로 분할 전송 (동기, 소형 메시지용)
 * @param {RTCDataChannel} dc - 데이터 채널
 * @param {object} message - 전송할 메시지
 * @returns {boolean} 전송 성공 여부
 */
function sendChunked(dc, message) {
  if (dc?.readyState !== 'open') return false;
  try {
    const json = JSON.stringify(message);
    if (json.length <= CHUNK_SIZE) {
      dc.send(json);
      return true;
    }
    // 청크 분할 전송
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const total = Math.ceil(json.length / CHUNK_SIZE);
    for (let i = 0; i < total; i++) {
      dc.send(JSON.stringify({
        __chunk: true,
        id,
        index: i,
        total,
        data: json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      }));
    }
    return true;
  } catch (error) {
    console.error('[Chunk] 전송 오류:', error);
    return false;
  }
}

/**
 * 흐름 제어(backpressure)가 적용된 비동기 청크 전송
 * 대용량 파일/이미지 전송 시 DataChannel 버퍼 오버플로우 방지
 * @param {RTCDataChannel} dc - 데이터 채널
 * @param {object} message - 전송할 메시지
 * @param {function} [onProgress] - 진행 콜백 (sentChunks, totalChunks) => void
 * @returns {Promise<boolean>} 전송 성공 여부
 */
async function sendChunkedAsync(dc, message, onProgress) {
  if (dc?.readyState !== 'open') return false;
  try {
    const json = JSON.stringify(message);
    if (json.length <= CHUNK_SIZE) {
      dc.send(json);
      onProgress?.(1, 1);
      return true;
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const total = Math.ceil(json.length / CHUNK_SIZE);
    dc.bufferedAmountLowThreshold = BUFFER_THRESHOLD;

    console.log(`[ChunkAsync] 전송 시작: ${total}개 청크 (${(json.length / 1048576).toFixed(1)}MB)`);

    for (let i = 0; i < total; i++) {
      // 버퍼가 가득 차면 빠질 때까지 대기 (backpressure)
      if (dc.bufferedAmount > BUFFER_THRESHOLD) {
        await new Promise((resolve) => {
          const onLow = () => {
            dc.removeEventListener('bufferedamountlow', onLow);
            clearTimeout(timer);
            resolve();
          };
          dc.addEventListener('bufferedamountlow', onLow);
          // 안전 타임아웃: 이벤트 미발생 대비
          const timer = setTimeout(() => {
            dc.removeEventListener('bufferedamountlow', onLow);
            resolve();
          }, 500);
        });
        // DC가 닫혔으면 중단
        if (dc.readyState !== 'open') {
          console.warn(`[ChunkAsync] DC 닫힘 - 전송 중단 (${i}/${total})`);
          return false;
        }
      }

      dc.send(JSON.stringify({
        __chunk: true,
        id,
        index: i,
        total,
        data: json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      }));

      onProgress?.(i + 1, total);
    }

    console.log(`[ChunkAsync] 전송 완료: ${total}개 청크`);
    return true;
  } catch (error) {
    console.error('[ChunkAsync] 전송 오류:', error);
    return false;
  }
}

/**
 * 기본 DataChannel 이벤트 설정 (공통 로직)
 * @param {RTCDataChannel} dc - 데이터 채널
 * @param {object} app - LANBridge 앱 인스턴스
 * @param {string} role - 역할 구분 ('Host' 또는 'Join')
 */
function setupDataChannelEvents(dc, app, role, roomId, connection) {
  const chunkBuffers = new Map(); // 청크 재조립 버퍼
  dc.onopen = () => {
    console.log(`[${role} DC] ✅ OPEN! roomId=${roomId}`);
    app.onConnectionOpen?.(roomId);
  };

  dc.onmessage = async (e) => {
    try {
      const parsed = JSON.parse(e.data);

      // 청크 재조립 처리
      if (parsed.__chunk) {
        const { id, index, total, data } = parsed;
        if (!chunkBuffers.has(id)) {
          chunkBuffers.set(id, { parts: new Array(total), received: 0 });
          // 대용량 청크 시작 알림 (100개 이상의 청크 = ~1.4MB 이상)
          if (total > 100) {
            app.onChunkProgress?.(id, 0, total, roomId);
          }
        }
        const buf = chunkBuffers.get(id);
        if (!buf.parts[index]) {
          buf.parts[index] = data;
          buf.received++;
        }
        // 수신 진행률 알림
        if (total > 100 && buf.received % 50 === 0) {
          app.onChunkProgress?.(id, buf.received, total, roomId);
        }
        if (buf.received < total) return; // 아직 다 안 옴
        // 수신 완료 알림
        if (total > 100) {
          app.onChunkProgress?.(id, total, total, roomId);
        }
        const fullJson = buf.parts.join('');
        chunkBuffers.delete(id);
        const message = JSON.parse(fullJson);
        // 재조립 완료 → 아래에서 처리
        await handleMessage(message);
        return;
      }

      await handleMessage(parsed);
    } catch (error) {
      console.error(`[${role} DC] 메시지 파싱 오류:`, error);
    }
  };

  async function handleMessage(message) {
    // 재협상 메시지 처리
    if (message.type === 'request-renegotiation' && connection) {
      console.log(`[${role}] 재협상 요청 수신`);
      await connection._handleRenegotiationRequest?.(message);
    } else if (message.type === 'renegotiate-offer' && connection) {
      console.log(`[${role}] 재협상 Offer 수신`);
      await connection._handleRenegotiateOffer?.(message);
    } else if (message.type === 'renegotiate-answer' && connection) {
      console.log(`[${role}] 재협상 Answer 수신`);
      await connection._handleRenegotiateAnswer?.(message);
    } else if (message.type === 'screen-track-map' && connection) {
      connection.screenTrackMap?.set(message.streamId, message.from);
    } else if (message.type === 'screen-share-stopped' && connection) {
      connection._handleScreenShareStopped?.(message);
      app.onMessage?.(message, roomId);
    } else {
      // 일반 메시지는 앱으로 전달
      app.onMessage?.(message, roomId);
    }
  }

  dc.onerror = (e) => {
    console.error(`[${role} DC] 에러:`, e);
  };

  dc.onclose = () => {
    console.log(`[${role} DC] 연결 종료`);
    app.onConnectionClose?.(roomId);
  };
}

// ============================================
// 공유자 (Host/Offerer) - 다중 피어 관리
// ============================================
class HostConnection {
  /**
   * 공유자 연결 생성 (다중 참여자 지원)
   * @param {LANBridge} app - LANBridge 앱 인스턴스
   * @param {string} roomId - 방 ID
   */
  constructor(app, roomId) {
    console.log('[Host] 다중 피어 매니저 생성');
    this.app = app;
    this.roomId = roomId;
    this.peers = new Map(); // participantName → { pc, dataChannel, connected, ... }
    this.remoteScreenStreams = new Map(); // peerName → { stream, videoTrack, audioTrack }
    this.relayedSenders = new Map(); // fromPeerName → Map<toPeerName, [RTCRtpSender]>
  }

  /**
   * 특정 참여자를 위한 PeerConnection + Offer 생성
   * @param {string} participantName
   * @returns {Promise<object>} Offer SDP
   */
  async createOfferForPeer(participantName) {
    console.log(`[Host] ${participantName} 피어 연결 생성`);

    const peerInfo = {
      participantName,
      pc: null,
      dataChannel: null,
      connected: false,
      screenVideoSender: null,
      screenAudioSender: null,
      isNegotiating: false
    };

    const pc = new RTCPeerConnection(RTCConfig);
    peerInfo.pc = pc;

    // negotiationneeded 핸들러 (DC가 열린 후에만 재협상 허용)
    pc.onnegotiationneeded = async () => {
      if (peerInfo.isNegotiating || !pc.remoteDescription) return;
      // DataChannel이 열리기 전에 재협상하면 DTLS 핸드셰이크가 끊어짐
      if (peerInfo.dataChannel?.readyState !== 'open') {
        console.log(`[Host] ${participantName} onnegotiationneeded 무시 (DC: ${peerInfo.dataChannel?.readyState})`);
        return;
      }
      peerInfo.isNegotiating = true;
      try {
        await this._renegotiateWithPeer(participantName);
      } finally {
        peerInfo.isNegotiating = false;
      }
    };

    // ICE / track 이벤트
    this._setupPeerEvents(peerInfo);

    // ⚠️ 트랜시버(비디오/오디오)는 초기 연결 시 추가하지 않음
    // DataChannel만으로 초기 연결 후, 화면 공유 시 재협상으로 추가

    // DataChannel 생성
    const dc = pc.createDataChannel('lanbridge', { ordered: true });
    peerInfo.dataChannel = dc;
    this._setupPeerDataChannel(peerInfo);

    // Offer 생성
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForICE(pc);

    this.peers.set(participantName, peerInfo);
    console.log(`[Host] ${participantName} Offer 생성 완료 (총 ${this.peers.size}명, ICE gathering: ${pc.iceGatheringState}, candidates: ${pc.localDescription?.sdp?.split('a=candidate:').length - 1 || 0})`);

    return { type: 'offer', sdp: pc.localDescription.sdp };
  }

  /**
   * 참여자의 Answer 적용
   * @param {string} participantName
   * @param {object} answerData - SDP Answer
   */
  async applyAnswerForPeer(participantName, answerData) {
    const peer = this.peers.get(participantName);
    if (!peer) throw new Error('피어를 찾을 수 없음: ' + participantName);
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answerData));
    peer.connected = true;
    console.log(`[Host] ✅ ${participantName} Answer 적용 완료`);
  }

  /**
   * 모든 연결된 피어에게 메시지 전송 (브로드캐스트, 동기)
   * @param {object} message
   * @returns {boolean}
   */
  send(message) {
    let sent = false;
    const peerStates = [];
    for (const [name, peer] of this.peers) {
      const dcState = peer.dataChannel?.readyState || 'no-dc';
      peerStates.push(`${name}:${dcState}`);
      if (peer.dataChannel?.readyState === 'open') {
        if (sendChunked(peer.dataChannel, message)) {
          sent = true;
        }
      }
    }
    console.log(`[Host] send → [${peerStates.join(', ')}] sent=${sent}`);
    return sent;
  }

  /**
   * 흐름 제어가 적용된 비동기 브로드캐스트 (대용량 파일/이미지용)
   * @param {object} message
   * @param {function} [onProgress] - (sentChunks, totalChunks) => void
   * @returns {Promise<boolean>}
   */
  async sendAsync(message, onProgress) {
    let sent = false;
    const openPeers = [...this.peers.entries()]
      .filter(([_, p]) => p.dataChannel?.readyState === 'open');
    // 모든 피어에 병렬 전송 (각 DC의 flow control은 개별 적용)
    const results = await Promise.all(
      openPeers.map(([name, peer]) => sendChunkedAsync(peer.dataChannel, message, onProgress))
    );
    sent = results.some(r => r);
    console.log(`[Host] sendAsync → ${results.filter(r => r).length}/${openPeers.length} peers`);
    return sent;
  }

  /**
   * 특정 피어에게만 메시지 전송 (귓속말, 동기)
   * @param {object} message
   * @param {string} targetName - 대상 참여자 이름
   * @returns {boolean}
   */
  sendTo(message, targetName) {
    const peer = this.peers.get(targetName);
    if (!peer || peer.dataChannel?.readyState !== 'open') {
      console.warn(`[Host] sendTo: ${targetName} not connected`);
      return false;
    }
    return sendChunked(peer.dataChannel, message);
  }

  /**
   * 특정 피어에게만 비동기 전송 (귓속말, 대용량)
   * @param {object} message
   * @param {string} targetName
   * @param {function} [onProgress]
   * @returns {Promise<boolean>}
   */
  async sendToAsync(message, targetName, onProgress) {
    const peer = this.peers.get(targetName);
    if (!peer || peer.dataChannel?.readyState !== 'open') {
      console.warn(`[Host] sendToAsync: ${targetName} not connected`);
      return false;
    }
    return sendChunkedAsync(peer.dataChannel, message, onProgress);
  }

  /**
   * 특정 발신자 제외하고 다른 피어들에게 릴레이 (흐름 제어 적용)
   * 귓속말(whisperTo)이 있으면 호스트 자신과 대상에게만 전달
   * @param {object} message
   * @param {string} senderName
   */
  async _relayMessage(message, senderName) {
    // 귓속말 메시지: 호스트에게만 표시 (대상 피어에게는 릴레이 안 함 — 참여자→호스트 귓속말)
    // 호스트가 보낸 귓속말은 sendTo로 직접 전송하므로 여기서는 참여자 발 귓속말만 처리
    if (message.whisperTo) {
      const targetName = message.whisperTo;
      // 대상이 호스트 자신이면 릴레이 불필요 (onMessage에서 표시)
      if (targetName === (this.app.hostName || '')) {
        console.log(`[Host] whisper from ${senderName} → Host (no relay needed)`);
        return;
      }
      // 대상이 다른 참여자이면 해당 피어에게만 전달
      const targetPeer = this.peers.get(targetName);
      if (targetPeer?.dataChannel?.readyState === 'open') {
        const isLarge = message.type === 'file' || message.type === 'image';
        if (isLarge) {
          await sendChunkedAsync(targetPeer.dataChannel, message);
        } else {
          sendChunked(targetPeer.dataChannel, message);
        }
        console.log(`[Host] whisper relay from ${senderName} → ${targetName}`);
      }
      return;
    }

    const targets = [...this.peers.entries()]
      .filter(([name, p]) => name !== senderName && p.dataChannel?.readyState === 'open');
    if (targets.length === 0) return;
    // 대용량 메시지 감지: 파일/이미지이면 비동기 흐름 제어 사용
    const isLarge = message.type === 'file' || message.type === 'image';
    if (isLarge) {
      await Promise.all(
        targets.map(([name, peer]) => sendChunkedAsync(peer.dataChannel, message))
      );
    } else {
      for (const [name, peer] of targets) {
        sendChunked(peer.dataChannel, message);
      }
    }
    if (this.peers.size > 1) {
      console.log(`[Host] relay from ${senderName} → ${targets.length}/${this.peers.size - 1} peers`);
    }
  }

  /**
   * 새로 연결된 피어에게 기존 채팅 기록 전송 (흐름 제어 적용)
   * @param {object} peerInfo
   */
  async _syncChatHistoryToPeer(peerInfo) {
    const history = this.app.getChatHistory?.(this.roomId) || [];
    if (history.length === 0) return;
    console.log(`[Host] ${peerInfo.participantName}에게 채팅 기록 ${history.length}건 전송`);
    for (const msg of history) {
      try {
        await sendChunkedAsync(peerInfo.dataChannel, msg);
      } catch (err) {
        console.warn(`[Host] 채팅 기록 전송 오류:`, err.message);
        break;
      }
    }
  }

  // DataChannel 이벤트 설정 (개별 피어)
  _setupPeerDataChannel(peerInfo) {
    const dc = peerInfo.dataChannel;
    const chunkBuffers = new Map();
    const self = this;

    dc.onopen = () => {
      console.log(`[Host DC] ✅ OPEN: ${peerInfo.participantName} (peers: ${self.peers.size})`);
      peerInfo.connected = true;
      self.app.onConnectionOpen?.(self.roomId);
      // 새 피어에게 기존 채팅 기록 전송
      self._syncChatHistoryToPeer(peerInfo);
      // 새 피어에게 기존 화면 공유 릴레이
      setTimeout(() => self._relayExistingScreensToPeer(peerInfo), 500);
    };

    dc.onmessage = async (e) => {
      try {
        const parsed = JSON.parse(e.data);

        // 청크 재조립
        if (parsed.__chunk) {
          const { id, index, total, data } = parsed;
          if (!chunkBuffers.has(id)) {
            chunkBuffers.set(id, { parts: new Array(total), received: 0 });
            if (total > 100) {
              self.app.onChunkProgress?.(id, 0, total, self.roomId);
            }
          }
          const buf = chunkBuffers.get(id);
          if (!buf.parts[index]) {
            buf.parts[index] = data;
            buf.received++;
          }
          if (total > 100 && buf.received % 50 === 0) {
            self.app.onChunkProgress?.(id, buf.received, total, self.roomId);
          }
          if (buf.received < total) return;
          if (total > 100) {
            self.app.onChunkProgress?.(id, total, total, self.roomId);
          }
          const fullJson = buf.parts.join('');
          chunkBuffers.delete(id);
          const message = JSON.parse(fullJson);
          await handleMessage(message);
          return;
        }

        await handleMessage(parsed);
      } catch (error) {
        console.error(`[Host DC] 메시지 파싱 오류:`, error);
      }
    };

    async function handleMessage(message) {
      // 재협상 메시지 (피어별 처리)
      if (message.type === 'request-renegotiation') {
        await self._handleRenegotiationRequest(peerInfo, message);
      } else if (message.type === 'renegotiate-answer') {
        await self._handleRenegotiateAnswer(peerInfo, message);
      } else if (message.type === 'screen-share-stopped') {
        // 화면 공유 중지: 릴레이 트랙 정리 + 다른 피어에 전달
        self._cleanupPeerScreenShareTracks(peerInfo.participantName);
        self._relayMessage(message, peerInfo.participantName);
        self.app.onMessage?.(message, self.roomId);
      } else {
        // 일반 메시지: 다른 피어들에게 릴레이 + 앱에 전달
        self._relayMessage(message, peerInfo.participantName);
        self.app.onMessage?.(message, self.roomId);
      }
    }

    dc.onerror = (e) => {
      console.error(`[Host DC] 에러 (${peerInfo.participantName}):`, e);
    };

    dc.onclose = () => {
      console.log(`[Host DC] 연결 종료: ${peerInfo.participantName}`);
      peerInfo.connected = false;
      // 모든 피어가 끊어졌는지 확인
      const anyConnected = [...self.peers.values()].some(p => p.connected);
      if (!anyConnected) {
        self.app.onConnectionClose?.(self.roomId);
      }
    };
  }

  // ICE/track 이벤트 설정 (개별 피어)
  _setupPeerEvents(peerInfo) {
    const pc = peerInfo.pc;
    const self = this;

    pc.oniceconnectionstatechange = () => {
      console.log(`[Host ICE] ${peerInfo.participantName}:`, pc.iceConnectionState);
      if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
        setTimeout(() => {
          // 이 PC가 이미 교체된 경우 무시 (재시도 시 새 PC가 같은 이름으로 등록됨)
          const currentPeer = self.peers.get(peerInfo.participantName);
          if (!currentPeer || currentPeer.pc !== pc) {
            console.log(`[Host ICE] ${peerInfo.participantName} 이미 교체된 PC - 무시`);
            return;
          }
          if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
            console.warn(`[Host] ${peerInfo.participantName} ICE 복구 실패 (state: ${pc.iceConnectionState})`);
            peerInfo.connected = false;
            // 화면 공유 릴레이 정리
            self._handlePeerDisconnect(peerInfo.participantName);
            // 시스템 메시지로 퇴장 알림
            self._relayMessage({
              type: 'system',
              text: `${peerInfo.participantName} 연결이 끊어졌습니다`,
              timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            }, peerInfo.participantName);
            self.app.onMessage?.({
              type: 'system',
              text: `${peerInfo.participantName} 연결이 끊어졌습니다`,
              timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            }, self.roomId);
            self.peers.delete(peerInfo.participantName);
            // 서버에서 참여자 제거 알림
            self.app.onPeerDisconnected?.(peerInfo.participantName, self.roomId);
            const anyConnected = [...self.peers.values()].some(p => p.connected);
            if (!anyConnected) {
              self.app.onConnectionClose?.(self.roomId);
            }
          }
        }, 5000);
      }
    };

    pc.ontrack = (event) => {
      let stream = event.streams?.[0] || (event.track ? new MediaStream([event.track]) : null);
      if (!stream) return;
      const track = event.track;
      const fromName = peerInfo.participantName;

      // Store remote screen track
      if (!self.remoteScreenStreams.has(fromName)) {
        self.remoteScreenStreams.set(fromName, { stream, videoTrack: null, audioTrack: null });
      }
      const entry = self.remoteScreenStreams.get(fromName);
      entry.stream = stream;
      if (track.kind === 'video') entry.videoTrack = track;
      if (track.kind === 'audio') entry.audioTrack = track;

      // Notify UI with sender name
      self.app.onRemoteStream?.(stream, self.roomId, fromName);

      // Relay track to other peers
      self._relayScreenTrackToOthers(fromName, track, stream);
    };
  }

  // 트랜시버 확보 (비디오/오디오)
  _ensurePeerTransceivers(peerInfo) {
    const pc = peerInfo.pc;

    let vt = (pc.getTransceivers?.() || []).find(t =>
      t.receiver?.track?.kind === 'video' || t.sender?.track?.kind === 'video'
    );
    if (!vt) {
      vt = pc.addTransceiver('video', { direction: 'sendrecv' });
    }
    peerInfo.screenVideoSender = vt.sender;

    let at = (pc.getTransceivers?.() || []).find(t =>
      t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
    );
    if (!at) {
      at = pc.addTransceiver('audio', { direction: 'sendrecv' });
    }
    peerInfo.screenAudioSender = at.sender;
  }

  // 화면 공유 트랙을 다른 피어에게 릴레이
  _relayScreenTrackToOthers(fromName, track, stream) {
    for (const [toPeerName, toPeer] of this.peers) {
      if (toPeerName === fromName || !toPeer.connected) continue;
      try {
        const sender = toPeer.pc.addTrack(track, stream);
        if (!this.relayedSenders.has(fromName)) this.relayedSenders.set(fromName, new Map());
        const peerSenders = this.relayedSenders.get(fromName);
        if (!peerSenders.has(toPeerName)) peerSenders.set(toPeerName, []);
        peerSenders.get(toPeerName).push(sender);
        if (toPeer.dataChannel?.readyState === 'open') {
          sendChunked(toPeer.dataChannel, { type: 'screen-track-map', streamId: stream.id, from: fromName });
        }
      } catch(e) {
        console.warn(`[Host] 트랙 릴레이 실패 ${fromName} → ${toPeerName}:`, e.message);
      }
    }
  }

  // 새로 연결된 피어에게 기존 화면 공유 릴레이
  async _relayExistingScreensToPeer(peerInfo) {
    const peerName = peerInfo.participantName;
    // 1. Host 자신의 화면 공유
    if (this.app.screenStream) {
      const stream = this.app.screenStream;
      const vt = stream.getVideoTracks()[0];
      const at = stream.getAudioTracks()[0] || null;
      try {
        if (vt && vt.readyState !== 'ended') { peerInfo.screenVideoSender = peerInfo.pc.addTrack(vt, stream); }
        if (at && at.readyState !== 'ended') { peerInfo.screenAudioSender = peerInfo.pc.addTrack(at, stream); }
        if (peerInfo.dataChannel?.readyState === 'open') {
          sendChunked(peerInfo.dataChannel, { type: 'screen-track-map', streamId: stream.id, from: this.app.hostName || 'Host' });
        }
      } catch(e) { console.warn('[Host] 호스트 화면 신규 피어 릴레이 실패:', e.message); }
    }
    // 2. 다른 피어들의 화면 공유
    for (const [fromName, { stream, videoTrack, audioTrack }] of this.remoteScreenStreams) {
      if (fromName === peerName) continue;
      try {
        const senders = [];
        if (videoTrack && videoTrack.readyState !== 'ended') senders.push(peerInfo.pc.addTrack(videoTrack, stream));
        if (audioTrack && audioTrack.readyState !== 'ended') senders.push(peerInfo.pc.addTrack(audioTrack, stream));
        if (!this.relayedSenders.has(fromName)) this.relayedSenders.set(fromName, new Map());
        this.relayedSenders.get(fromName).set(peerName, senders);
        if (peerInfo.dataChannel?.readyState === 'open') {
          sendChunked(peerInfo.dataChannel, { type: 'screen-track-map', streamId: stream.id, from: fromName });
        }
      } catch(e) { console.warn(`[Host] ${fromName} 릴레이 → ${peerName} 실패:`, e.message); }
    }
  }

  // 피어의 화면 공유 릴레이 정리 (트랙만)
  _cleanupPeerScreenShareTracks(peerName) {
    const senderMap = this.relayedSenders.get(peerName);
    if (senderMap) {
      for (const [toPeerName, senders] of senderMap) {
        const toPeer = this.peers.get(toPeerName);
        if (toPeer?.pc) {
          for (const sender of senders) { try { toPeer.pc.removeTrack(sender); } catch(e) {} }
        }
      }
      this.relayedSenders.delete(peerName);
    }
    this.remoteScreenStreams.delete(peerName);
    this.app.onRemoteStreamEnded?.(peerName);
  }

  // 피어 연결 해제 시 전체 정리
  _handlePeerDisconnect(peerName) {
    const hadScreenShare = this.remoteScreenStreams.has(peerName);
    this._cleanupPeerScreenShareTracks(peerName);
    // 이 피어에게 릴레이 중이던 다른 피어 트랙 정리
    for (const [fromName, senderMap] of this.relayedSenders) {
      senderMap.delete(peerName);
    }
    if (hadScreenShare) {
      for (const [name, peer] of this.peers) {
        if (name !== peerName && peer.dataChannel?.readyState === 'open') {
          sendChunked(peer.dataChannel, { type: 'screen-share-stopped', from: peerName });
        }
      }
    }
  }

  // 화면 공유 트랙을 모든 피어에 추가
  async attachScreenTracks(stream, videoTrack, audioTrack) {
    for (const [name, peer] of this.peers) {
      if (!peer.connected) continue;
      try {
        // 비디오 트랙
        if (videoTrack && videoTrack.readyState !== 'ended') {
          if (peer.screenVideoSender?.track) {
            await peer.screenVideoSender.replaceTrack(videoTrack);
          } else {
            const sender = peer.pc.addTrack(videoTrack, stream);
            peer.screenVideoSender = sender;
          }
        }
        // 오디오 트랙
        if (audioTrack && audioTrack.readyState !== 'ended') {
          if (peer.screenAudioSender?.track) {
            await peer.screenAudioSender.replaceTrack(audioTrack);
          } else {
            const sender = peer.pc.addTrack(audioTrack, stream);
            peer.screenAudioSender = sender;
          }
        }
        // Send stream mapping info
        if (peer.dataChannel?.readyState === 'open') {
          sendChunked(peer.dataChannel, { type: 'screen-track-map', streamId: stream.id, from: this.app.hostName || 'Host' });
        }
      } catch (err) {
        console.warn(`[Host] ${name} 화면 공유 트랙 추가 실패:`, err.message);
      }
    }
  }

  // 화면 공유 트랙 제거
  async detachScreenTracks() {
    for (const [name, peer] of this.peers) {
      try {
        if (peer.screenVideoSender) await peer.screenVideoSender.replaceTrack(null);
        if (peer.screenAudioSender) await peer.screenAudioSender.replaceTrack(null);
      } catch (err) {
        console.warn(`[Host] ${name} 트랙 제거 실패:`, err.message);
      }
    }
  }

  // 재협상: 특정 피어
  async _renegotiateWithPeer(participantName) {
    const peer = this.peers.get(participantName);
    if (!peer || peer.isNegotiating) return;
    peer.isNegotiating = true;
    try {
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      await waitForICE(peer.pc);
      if (peer.dataChannel?.readyState === 'open') {
        sendChunked(peer.dataChannel, {
          type: 'renegotiate-offer',
          sdp: peer.pc.localDescription.sdp
        });
        console.log(`[Host] ${participantName} 재협상 Offer 전송`);
      }
    } catch (err) {
      console.error(`[Host] ${participantName} 재협상 오류:`, err);
    } finally {
      peer.isNegotiating = false;
    }
  }

  // 재협상 요청 처리
  async _handleRenegotiationRequest(peerInfo, message) {
    if (peerInfo.isNegotiating) return;
    await this._renegotiateWithPeer(peerInfo.participantName);
  }

  // 재협상 Answer 적용
  async _handleRenegotiateAnswer(peerInfo, message) {
    try {
      await peerInfo.pc.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: message.sdp
      }));
      peerInfo.isNegotiating = false;
      console.log(`[Host] ✅ ${peerInfo.participantName} 재협상 완료`);
    } catch (error) {
      console.error(`[Host] ${peerInfo.participantName} 재협상 Answer 오류:`, error);
      peerInfo.isNegotiating = false;
    }
  }

  // 모든 피어에 재협상 (화면 공유 시 사용)
  async renegotiate({ iceRestart = false } = {}) {
    for (const [name, peer] of this.peers) {
      if (peer.connected && !peer.isNegotiating) {
        await this._renegotiateWithPeer(name);
      }
    }
  }

  // 하위 호환: pc 속성 접근 시 첫 번째 피어의 pc 반환
  get pc() {
    for (const peer of this.peers.values()) {
      if (peer.pc) return peer.pc;
    }
    return null;
  }

  get dataChannel() {
    for (const peer of this.peers.values()) {
      if (peer.dataChannel?.readyState === 'open') return peer.dataChannel;
    }
    return null;
  }

  get isConnected() {
    return [...this.peers.values()].some(p => p.connected);
  }

  /**
   * 연결 종료
   */
  close() {
    console.log(`[Host] 연결 종료 (${this.peers.size}명)`);
    this.relayedSenders.clear();
    this.remoteScreenStreams.clear();
    for (const [name, peer] of this.peers) {
      peer.dataChannel?.close();
      peer.pc?.close();
    }
    this.peers.clear();
  }
}

// ============================================
// 참여자 (Join/Answerer)
// ============================================
class JoinConnection {
  /**
   * 참여자 연결 생성
   * @param {LANBridge} app - LANBridge 앱 인스턴스
   */
  constructor(app, roomId) {
    console.log('[Join] 생성');
    this.app = app;
    this.roomId = roomId;
    this.pc = null;
    this.dataChannel = null;
    this.screenVideoSender = null;
    this.screenAudioSender = null;
    this.isNegotiating = false;
    this._hasRemoteTrack = false;
    this._remoteTrackTimer = null;
    this.screenTrackMap = new Map(); // streamId → participantName
    // 재협상 이벤트 핸들러 바인딩
    this._onNegotiationNeeded = this._onNegotiationNeeded.bind(this);
  }

  /**
   * 참여자 연결 시작 (Answer 생성)
   * @param {object} offerData - 공유자의 Offer SDP 정보
   * @returns {Promise} Answer 객체 반환
   */
  async start(offerData) {
    console.log('[Join] 연결 시작 (Offer SDP length:', offerData?.sdp?.length || 0, ')');
    
    this.pc = new RTCPeerConnection(RTCConfig);
    this.pc.onnegotiationneeded = this._onNegotiationNeeded;
    this.setupPCEvents();

    // ondatachannel 등록 (setRemoteDescription 전!)
    this.pc.ondatachannel = (event) => {
      console.log('[Join] ✅ DataChannel 수신됨! readyState:', event.channel.readyState);
      this.dataChannel = event.channel;
      setupDataChannelEvents(this.dataChannel, this.app, 'Join', this.roomId, this);
      // DC가 이미 open인 경우를 대비 (빠른 localhost 연결)
      if (event.channel.readyState === 'open') {
        console.log('[Join] DC 이미 OPEN 상태 - onConnectionOpen 직접 호출');
        this.app.onConnectionOpen?.(this.roomId);
      }
    };

    // Offer 적용
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerData));
    console.log('[Join] Offer 적용됨');

    // ⚠️ 트랜시버는 초기 연결 시 추가하지 않음
    // 화면 공유 시 attachScreenTracks에서 재협상으로 처리

    // Answer 생성
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    console.log('[Join] Answer 생성됨 (SDP length:', this.pc.localDescription?.sdp?.length || 0, ')');

    await waitForICE(this.pc);

    return { type: 'answer', sdp: this.pc.localDescription.sdp };
  }

  /**
   * P2P 연결 상태 변화 감시
   */
  setupPCEvents() {
    this.pc.oniceconnectionstatechange = () => {
      console.log('[Join ICE]:', this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'disconnected' || 
          this.pc.iceConnectionState === 'failed' || 
          this.pc.iceConnectionState === 'closed') {
        console.log('[Join] 연결 종료됨');
        this.app.onConnectionClose?.(this.roomId);
      }
    };

    this.pc.ontrack = (event) => {
      let stream = null;
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
      } else if (event.track) {
        stream = new MediaStream();
        stream.addTrack(event.track);
      }

      if (stream) {
        const senderName = this.screenTrackMap.get(stream.id) || null;
        this.app.onRemoteStream?.(stream, this.roomId, senderName);
      }
    };

    this.pc.onicecandidate = (event) => {
      // ICE candidate 처리 (필요시 로깅)
    };
  }

  _findVideoTransceiver() {
    const transceivers = this.pc?.getTransceivers?.() || [];
    return transceivers.find((transceiver) => transceiver?.receiver?.track?.kind === 'video') ||
      transceivers.find((transceiver) => transceiver?.sender?.track?.kind === 'video') ||
      null;
  }

  _findAudioTransceiver() {
    const transceivers = this.pc?.getTransceivers?.() || [];
    return transceivers.find((transceiver) => transceiver?.receiver?.track?.kind === 'audio') ||
      transceivers.find((transceiver) => transceiver?.sender?.track?.kind === 'audio') ||
      null;
  }

  _ensureVideoSender() {
    if (!this.pc) return null;
    let transceiver = this._findVideoTransceiver();
    if (!transceiver) {
      transceiver = this.pc.addTransceiver('video', { direction: 'sendrecv' });
    } else if (transceiver.direction === 'inactive') {
      transceiver.direction = 'sendrecv';
    }
    this.screenVideoSender = transceiver.sender;
    return this.screenVideoSender;
  }

  _ensureAudioSender() {
    if (!this.pc) return null;
    let transceiver = this._findAudioTransceiver();
    if (!transceiver) {
      transceiver = this.pc.addTransceiver('audio', { direction: 'sendrecv' });
    } else if (transceiver.direction === 'inactive') {
      transceiver.direction = 'sendrecv';
    }
    this.screenAudioSender = transceiver.sender;
    return this.screenAudioSender;
  }

  async attachScreenTracks(stream, videoTrack, audioTrack) {
    const ensureTrack = (track, kind) => {
      if (!track) {
        console.error(`[${kind}] 트랙이 존재하지 않습니다.`);
        return false;
      }
      if (typeof MediaStreamTrack !== 'undefined' && !(track instanceof MediaStreamTrack)) {
        console.error(`[${kind}] 트랙이 유효하지 않습니다:`, track);
        return false;
      }
      if (track.readyState === 'ended') {
        console.error(`[${kind}] 트랙이 종료된 상태입니다.`);
        return false;
      }
      console.log(`[${kind}] 트랙이 유효합니다:`, track);
      return true;
    };

    console.log('attachScreenTracks 호출됨:', { stream, videoTrack, audioTrack });

    // 비디오 트랙
    if (ensureTrack(videoTrack, '비디오')) {
      const videoSender = this._ensureVideoSender();
      if (videoSender?.track) {
        try {
          console.log('비디오 트랙 교체 시도:', videoTrack);
          await videoSender.replaceTrack(videoTrack);
          if (videoSender.setStreams && stream) {
            videoSender.setStreams(stream);
          } else {
            console.warn('setStreams 메서드가 지원되지 않습니다. 대체 로직을 사용합니다.');
            const newStream = new MediaStream([videoTrack]);
            this.pc.addTrack(videoTrack, newStream);
          }
        } catch (error) {
          console.warn('[Host/Join] 비디오 replaceTrack 실패, addTrack로 대체:', error);
          const sender = this.pc.addTrack(videoTrack, stream);
          sender.setStreams?.(stream);
        }
      } else {
        const sender = this.pc.addTrack(videoTrack, stream);
        sender.setStreams?.(stream);
      }
    } else {
      console.warn('유효하지 않은 비디오 트랙으로 인해 attachScreenTracks가 중단되었습니다.');
    }

    // 오디오 트랙
    if (ensureTrack(audioTrack, '오디오')) {
      const audioSender = this._ensureAudioSender();
      if (audioSender?.track) {
        try {
          console.log('오디오 트랙 교체 시도:', audioTrack);
          await audioSender.replaceTrack(audioTrack);
          if (audioSender.setStreams && stream) {
            audioSender.setStreams(stream);
          } else {
            console.warn('setStreams 메서드가 지원되지 않습니다. 대체 로직을 사용합니다.');
            const newStream = new MediaStream([audioTrack]);
            this.pc.addTrack(audioTrack, newStream);
          }
        } catch (error) {
          console.warn('[Host/Join] 오디오 replaceTrack 실패, addTrack로 대체:', error);
          const sender = this.pc.addTrack(audioTrack, stream);
          sender.setStreams?.(stream);
        }
      } else {
        const sender = this.pc.addTrack(audioTrack, stream);
        sender.setStreams?.(stream);
      }
    } else {
      console.warn('유효하지 않은 오디오 트랙으로 인해 attachScreenTracks가 중단되었습니다.');
    }

    console.log('[Join] attachScreenTracks 완료');
  }

  async detachScreenTracks() {
    if (this.screenVideoSender) {
      await this.screenVideoSender.replaceTrack(null);
    }
    if (this.screenAudioSender) {
      await this.screenAudioSender.replaceTrack(null);
    }
  }

  /**
   * 메시지 전송 (동기, 소형 메시지용)
   * @param {object} message - 전송할 메시지
   * @returns {boolean} 전송 성공 여부
   */
  send(message) {
    return sendChunked(this.dataChannel, message);
  }

  /**
   * 특정 대상에게 귓속말 (참여자→호스트 경유)
   * 메시지의 whisperTo 필드가 이미 설정되어 있으므로 그냥 전송
   * Host가 라우팅 처리
   */
  sendTo(message, targetName) {
    // whisperTo는 이미 메시지에 포함되어 있음
    return sendChunked(this.dataChannel, message);
  }

  async sendToAsync(message, targetName, onProgress) {
    return sendChunkedAsync(this.dataChannel, message, onProgress);
  }

  /**
   * 흐름 제어가 적용된 비동기 전송 (대용량 파일/이미지용)
   * @param {object} message
   * @param {function} [onProgress] - (sentChunks, totalChunks) => void
   * @returns {Promise<boolean>}
   */
  async sendAsync(message, onProgress) {
    return sendChunkedAsync(this.dataChannel, message, onProgress);
  }

  // 화면 공유 중지 처리
  _handleScreenShareStopped(message) {
    for (const [streamId, name] of this.screenTrackMap) {
      if (name === message.from) { this.screenTrackMap.delete(streamId); break; }
    }
  }

  // 재협상 이벤트 핸들러
  async _onNegotiationNeeded() {
    try {
      if (this.isNegotiating) {
        console.log('[Join] 이미 재협상 중, 무시');
        return;
      }

      // remoteDescription이 없으면 초기 연결 단계이므로 무시
      if (!this.pc.remoteDescription) {
        console.log('[Join] 초기 협상 단계, onnegotiationneeded 무시');
        return;
      }

      console.log('[Join] 🔄 재협상 필요 감지 (트랙 추가/제거)');
      await this.requestRenegotiation('track-added');
    } catch (error) {
      console.error('[Join] 재협상 요청 오류:', error);
      this.isNegotiating = false;
    }
  }

  async requestRenegotiation(reason = 'manual', iceRestart = false) {
    if (this.dataChannel?.readyState === 'open') {
      this.send({
        type: 'request-renegotiation',
        reason,
        iceRestart: Boolean(iceRestart)
      });
      console.log('[Join] Host에게 재협상 요청 전송, reason:', reason);
    } else {
      console.warn('[Join] DataChannel 닫힘 - 재협상 요청 불가');
    }
  }

  // 재협상 Offer 수신 처리
  async _handleRenegotiateOffer(message) {
    try {
      console.log('[Join] 재협상 Offer 적용 중...');
      this.isNegotiating = true;
      this._hasRemoteTrack = false;
      if (this._remoteTrackTimer) {
        clearTimeout(this._remoteTrackTimer);
        this._remoteTrackTimer = null;
      }

      await this.pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: message.sdp
      }));

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      console.log('[Join] 재협상 Answer 생성 완료');

      await waitForICE(this.pc);

      // DataChannel을 통해 Host에게 Answer 전송
      if (this.dataChannel?.readyState === 'open') {
        this.send({
          type: 'renegotiate-answer',
          sdp: this.pc.localDescription.sdp
        });
        console.log('[Join] 재협상 Answer를 DataChannel로 전송');
      }

      console.log('[Join] ✅ 재협상 완료!');
      this.isNegotiating = false;

      // 재협상 후 일정 시간 내 트랙이 안 오면 ICE Restart 재협상 요청 1회
      this._remoteTrackTimer = setTimeout(() => {
        if (!this._hasRemoteTrack) {
          console.warn('[Join] 원격 트랙 미수신 - ICE Restart 재협상 요청');
          this.requestRenegotiation('no-remote-track', true);
        }
      }, 2000);
    } catch (error) {
      console.error('[Join] 재협상 Offer 처리 오류:', error);
      this.isNegotiating = false;
    }
  }

  /**
   * 연결 종료
   */
  close() {
    console.log('[Join] 연결 종료');
    this.dataChannel?.close();
    this.pc?.close();
  }
}
