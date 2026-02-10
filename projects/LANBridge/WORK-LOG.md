# LANBridge Work Log

## 2026-02-08

### Session 1
- Added WORK-LOG.md for manual work tracking.
- Git init failed because Git is not installed on this machine.

### Session 2
- Updated host screen copy: "관리자" -> "채널".
- Removed host info box and "내 방 목록" section from the host UI.
- Cleared post-create status message so success/waiting text is no longer shown.

### Session 3
- Added screen sharing support for host and participant with split layout when both share.
- Wired screen share controls and video tiles into the chat UI.
- Added WebRTC video transceiver support and remote stream callbacks.

### Session 4
- Added screen share settings UI (resolution, frame rate, audio toggle).
- Enabled optional system audio and audio track handling in WebRTC.
- Hardened room switching when screen sharing is active.

### Session 5
- Added customizable screen share presets and custom resolution/frame rate inputs.
- Added audio-missing notice when system audio cannot be captured.
- Added screen share switch policy (auto stop vs keep sharing).

### Session 6
- Added share target selector (monitor/window/tab) with a selection hint.
- Added screen share surface mismatch notice handling.
- Restored "내 방 목록" section in host screen.
- Removed room info box from host screen (participant count, join URL display).

### Session 7 - Refactoring
- Removed unused Protocol class methods (generateMessageId, createMessage).
- Removed sessionId and myPeerId from app.js (not used in current implementation).
- Removed shareSurface selector and targetSurface logic (non-functional feature).
- Removed onScreenSurfaceMismatch callback.
- Unified notice function names (showAudioNotice → showScreenNotice).
- Removed screen-share-hint text.
- Cleaned up hostId from room creation API call.

### Session 8
- Fixed screen share security context error when accessing via HTTP LAN IP.
- Added navigator.mediaDevices check before calling getDisplayMedia.
- Displays user-friendly error guiding to use localhost or HTTPS.

### Session 11 - Server Graceful Shutdown
- Enhanced signal-server.js graceful shutdown handling:
  - Moved SIGINT/SIGTERM handlers outside promise chain
  - Added closeAllConnections() function with 5-second timeout
  - Properly clear intervals and resources on exit
- Improved launcher.js process termination:
  - Changed stopSignalServer to use SIGINT first, then SIGKILL (3s timeout)
  - Added error handling for kill operations
  - Better process cleanup

---

## 2026-02-09

### Session 12 - UI Refresh (Nebula Flow Theme)
- Task: Nebula Flow 테마 적용 및 UI 개선
- Changes:
  - 그라데이션 배경 (보라-파랑 계열)
  - 글라스모픽 카드 디자인
  - 상태 배지 (Live/Offline) 추가
  - 세션 정보 리본 UI 개선
  - 채팅 입력창을 textarea로 변경 (Shift+Enter 줄바꿈 지원)
  - 이미지 붙여넣기 기능 추가
  - 참여자 패널 접기/펼치기 기능
  - 스크롤 가능한 라운지 레이아웃

### Session 13 - WebRTC Connection Debugging & Signaling Module Extraction
- Task: 공유자와 참여자 간 연결 실패 문제 해결 및 통신 모듈 분리
- Root Cause: 
  - Answer SDP 저장/조회 로직 불일치 (404 오류)
  - signal-server.js에서 Answer 데이터 구조 처리 오류
  - Answer GET 요청이 202 상태코드 대신 200 + waiting 플래그 필요

- Changes to signal-server.js:
  - POST /api/room/:id/answer: `data.answer || data` 모두 수용하도록 수정
  - GET /api/room/:id/answer: 200 상태코드 + `waiting: true` 플래그로 변경
  - 향상된 로깅 (✅/❌ 이모지)

- New File Created: signaling.js
  - SignalingClient 클래스로 모든 시그널링 서버 통신 로직 분리
  - 11개 메서드: testConnection, createRoom, saveOffer, getOffer, saveAnswer, waitForAnswer, getRooms, joinRoom, deleteRoom, pingRoom, getRoomInfo
  - 완전한 에러 핸들링 및 로깅
  - 브라우저/Node.js 환경 모두 지원

- Changes to app.js:
  - this.signaling = null 추가
  - startAsHost: signaling.createRoom(), signaling.saveOffer() 사용
  - waitForAnswer: signaling.waitForAnswer() 단순화
  - searchRooms: signaling.getRooms() 사용
  - joinRoom: signaling.joinRoom(), signaling.getOffer(), signaling.saveAnswer() 사용
  - _startHostHeartbeat: signaling.pingRoom() 사용
  - _closeRoom: signaling.deleteRoom() 사용

- Changes to index.html:
  - <script src="signaling.js"></script> 추가 (line 1235)

- Current Issue (컴퓨터 재시작 전):
  - 브라우저에서 "SignalingClient is not defined" 오류 발생
  - 원인: 브라우저 캐시 문제 (서버는 200 OK로 정상 응답)
  - 파일 상태: signaling.js 존재 확인 (11,632 bytes, 2026-02-09 09:38:58)
  - 서버 테스트: curl로 확인 시 HTTP 200 OK 응답

### ⚠️ 재시작 후 작업 순서

1. **신호 서버 시작**
   ```powershell
   cd c:\porject\LANBridge
   node signal-server.js
   ```

2. **브라우저 캐시 완전 제거 후 테스트**
   - 방법 A: 시크릿 모드 (Ctrl + Shift + N)
   - 방법 B: Application 탭 → Clear storage → Clear site data
   - 방법 C: 브라우저 완전 재시작
   - URL: https://localhost:3000

3. **개발자 도구에서 확인**
   - F12 → Console 탭
   - `typeof SignalingClient` 입력 → "function" 나와야 함
   - Network 탭에서 signaling.js가 200 상태로 로드되는지 확인

4. **연결 테스트**
   - 호스트에서 방 생성 (공유자 이름: User, 방 제목: 공유방)
   - 다른 탭에서 참여자로 접속
   - Console에서 `[Signaling]` 로그 확인

### 핵심 파일 위치
- **c:\porject\LANBridge\signaling.js** - 새로 생성된 통신 모듈
- **c:\porject\LANBridge\signal-server.js** - Answer 핸들링 수정됨
- **c:\porject\LANBridge\app.js** - SignalingClient 사용하도록 리팩토링됨
- **c:\porject\LANBridge\index.html** - signaling.js 스크립트 추가됨

### 예상 결과
- 호스트 방 생성: `[Signaling] ✅ 방 생성 성공: [roomId]`
- 참여자 접속: `[Signaling] ✅ 참여자 등록 성공`
- Answer 교환: `[Signaling] ✅ Answer 수신 성공!`
- WebRTC 연결: `[HostConnection] Offer 생성 완료` → ICE 연결 성공

---

## Template

### Session X
- Task:
- Changes:
- Notes:
