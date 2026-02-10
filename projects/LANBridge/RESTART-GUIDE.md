# 🔄 재시작 후 작업 가이드 (2026-02-09)

## 📌 현재 상태

### ✅ 완료된 작업
1. **Nebula Flow UI 테마** - 그라데이션, 글라스모픽, 반응형 디자인 완료
2. **signaling.js 모듈** - 시그널링 서버 통신 로직 완전 분리 (11개 메서드)
3. **signal-server.js 수정** - Answer 핸들링 버그 수정 (200 + waiting 플래그)
4. **app.js 리팩토링** - SignalingClient 사용하도록 전면 개편
5. **index.html 업데이트** - signaling.js 스크립트 태그 추가

### ⚠️ 미해결 이슈
- **브라우저 캐시 문제**: "SignalingClient is not defined" 오류
- **원인**: 브라우저가 이전 버전을 캐시하고 있음
- **서버 상태**: 정상 (curl 테스트 시 200 OK)

---

## 🚀 재시작 후 실행 순서

### 1️⃣ 신호 서버 시작
```powershell
cd c:\porject\LANBridge
node signal-server.js
```

**기대 출력**:
```
🔐 HTTPS 인증서 로드 성공
✅ 시그널링 서버 시작됨: https://localhost:3000
```

---

### 2️⃣ 브라우저 캐시 제거

**가장 빠른 방법 - 시크릿 모드:**
1. **Ctrl + Shift + N** (Chrome/Edge)
2. `https://localhost:3000` 접속
3. 인증서 경고 → "고급" → "계속 진행"

**또는 기존 브라우저:**
1. **F12** 개발자 도구 열기
2. **Application** 탭
3. **Clear storage** → **Clear site data** 클릭
4. 페이지 새로고침 (**Ctrl + Shift + R**)

---

### 3️⃣ 정상 작동 확인

#### Console에서 확인:
```javascript
typeof SignalingClient
// 결과: "function" (정상)
```

#### Network 탭에서 확인:
- `signaling.js` - Status: **200**, Size: **11.6 kB**
- 404 오류가 없어야 함

---

### 4️⃣ 연결 테스트

#### 호스트 (공유자):
1. "공유자" 선택
2. 이름: `User`
3. 방 제목: `공유방`
4. 최대 참여자: `4명`
5. "방 개설" 클릭

**Console 로그 (정상):**
```
[Signaling] 서버 연결 성공
[Signaling] ✅ 방 생성 성공: [roomId]
[Signaling] ✅ Offer 저장 성공
[Signaling] Answer 대기 시작 (최대 5분)...
```

#### 참여자:
1. 새 탭 또는 시크릿 창 열기
2. `https://localhost:3000` 접속
3. "참여자" 선택
4. 방 목록에서 "공유방" 선택
5. 이름 입력 → "참여하기"

**Console 로그 (정상):**
```
[Signaling] ✅ 참여자 등록 성공
[Signaling] ✅ Offer 조회 성공
[Signaling] ✅ Answer 저장 성공
```

#### 호스트 측 (Answer 수신):
```
[Signaling] ✅ Answer 수신 성공!
[ICE] ICE 연결 상태: connected
[DataChannel] 데이터 채널 열림
```

---

## 📁 핵심 파일 위치

| 파일 | 경로 | 용도 |
|------|------|------|
| **signaling.js** | `c:\porject\LANBridge\signaling.js` | 시그널링 통신 모듈 (NEW) |
| **signal-server.js** | `c:\porject\LANBridge\signal-server.js` | HTTPS 시그널링 서버 |
| **app.js** | `c:\porject\LANBridge\app.js` | 메인 앱 로직 |
| **index.html** | `c:\porject\LANBridge\index.html` | UI (Nebula Flow) |
| **webrtc.js** | `c:\porject\LANBridge\webrtc.js` | WebRTC 연결 로직 |

---

## 🔍 디버깅 팁

### SignalingClient 정의되지 않음:
```javascript
// Console에서 확인
window.SignalingClient
// undefined면 캐시 문제 → 시크릿 모드 사용
```

### signaling.js 404 오류:
```powershell
# 파일 존재 확인
Get-ChildItem "c:\porject\LANBridge\signaling.js"

# 서버 테스트
curl.exe -k https://localhost:3000/signaling.js -I
```

### Answer 타임아웃:
- 참여자가 Answer를 제대로 저장했는지 확인
- Console에서 `[Signaling]` 로그 확인
- Network 탭에서 `/api/room/[id]/answer` POST 확인 (200 상태)

---

## 📊 시그널링 흐름

```
호스트                    시그널 서버                 참여자
  │                           │                        │
  ├─ createRoom() ────────────>│                        │
  │<─────── roomId ────────────┤                        │
  │                           │                        │
  ├─ saveOffer(offer) ────────>│                        │
  │                           │                        │
  ├─ waitForAnswer() ─────────>│                        │
  │   (폴링 시작)              │                        │
  │                           │<─── joinRoom() ─────────┤
  │                           │                        │
  │                           │<─── getOffer() ─────────┤
  │                           ├─────────────────────────>│
  │                           │                        │
  │                           │<─── saveAnswer(answer) ─┤
  │<─────── answer ────────────┤                        │
  │                           │                        │
  └─ [WebRTC P2P 연결 완료] ──┴──────────────────────────┘
```

---

## ✅ 성공 확인 체크리스트

- [ ] 서버 시작됨 (포트 3000)
- [ ] `https://localhost:3000` 접속 가능
- [ ] `typeof SignalingClient === "function"`
- [ ] signaling.js 로드 (200 OK)
- [ ] 호스트 방 생성 성공
- [ ] 참여자 접속 성공
- [ ] Answer 교환 성공
- [ ] ICE 연결 상태: `connected`
- [ ] 데이터 채널 열림
- [ ] 메시지 송수신 가능

---

## 🆘 문제 발생 시

1. **서버 재시작**:
   ```powershell
   # Node 프로세스 종료
   Get-Process node | Stop-Process -Force
   
   # 서버 재시작
   node signal-server.js
   ```

2. **완전 초기화**:
   - 브라우저 완전 종료 (작업 관리자에서 확인)
   - 시크릿 모드로 재접속

3. **로그 확인**:
   - 브라우저: F12 → Console
   - 서버: PowerShell 터미널 출력

---

**최종 업데이트**: 2026-02-09 09:45
**다음 작업**: 브라우저 캐시 제거 후 연결 테스트
