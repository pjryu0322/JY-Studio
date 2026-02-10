# LANBridge 배포 패키지 안내

## 🎁 배포 파일

### 주배포 파일
- **`LANBridge-portable.zip`** (81 KB)
  - 모든 필요한 소스 코드 포함
  - Node.js만 있으면 실행 가능
  - 추가 설치/설정 불필요

---

## 📋 다른 PC 사용자에게 전달할 내용

### 1️⃣ 필수 준비물
- **Node.js LTS 버전** 설치
  - 다운로드: https://nodejs.org/
  - 설치 후 재부팅

### 2️⃣ 설치 방법
1. `LANBridge-portable.zip` 다운로드
2. 원하는 폴더에 압축해제
   - 예: `C:\LANBridge`
3. `start.bat` 더블클릭 (또는 `npm install` → `node launcher.js`)

### 3️⃣ 실행
- `start.bat` 더블클릭
- 브라우저에서 표시된 URL 방문
- "서버 시작" 버튼 클릭

---

## 📦 패키지 내용

```
LANBridge-portable.zip 포함 파일:
├── 코어 파일
│   ├── main.js              - Electron 메인 프로세스
│   ├── preload.js           - Electron 보안 레이어
│   ├── launcher.js          - 제어판 서버 (포트 9100)
│   ├── signal-server.js     - 신호 중계 서버 (포트 3000)
│   ├── app.js               - P2P 클라이언트 애플리케이션
│   ├── webrtc.js            - WebRTC 연결 로직
│   └── protocol.js          - 프로토콜 정의
│
├── UI 파일
│   ├── launcher.html        - 제어판 웹 인터페이스
│   ├── index.html           - 메인 페이지
│   └── style.css            - 스타일시트
│
├── 설정 파일
│   ├── package.json         - 의존성 목록
│   ├── package-lock.json    - 의존성 락 파일
│   └── README.md            - 프로젝트 README
│
└── 런처
    └── start.bat            - Windows 실행 스크립트
```

---

## 🌐 포트 정보

| 포트 | 서비스 | 용도 |
|------|--------|------|
| **9100** | Launcher UI | 제어판 웹 인터페이스 |
| **3000** | Signal Server | 신호 중계/SDP 릴레이 |

---

## 🔍 실행 후 확인사항

### 성공 기준
✅ 터미널에 다음과 같은 메시지 표시:
```
✅ LANBridge Launcher started on port 9100
✅ LAN IP: 192.168.x.x (또는 실제 IP)
✅ Access at: http://192.168.x.x:9100
```

✅ 브라우저에서 `http://localhost:9100` 접속 시 제어판 UI 표시

✅ "서버 시작" 버튼 클릭 시 Signal Server 자동 시작

### 포트 확인 (Windows)
```powershell
# 포트 9100 사용 중인지 확인
netstat -ano | findstr :9100

# 포트가 사용 중이면 다음으로 프로세스 종료
Stop-Process -Id [PID] -Force
```

---

## 🔧 고급 설정

### 포트 변경 (필요시)
`launcher.js` 파일에서:
```javascript
const PORT = 9100;  // 이 숫자 변경
```

### Signal Server 수동 실행
```powershell
node signal-server.js
```

---

## 📱 모바일 클라이언트 연결

### 같은 WiFi 네트워크의 스마트폰
1. 서버 PC의 LAN IP 확인
2. 모바일 브라우저에서 `http://[서버IP]:9100` 방문
3. P2P 기능 사용

### 권장 브라우저
- iOS Safari
- Android Chrome

---

## ⚠️ 주의사항

1. **방화벽 허용**: Windows 방화벽에서 포트 9100, 3000 허용
2. **WiFi 네트워크**: 모든 클라이언트가 같은 WiFi 네트워크에 연결되어야 함
3. **서버 유지**: 서버 PC는 항상 켜져있어야 다른 기기에서 접속 가능
4. **IP 기반 접속**: DNS가 없으므로 IP 주소로 직접 접속

---

## 🆘 트러블슈팅

### Q: Node.js 설치 후에도 "node is not recognized" 오류
**A**: PC 재부팅 후 터미널 재시작

### Q: 포트가 이미 사용 중
**A**: launcher.js에서 포트 번호 변경 또는 다른 프로세스 종료

### Q: 다른 기기에서 IP로 접속 불가
**A**: 
- 방화벽 설정 확인
- 같은 WiFi 네트워크 확인
- IP 주소 올바른지 재확인

### Q: 자자 Signal Server가 안 시작됨
**A**: 터미널에서 수동으로 `node signal-server.js` 실행

---

## 📥 배포 방법

### 옵션 1: 직접 전달
- USB 드라이브에 ZIP 파일 복사
- 상대방에게 전달

### 옵션 2: 클라우드 공유
- Google Drive, OneDrive, Dropbox 등에 업로드
- 다운로드 링크 공유

### 옵션 3: 이메일
- ZIP 파일 첨부 (81 KB - 충분히 작음)

---

## 📋 배포 체크리스트

- [ ] LANBridge-portable.zip 생성됨 (81 KB)
- [ ] QUICK-START.md 함께 제공
- [ ] 상대방이 Node.js 설치 했는지 확인
- [ ] ZIP 전달 방법 결정 (USB/클라우드/이메일)
- [ ] 상대방이 zip 완전히 추출했는지 확인
- [ ] 상대방이 start.bat 실행 후 성공 메시지 확인했는지 확인

---

**배포 준비 완료!** ✅

이제 `LANBridge-portable.zip`을 공유하세요. 상대방은 `start.bat`을 더블클릭하기만 하면 됩니다.
