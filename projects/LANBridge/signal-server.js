#!/usr/bin/env node

/**
 * LANBridge Signal Server
 * 역할: 방 관리, SDP 중계, 참여자 발견
 * 
 * 엔드포인트:
 * - GET  /health              : 서버 상태 확인
 * - GET  /api/rooms           : 활성 방 목록 조회
 * - POST /api/room/create     : 방 생성
 * - POST /api/room/:id/offer  : Offer 저장
 * - GET  /api/room/:id/offer  : Offer 조회
 * - POST /api/room/:id/answer : Answer 저장
 * - GET  /api/room/:id/answer : Answer 조회
 * - POST /api/room/:id/join   : 참여자 등록
 * - DELETE /api/room/:id      : 방 폐쇄
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const USE_HTTPS = process.env.HTTPS !== 'false'; // 기본값: HTTPS 사용
const ROOM_TTL_MS = 300000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60000; // 1 minute
const SHUTDOWN_TIMEOUT = 5000; // 5초 내 종료 강제
const ALLOWED_PARTICIPANT_SIZES = [2, 4, 8, 16];

// 활성 방 저장소 (메모리)
const rooms = new Map();
let server = null; // 전역 서버 인스턴스

function generateRoomId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 응답 전송 헬퍼 함수
 * @param {http.ServerResponse} res - 응답 객체
 * @param {number} statusCode - HTTP 상태 코드
 * @param {object} data - 응답 JSON 데이터
 */
function sendResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

