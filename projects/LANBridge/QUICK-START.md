# LANBridge 빠른 시작 가이드 (Windows)

## 📦 설치 및 실행

### 1️⃣ 준비 작업
- **필수 요구사항**: Windows PC + Node.js 설치
  - Node.js 다운로드: https://nodejs.org/ (LTS 버전 권장)
  - 설치 후 터미널에서 `node --version` 확인

### 2️⃣ LANBridge 설정

1. **ZIP 파일 추출**
   - `LANBridge-portable.zip` 을 특정 폴더에 추출 (예: `C:\LANBridge`)

2. **dependencies 설치 (최초 1회만)**
   ```
   start.bat 더블클릭
   ```
   - 또는 터미널에서: `npm install`
   - 필요한 패키지가 자동 설치됨

### 3️⃣ 서버 시작
```
start.bat 더블클릭
```

**또는 터미널에서:**
```powershell
node launcher.js
```

**성공 메시지:**
```
✅ Starting LANBridge Launcher on port 9100
✅ LAN IP: 192.168.x.x
✅ Access at: http://192.168.x.x:9100
```

---

## 🎮 실행 방법

### 방법 1️⃣: GUI(권장)
1. `start.bat` 더블클릭
2. 브라우저에서 표시된 URL 방문
3. "서버 시작" 버튼 클릭
4. 상태가 "🟢 실행 중" 으로 변경되는지 확인

### 방법 2️⃣: 명령어 라인
```powershell
cd C:\LANBridge  # 추출한 폴더로 이동
npm install      # 처음 실행시만
node launcher.js # 서버 시작
```

---

## 📱 다른 기기에서 접속

### Windows/Mac/Linux 클라이언트
- 같은 WiFi 네트워크 연결
- 브라우저에서 접속: `http://[서버의 LAN IP]:9100`
  - 예: `http://192.168.1.100:9100`

### 스마트폰 (iOS/Android)
- 같은 WiFi 네트워크 연결
- Safari(iOS) 또는 Chrome(Android)에서 `http://[서버의 LAN IP]:9100` 접속
- 참고: p2p-mobile 앱 설치 시 더 나은 성능

---

## 🔧 트러블슈팅

### ❌ "node is not recognized" 오류
- **원인**: Node.js 설치 안 됨 또는 경로 설정 안 됨
- **해결**: 
  1. Node.js 설치: https://nodejs.org/
  2. PC 재부팅
  3. 터미널 재시작 후 재시도

### ❌ "포트 9100 이미 사용 중" 오류
- **원인**: 다른 프로그램이 포트 9100 사용 중
- **해결**:
  ```powershell
  # 포트 제거-process -Id (Get-NetTCPConnection -LocalPort 9100).OwningProcess -Force
  ```
  또는 다른 포트 설정 (launcher.js 수정)

### ❌ 다른 기기에서 접속 안 됨
- **점검 사항**:
  1. 같은 WiFi 네트워크인지 확인
  2. 방화벽에서 포트 9100 허용하는지 확인
  3. 서버 PC의 LAN IP 주소 다시 확인 (터미널에 표시됨)

---

## 📊 포트 정보

| 포트 | 용도 | URL |
|------|------|-----|
| **9100** | 제어판(Control UI) | http://[IP]:9100 |
| **3000** | Signal Server (자동 시작) | http://[IP]:3000 |

---

## 📝 주요 파일

```
LANBridge/
├── start.bat              ← ⭐ 여기서 시작
├── launcher.js            ← 제어판 서버
├── signal-server.js       ← 신호 중계 서버
├── launcher.html          ← 웹 UI
├── app.js                 ← 클라이언트 앱
├── webrtc.js              ← P2P 연결 로직
└── package.json           ← 의존성 목록
```

---

## ⚡ 빠른 참고

- **시작**: `start.bat` 더블클릭
- **중지**: Ctrl+C (터미널에서) 또는 "서버 중지" 버튼 (GUI)
- **IP 확인**: 터미널에 표시됨 (192.168.x.x)
- **모바일**: 같은 WiFi에서 브라우저로 http://[IP]:9100 방문

---

## 📞 문제 해결 체크리스트

- [ ] Node.js 설치됨 (`node --version` 확인)
- [ ] ZIP 파일 완전히 추출됨
- [ ] `start.bat` 또는 `npm install` 실행 후 node_modules 폴더 생성됨
- [ ] 터미널에서 LAN IP 확인됨
- [ ] 방화벽에서 포트 9100 허용됨
- [ ] 다른 기기가 같은 WiFi 네트워크에 연결됨

---

**Need help?** 
- 로그 확인: 터미널 출력 메시지 보기
- 재시작: 터미널 종료 후 `start.bat` 다시 실행
- 업데이트: 최신 버전에서 다시 ZIP 다운로드