/**
 * 요청 본문 파싱
 * @param {http.IncomingMessage} req - 요청 객체
 * @returns {Promise<string>} 본문 데이터
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// 서버 요청 핸들러
async function requestHandler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `https://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  console.log(`[Signal] ${req.method} ${pathname}`);

  try {
    // ============================================
    // GET /health - 헬스 체크
    // ============================================
    if (pathname === '/health' && req.method === 'GET') {
      sendResponse(res, 200, { 
        success: true, 
        message: 'Signal Server is running' 
      });
      return;
    }

    // ============================================
    // GET /api/status - 서버 상태 조회 (관리 패널용)
    // ============================================
    if (pathname === '/api/status' && req.method === 'GET') {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      let lanIP = 'localhost';
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            lanIP = iface.address;
            break;
          }
        }
      }
      sendResponse(res, 200, {
        running: true,
        managed: true,
        port: PORT,
        localUrl: `localhost:${PORT}`,
        lanUrl: `${lanIP}:${PORT}`
      });
      return;
    }

    // ============================================
    // POST /api/room/create - 공유자: 방 생성
    // ============================================
    if (pathname === '/api/room/create' && req.method === 'POST') {
      const body = await parseBody(req);
      const data = JSON.parse(body);

      if (!data.hostName) {
        return sendResponse(res, 400, { 
          success: false, 
          error: '필수 필드: hostName' 
        });
      }

      const roomId = generateRoomId().substring(0, 8).toUpperCase();
      const roomTitle = (data.roomTitle || '').trim() || `${data.hostName}의 방`;
      let maxParticipants = parseInt(data.maxParticipants, 10);
      if (!ALLOWED_PARTICIPANT_SIZES.includes(maxParticipants)) {
        maxParticipants = 4;
      }
      
      rooms.set(roomId, {
        id: roomId,
        hostName: data.hostName,
        roomTitle: roomTitle,
        maxParticipants: maxParticipants,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        offer: null,
        answer: null,
        participants: [data.hostName],
        pendingParticipants: [],
        peerOffers: {},
        peerAnswers: {}
      });

      console.log(`[Signal] 방 생성: ${roomId}, 방장: ${data.hostName}, 제목: ${roomTitle}, 최대인원: ${maxParticipants}명`);
      sendResponse(res, 201, { 
        success: true, 
        roomId,
        expiresIn: 3600000 
      });
      return;
    }

    // ============================================
    // GET /api/rooms - 참여자: 활성 방 목록 조회
    // ============================================
    if (pathname === '/api/rooms' && req.method === 'GET') {
      const now = Date.now();
      const roomList = Array.from(rooms.values())
        .filter(room => now - room.lastSeen <= ROOM_TTL_MS)
        .map(room => ({
        id: room.id,
        hostName: room.hostName,
        roomTitle: room.roomTitle,
        maxParticipants: room.maxParticipants,
        createdAt: room.createdAt,
        participants: room.participants.length,
        participantNames: room.participants
      }));

      console.log(`[Signal] 방 목록 조회: ${roomList.length}개`);
      sendResponse(res, 200, { 
        success: true, 
        rooms: roomList 
      });
      return;
    }

    // ============================================
    // Per-participant signaling (다중 피어 지원)
    // ============================================

    // DELETE /api/room/:roomId/participant/:name - 참여자 제거 (호스트가 호출)
    if (pathname.match(/^\/api\/room\/[^/]+\/participant\//) && req.method === 'DELETE') {
      const parts = pathname.split('/');
      const roomId = parts[3];
      const name = decodeURIComponent(parts[5]);
      const room = rooms.get(roomId);
      if (!room) return sendResponse(res, 404, { success: false, error: '방을 찾을 수 없습니다' });
      room.participants = (room.participants || []).filter(n => n !== name);
      room.pendingParticipants = (room.pendingParticipants || []).filter(n => n !== name);
      if (room.peerOffers) delete room.peerOffers[name];
      if (room.peerAnswers) delete room.peerAnswers[name];
      room.lastSeen = Date.now();
      console.log(`[Signal] 참여자 제거: ${roomId}, ${name}, 남은 ${room.participants.length}명`);
      return sendResponse(res, 200, { success: true, participantCount: room.participants.length });
    }

    // GET /api/room/:roomId/pending - 대기 중인 참여자 조회 (호스트 폴링)
    if (pathname.startsWith('/api/room/') && pathname.endsWith('/pending') && req.method === 'GET') {
      const roomId = pathname.split('/')[3];
      const room = rooms.get(roomId);
      if (!room) return sendResponse(res, 404, { success: false, error: '방을 찾을 수 없습니다' });
      room.lastSeen = Date.now();
      sendResponse(res, 200, { success: true, pending: room.pendingParticipants || [] });
      return;
    }

    // Per-participant offer/answer: /api/room/:id/peer/:name/offer|answer
    const peerParts = pathname.split('/');
    if (peerParts.length === 7 && peerParts[1] === 'api' && peerParts[2] === 'room' && peerParts[4] === 'peer') {
      const roomId = peerParts[3];
      const peerName = decodeURIComponent(peerParts[5]);
      const action = peerParts[6];
      const room = rooms.get(roomId);

      if (!room) {
        return sendResponse(res, 404, { success: false, error: '방을 찾을 수 없습니다' });
      }
      room.lastSeen = Date.now();

      // POST /api/room/:id/peer/:name/offer (호스트가 참여자별 Offer 저장)
      if (action === 'offer' && req.method === 'POST') {
        const body = await parseBody(req);
        const data = JSON.parse(body);
        if (!room.peerOffers) room.peerOffers = {};
        room.peerOffers[peerName] = data.offer || data;
        // 새 Offer 저장 시 기존 Answer 삭제 (재시도 시 stale Answer 방지)
        if (room.peerAnswers) delete room.peerAnswers[peerName];
        console.log(`[Signal] ✅ Peer Offer 저장: ${roomId} → ${peerName}`);
        return sendResponse(res, 200, { success: true });
      }

      // GET /api/room/:id/peer/:name/offer (참여자가 자기 Offer 조회)
      if (action === 'offer' && req.method === 'GET') {
        if (!room.peerOffers?.[peerName]) {
          return sendResponse(res, 200, { success: false, waiting: true, error: 'Offer 준비 중' });
        }
        console.log(`[Signal] Peer Offer 조회: ${roomId} → ${peerName}`);
        return sendResponse(res, 200, { success: true, offer: room.peerOffers[peerName] });
      }

      // POST /api/room/:id/peer/:name/answer (참여자가 Answer 저장)
      if (action === 'answer' && req.method === 'POST') {
        const body = await parseBody(req);
        const data = JSON.parse(body);
        if (!room.peerAnswers) room.peerAnswers = {};
        room.peerAnswers[peerName] = data.answer || data;
        console.log(`[Signal] ✅ Peer Answer 저장: ${roomId} → ${peerName}`);
        return sendResponse(res, 200, { success: true });
      }

      // GET /api/room/:id/peer/:name/answer (호스트가 참여자 Answer 조회)
      if (action === 'answer' && req.method === 'GET') {
        if (!room.peerAnswers?.[peerName]) {
          return sendResponse(res, 200, { success: false, waiting: true, error: 'Answer 준비 중' });
        }
        const answer = room.peerAnswers[peerName];
        console.log(`[Signal] Peer Answer 조회: ${roomId} → ${peerName}`);
        return sendResponse(res, 200, { success: true, answer });
      }

      return sendResponse(res, 400, { success: false, error: '잘못된 peer 요청' });
    }

    // ============================================
    // POST /api/room/:roomId/offer - 공유자: Offer 설정 (레거시 1:1)
    // ============================================
    if (pathname.startsWith('/api/room/') && pathname.endsWith('/offer') && req.method === 'POST') {
      const roomId = pathname.split('/')[3];
      const body = await parseBody(req);
      const data = JSON.parse(body);
      const room = rooms.get(roomId);
      
      if (!room) {
        return sendResponse(res, 404, { 
          success: false, 
          error: '방을 찾을 수 없습니다' 
        });
      }

      room.offer = data.offer || data;
      room.lastSeen = Date.now();
      console.log(`[Signal] Offer 저장: ${roomId}`);
      sendResponse(res, 200, { success: true });
      return;
    }

    // ============================================
    // GET /api/room/:roomId/offer - 참여자: Offer 조회
    // ============================================
    if (pathname.startsWith('/api/room/') && pathname.endsWith('/offer') && req.method === 'GET') {
      const roomId = pathname.split('/')[3];
      const room = rooms.get(roomId);
      
      if (!room) {
        return sendResponse(res, 404, { 
          success: false, 
          error: '방을 찾을 수 없습니다' 
        });
      }

      if (!room.offer) {
        return sendResponse(res, 202, { 
          success: false, 
          error: '아직 Offer가 준비되지 않았습니다' 
        });
      }

      room.lastSeen = Date.now();
      console.log(`[Signal] Offer 조회: ${roomId}`);
      sendResponse(res, 200, { success: true, offer: room.offer });
      return;
    }

    // ============================================
    // POST /api/room/:roomId/join - 참여자 등록
    // ============================================
    if (pathname.startsWith('/api/room/') && pathname.endsWith('/join') && req.method === 'POST') {
      const roomId = pathname.split('/')[3];
      const body = await parseBody(req);
      const data = JSON.parse(body);
      const room = rooms.get(roomId);
      
      if (!room) {
        return sendResponse(res, 404, { 
          success: false, 
          error: '방을 찾을 수 없습니다' 
        });
      }

      if (!data.participantName) {
        return sendResponse(res, 400, { 
          success: false, 
          error: '필수 필드: participantName' 
        });
      }

      // 이름 중복 → 재연결로 처리 (기존 시그널링 데이터 초기화)
      if (room.participants.includes(data.participantName)) {
        // 기존 Offer/Answer 삭제 (새로운 핸드셰이크)
        if (room.peerOffers) delete room.peerOffers[data.participantName];
        if (room.peerAnswers) delete room.peerAnswers[data.participantName];
        // pendingParticipants에서 제거 후 다시 추가
        room.pendingParticipants = (room.pendingParticipants || []).filter(n => n !== data.participantName);
        room.pendingParticipants.push(data.participantName);
        room.lastSeen = Date.now();
        console.log(`[Signal] 참여자 재연결(대기): ${roomId}, ${data.participantName}, 총 ${room.participants.length}/${room.maxParticipants}명`);
        return sendResponse(res, 200, { 
          success: true, 
          participantCount: room.participants.length,
          rejoin: true
        });
      }

      // 최대 참여자 수 확인
      if (room.participants.length >= room.maxParticipants) {
        return sendResponse(res, 409, { 
          success: false, 
          error: '방 인원이 가득 찼습니다',
          code: 'ROOM_FULL',
          maxParticipants: room.maxParticipants,
          currentParticipants: room.participants.length
        });
      }

      room.participants.push(data.participantName);
      if (!room.pendingParticipants) room.pendingParticipants = [];
      room.pendingParticipants.push(data.participantName);
      room.lastSeen = Date.now();
      
      console.log(`[Signal] 참여자 추가(대기): ${roomId}, ${data.participantName}, 총 ${room.participants.length}/${room.maxParticipants}명`);
      sendResponse(res, 200, { 
        success: true, 
        participantCount: room.participants.length 
      });
      return;
    }

    // ============================================
    // POST /api/room/:roomId/answer - 참여자: Answer 설정
    // ============================================
    if (pathname.startsWith('/api/room/') && pathname.endsWith('/answer') && req.method === 'POST') {
      const roomId = pathname.split('/')[3];
      const body = await parseBody(req);
      const data = JSON.parse(body);
      const room = rooms.get(roomId);
      
      if (!room) {
        console.error(`[Signal] Answer 저장 실패: 방 ${roomId}를 찾을 수 없음`);
        return sendResponse(res, 404, { 
          success: false, 
          error: '방을 찾을 수 없습니다' 
        });
      }

      // answer 필드 추출 (중첩 구조 지원)
      const answer = data.answer || data;
      
      if (!answer || !answer.type || !answer.sdp) {
        console.error(`[Signal] Answer 저장 실패: 올바르지 않은 Answer 형식`, data);
        return sendResponse(res, 400, { 
          success: false, 
          error: 'Answer 형식이 올바르지 않습니다' 
        });
      }

      room.answer = answer;
      room.lastSeen = Date.now();
      console.log(`[Signal] ✅ Answer 저장 성공: ${roomId}, 참여자: ${data.participantName || 'unknown'}`);
      sendResponse(res, 200, { success: true });
      return;
    }

    // ============================================
    // GET /api/room/:roomId/answer - 공유자: Answer 조회
    // ============================================
    if (pathname.startsWith('/api/room/') && pathname.endsWith('/answer') && req.method === 'GET') {
      const roomId = pathname.split('/')[3];
      const room = rooms.get(roomId);
      
      if (!room) {
        console.error(`[Signal] Answer 조회 실패: 방 ${roomId}를 찾을 수 없음`);
        return sendResponse(res, 404, { 
          success: false, 
          error: '방을 찾을 수 없습니다' 
        });
      }

      if (!room.answer) {
        // 202 대신 200으로 반환하되 success: false로 구분
        return sendResponse(res, 200, { 
          success: false, 
          waiting: true,
          error: '아직 Answer가 준비되지 않았습니다' 
        });
      }

      room.lastSeen = Date.now();
      console.log(`[Signal] ✅ Answer 조회 성공: ${roomId}`);
      sendResponse(res, 200, { success: true, answer: room.answer });
      return;
    }

    // ============================================
    // POST /api/room/:roomId/ping - 방 상태 유지
    // ============================================
    if (pathname.startsWith('/api/room/') && pathname.endsWith('/ping') && req.method === 'POST') {
      const roomId = pathname.split('/')[3];
      const room = rooms.get(roomId);

      if (!room) {
        return sendResponse(res, 404, {
          success: false,
          error: '방을 찾을 수 없습니다'
        });
      }

      room.lastSeen = Date.now();
      sendResponse(res, 200, { success: true });
      return;
    }

    // ============================================
    // DELETE /api/room/:roomId - 방장: 방 폐쇄
    // ============================================
    if (pathname.startsWith('/api/room/') && req.method === 'DELETE') {
      const parts = pathname.split('/');
      if (parts.length === 4 && parts[2] === 'room') {
        const roomId = parts[3];
        const room = rooms.get(roomId);
        
        if (!room) {
          return sendResponse(res, 404, { 
            success: false, 
            error: '방을 찾을 수 없습니다' 
          });
        }

        rooms.delete(roomId);
        console.log(`[Signal] 방 폐쇄: ${roomId}, 방장: ${room.hostName}`);
        sendResponse(res, 200, { 
          success: true, 
          message: '방이 폐쇄되었습니다' 
        });
        return;
      }
    }

    // ============================================
    // GET /api/room/:roomId - 방 정보 조회
    // ============================================
    if (pathname.startsWith('/api/room/') && req.method === 'GET') {
      const roomId = pathname.split('/')[3];
      const room = rooms.get(roomId);
      
      if (!room) {
        return sendResponse(res, 404, { 
          success: false, 
          error: '방을 찾을 수 없습니다' 
        });
      }

      // 조회 시에도 lastSeen 갱신 (참여자 폴링으로 방 유지)
      room.lastSeen = Date.now();

      sendResponse(res, 200, { 
        success: true, 
        room: {
          id: room.id,
          hostName: room.hostName,
          roomTitle: room.roomTitle,
          maxParticipants: room.maxParticipants,
          createdAt: room.createdAt,
          participants: room.participants
        }
      });
      return;
    }

    // ============================================
    // GET /admin - 관리자 패널
    // ============================================
    if ((pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/index.html') && req.method === 'GET') {
      const adminPath = path.join(__dirname, 'launcher.html');
      fs.readFile(adminPath, 'utf8', (err, html) => {
        if (err) {
          return sendResponse(res, 500, { success: false, error: 'launcher.html 로드 실패' });
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }

    // ============================================
    // GET /, /index - 앱 페이지
    // ============================================
    if ((pathname === '/' || pathname === '/index' || pathname === '/index.html') && req.method === 'GET') {
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, 'utf8', (err, html) => {
        if (err) {
          return sendResponse(res, 500, { success: false, error: 'index.html 로드 실패' });
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }

    // ============================================
    // GET /status - 상태 페이지
    // ============================================
    if (pathname === '/status' && req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.writeHead(200);
      res.end(`
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LANBridge Signal Server</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 { color: #667eea; margin-bottom: 20px; }
        .status { 
            background: #dcfce7; 
            border-left: 4px solid #10b981;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-weight: 600;
            color: #059669;
        }
        .info { 
            background: #f0f4ff;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 14px;
        }
        .info strong { color: #667eea; }
        .endpoints {
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            line-height: 1.8;
        }
        code {
            background: white;
            padding: 2px 6px;
            border-radius: 3px;
            color: #667eea;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎛️ LANBridge Signal Server</h1>
        <div class="status">✅ 서버 정상 실행 중</div>
        <div class="info">
            <strong>포트:</strong> ${PORT}<br>
            <strong>활성 방:</strong> ${rooms.size}개<br>
            <strong>시작 시간:</strong> ${new Date().toLocaleString('ko-KR')}
        </div>
        <h3 style="margin-bottom: 10px; color: #333;">API 엔드포인트</h3>
        <div class="endpoints">
            <div>GET  <code>/health</code> - 서버 상태 확인</div>
            <div>GET  <code>/api/rooms</code> - 활성 방 목록</div>
            <div>POST <code>/api/room/create</code> - 방 생성</div>
            <div>POST <code>/api/room/:id/offer</code> - Offer 제출</div>
            <div>GET  <code>/api/room/:id/offer</code> - Offer 조회</div>
            <div>POST <code>/api/room/:id/answer</code> - Answer 제출</div>
            <div>GET  <code>/api/room/:id/answer</code> - Answer 조회</div>
        </div>
    </div>
</body>
</html>
      `);
      return;
    }

    // ============================================
    // 정적 파일 제공 (JS, CSS 등)
    // ============================================
    const allowedExtensions = ['.js', '.css', '.html'];
    const ext = path.extname(pathname);

    if (allowedExtensions.includes(ext) && req.method === 'GET') {
      const safePath = pathname.replace(/^\/+/, '');
      const staticRoots = [__dirname, process.cwd()];
      let filePath = null;

      for (const root of staticRoots) {
        const candidatePath = path.normalize(path.join(root, safePath));
        if (!candidatePath.startsWith(root)) {
          continue;
        }
        if (fs.existsSync(candidatePath)) {
          filePath = candidatePath;
          break;
        }
      }

      if (!filePath) {
        return sendResponse(res, 404, { success: false, error: '파일을 찾을 수 없습니다' });
      }

      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          return sendResponse(res, 404, { success: false, error: '파일을 읽을 수 없습니다' });
        }

        const contentTypes = {
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.html': 'text/html; charset=utf-8'
        };

        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    // 404
    sendResponse(res, 404, { 
      success: false, 
      error: '경로를 찾을 수 없습니다' 
    });

  } catch (error) {
    console.error('[Signal] 서버 오류:', error.message);
    sendResponse(res, 500, { 
      success: false, 
      error: '서버 내부 오류: ' + error.message 
    });
  }
}

// HTTP/HTTPS 서버 생성
async function createServer() {
  let server;
  
  if (USE_HTTPS) {
    const certPath = path.join(__dirname, 'certs', 'server.crt');
    const keyPath = path.join(__dirname, 'certs', 'server.key');
    
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      server = https.createServer(options, requestHandler);
      console.log('[Signal] 🔒 HTTPS 모드로 실행');
    } else {
      console.warn('[Signal] ⚠️  인증서 파일을 찾을 수 없습니다.');
      console.log('[Signal] 🔄 자동으로 인증서를 생성합니다...\n');
      
      try {
        const { generateCertificate } = require('./generate-cert.js');
        const success = await generateCertificate();
        
        if (success && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
          const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
          };
          server = https.createServer(options, requestHandler);
          console.log('[Signal] 🔒 HTTPS 모드로 실행 (인증서 자동 생성됨)');
        } else {
          console.warn('[Signal] ⚠️  인증서 생성 실패. HTTP 모드로 실행합니다.');
          server = http.createServer(requestHandler);
        }
      } catch (error) {
        console.error('[Signal] 인증서 생성 오류:', error.message);
        console.warn('[Signal] HTTP 모드로 실행합니다.');
        server = http.createServer(requestHandler);
      }
    }
  } else {
    server = http.createServer(requestHandler);
    console.log('[Signal] 🔓 HTTP 모드로 실행 (HTTPS=false)');
  }
  
  return server;
}

createServer().then(server => {
  server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIP = 'localhost';
    
    // LAN IP 찾기
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address;
          break;
        }
      }
    }

    console.log(`
╔═══════════════════════════════════════════╗
║     LANBridge P2P Signal Server          ║
║     (Local WiFi Network Only)             ║
╠═══════════════════════════════════════════╣
║  📍 접속 주소:                             ║
║     🔒 https://localhost:${PORT.toString().padEnd(18)} ║
║     🔒 https://${localIP}:${PORT.toString().padEnd(18)} ║
║                                           ║
║  💡 같은 WiFi에 연결된 PC들만 접속 가능    ║
║  ⚠️  첫 접속 시 인증서 경고 → '계속'       ║
╚═══════════════════════════════════════════╝
    `);
  });

  // 서버 에러 처리
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[Signal] ❌ 포트 ${PORT}이(가) 이미 사용 중입니다.`);
      console.error(`[Signal] 해결 방법:`);
      console.error(`  1. 다른 Signal Server 프로세스 종료:`);
      console.error(`     netstat -ano | findstr :${PORT}  (Windows)`);
      console.error(`     lsof -i :${PORT}               (Mac/Linux)`);
      console.error(`  2. 포트 변경: PORT=3001 node signal-server.js`);
    } else {
      console.error(`[Signal] ❌ 서버 오류:`, error.message);
    }
    process.exit(1);
  });

// 정기적 방 정리 (하트비트 끊긴 방 삭제)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let deleted = 0;
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastSeen > ROOM_TTL_MS) {
      rooms.delete(roomId);
      deleted++;
    }
  }
  if (deleted > 0) {
    console.log(`[Signal] ${deleted}개의 비활성 방 삭제됨`);
  }
}, CLEANUP_INTERVAL_MS);

// 모든 연결 종료
function closeAllConnections() {
  server.close(() => {
    clearInterval(cleanupInterval);
    console.log('[Signal] ✅ 서버 종료됨');
    process.exit(0);
  });
  
  // 5초 타임아웃 - 강제 종료
  setTimeout(() => {
    console.error('[Signal] ⚠️  강제 종료됩니다 (타임아웃)');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Signal] 서버 종료 중...');
  closeAllConnections();
});

process.on('SIGTERM', () => {
  console.log('\n[Signal] 서버 종료 요청됨');
  closeAllConnections();
});

}).catch(error => {
  console.error('[Signal] ❌ 서버 생성 실패:', error.message);
  process.exit(1);
});