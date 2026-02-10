# ⚡ LANBridge Electron 변환 완료!

**축하합니다!** LANBridge가 Electron 데스크톱 앱으로 변환되었습니다. 🎉

## 📦 변경 사항 요약

### 새로운 파일

| 파일 | 용도 |
|------|------|
| `main.js` | Electron 메인 프로세스 (앱 생명주기, IPC 관리) |
| `preload.js` | 보안 샌드박스 (Renderer ↔ Main 통신) |
| `build.js` | 빌드 자동화 스크립트 |
| `init.js` | 프로젝트 초기화 및 검사 스크립트 |
| `launcher.html` | Electron 네이티브 UI (titlebar, 그래디언트 등) |
| `ELECTRON-BUILD.md` | 상세 빌드 가이드 |

### 업데이트된 파일

| 파일 | 변경 사항 |
|------|---------|
| `package.json` | electron, electron-builder 추가, scripts 업데이트 |
| `launcher.html` | 네이티브 윈도우 제어 (minimize, maximize, close) 추가 |

### 새로운 디렉토리

```
LANBridge/
└── assets/          ← 앱 아이콘 저장 디렉토리
```

## 🚀 빠른 시작 (5단계)

### 1️⃣ 의존성 설치

```bash
cd LANBridge
npm install
```

**소요 시간:** 5-10분 (처음만)  
**다운로드:** ~200MB (electron + electron-builder)

### 2️⃣ 개발 모드 테스트

```bash
npm start
```

또는

```bash
npm run dev    # 개발자 도구 활성화
```

**결과:** 네이티브 Electron 앱 윈도우 표시

### 3️⃣ 기능 테스트

앱 실행 후:
1. ✅ "서버 시작" 버튼 클릭
2. ✅ 상태가 "✅ 서버 실행 중"으로 변경
3. ✅ LAN 주소 표시됨
4. ✅ "서버 정지" 클릭 → 상태 변경

### 4️⃣ Windows용 빌드

```bash
npm run build:win
```

결과:
```
dist/
├── LANBridge-Setup-1.0.0.exe      ← 설치 프로그램 사용자용
├── LANBridge-1.0.0-portable.exe   ← 휴대용 (USB)
└── ...
```

**소요 시간:** 2-5분

### 5️⃣ 배포

```bash
# dist/ 폴더의 exe 파일을 다른 사용자에게 전달
# 더블클릭으로 실행 가능!
```

## 📋 플랫폼별 빌드

### Windows

```bash
npm run build:win
# 또는
node build.js win
```

**결과물:**
- `LANBridge-Setup-1.0.0.exe` (설치 프로그램)
- `LANBridge-1.0.0-portable.exe` (휴대용)

**크기:** ~50-120MB

### Mac

```bash
npm run build:mac
# 또는  
node build.js mac
```

**결과물:**
- `LANBridge-1.0.0.dmg` (설치 이미지)
- `LANBridge-1.0.0-arm64.dmg` (Apple Silicon)

**크기:** ~150MB

**필수:** Xcode Command Line Tools
```bash
xcode-select --install
```

### Linux

```bash
npm run build:linux
# 또는
node build.js linux
```

**결과물:**
- `LANBridge-1.0.0.AppImage` (포터블)
- `lanbridge-1.0.0-1.x86_64.rpm` (RPM)

**크기:** ~120MB

### 모든 플랫폼

```bash
npm run build:all
# 또는
node build.js all
```

⏱️ **주의:** 크로스 플랫폼 빌드는 시간이 오래 걸립니다.

## 🎨 커스텀 아이콘 추가 (선택사항)

프로덕션 배포 전에 앱 로고를 추가하세요.

### 간단한 방법

1. 로고 이미지 준비: `assets/logo.png` (정사각형, 투명 배경)
2. 아이콘 변환 도구 사용: https://www.icoconvert.com/
3. 생성된 파일을 `assets/` 폴더에 저장:
   - `icon.ico` (Windows, 256x256)
   - `icon.icns` (Mac, 1024x1024)  
   - `icon.png` (Linux, 512x512)
4. 다시 빌드: `npm run build:win`

**또는** [ELECTRON-BUILD.md](ELECTRON-BUILD.md)의 상세 가이드 참고

## 🔄 기존 launcher.js와의 호환성

좋은 소식: **launcher.js는 그대로 작동합니다!** 

Electron 앱이 launcher.js를 자동으로 실행하고 관리합니다:

```
사용자가 앱 실행
   ↓
main.js (Electron 메인 프로세스)
   ↓
launcher.js 자동 시작 (백그라운드)
   ↓
signal-server.js 관리
```

## 📁 프로젝트 구조 (변경 후)

```
LANBridge/
├── main.js                    ← Electron 메인 프로세스
├── preload.js                 ← 보안 레이어
├── build.js                   ← 빌드 자동화
├── init.js                    ← 초기화 검사
├── launcher.js                ← (기존) 런처 서버
├── signal-server.js           ← (기존) 신호 서버
├── app.js                     ← (기존) 앱 로직
├── webrtc.js                  ← (기존) WebRTC
├── protocol.js                ← (기존) 프로토콜
├── index.html                 ← (기존) 앱 UI
├── launcher.html              ← (업데이트) 런처 UI
├── style.css                  ← (기존) 스타일
├── package.json               ← (업데이트) 의존성
├── ELECTRON-BUILD.md          ← Electron 빌드 가이드
├── assets/                    ← 앱 아이콘
│   ├── icon.ico               (추가 필요)
│   ├── icon.icns              (추가 필요)
│   └── icon.png               (추가 필요)
├── dist/                      ← 빌드 결과물 (npm run build 후)
├── node_modules/              ← 의존성
└── docs/                      ← 기타 문서
```

## 🧪 테스트 체크리스트

### 개발 모드 테스트

- [ ] `npm start` 실행 → 네이티브 윈도우 표시
- [ ] "서버 시작" 버튼 클릭 → LAN 서버 시작
- [ ] LAN 주소 표시됨
- [ ] 다른 PC에서 LAN 주소로 접속 가능
- [ ] 채팅 기능 정상 작동
- [ ] "서버 정지" 클릭 → 서버 종료

### 빌드 후 테스트

#### Windows

- [ ] `dist/LANBridge-Setup-*.exe` 다운로드
- [ ] 더블클릭 → 설치 마법사 표시
- [ ] 설치 완료 → 앱 자동 실행 또는 바탕화면 아이콘 생성
- [ ] 앱 실행 → launcher UI 표시
- [ ] 서버 시작/정지 기능 정상 작동

#### Mac/Linux

- [ ] 해당 플랫폼의 설치 파일 예제 확인
- [ ] 설치 및 실행 테스트

## 🚨 문제 해결

### "npm: command not found"

Node.js 설치 확인:
```bash
node --version
npm --version
```

필요하면 https://nodejs.org/ 에서 재설치

### "electron is not recognized"

의존성 설치 필요:
```bash
npm install
```

### 빌드 중 "Cannot find Visual Studio"

Windows Build Tools 설치:
```bash
npm install -g windows-build-tools
```

### 아이콘 경고

프로덕션용이 아니면 무시 가능  
배포 전에 [ELECTRON-BUILD.md](ELECTRON-BUILD.md) 참고해서 아이콘 추가

## 📦 배포 방식 비교

| 방식 | 파일 | 크기 | 설치 | 추천 대상 |
|------|------|------|------|---------|
| **installer** (exe) | `LANBridge-Setup-*.exe` | 50MB | O | 일반 사용자 |
| **portable** (exe) | `LANBridge-*-portable.exe` | 120MB | X | USB 사용자 |
| **dmg** (Mac) | `LANBridge-*.dmg` | 150MB | O | Mac 사용자 |
| **AppImage** (Linux) | `LANBridge-*.AppImage` | 120MB | X | Linux 사용자 |

## 🎯 다음 단계

### 즉시 (개발)

1. `npm install` 실행
2. `npm start` 테스트
3. `npm run build:win` Windows 빌드 테스트

### 단기 (선택사항)

1. 커스텀 아이콘 추가 (assets/)
2. 자동 업데이트 설정 (ELECTRON-BUILD.md)
3. GitHub Releases에 배포

### 중기 (향후)

1. 앱스토어 정식 등록 (Windows Store, Mac App Store)
2. 서명 인증서 설정
3. 자동 코드 서명 설정

## 💡 팁

```bash
# 개발 도중 빠른 테스트
npm start

# 빌드 전 모든 설정 확인
node init.js

# 한 줄로 빌드
npm run dist

# 특정 플랫폼만
npm run build:win
npm run build:mac
npm run build:linux
```

## 📚 참고 문서

- [ELECTRON-BUILD.md](ELECTRON-BUILD.md) - 상세 빌드 가이드
- [README.md](README.md) - 앱 사용 설명서
- [DEPLOYMENT.md](DEPLOYMENT.md) - 배포 가이드

## ❓ FAQ

**Q: Node.js 바이너리를 포함할 수 없나?**

A: Electron이 자동으로 Node.js를 포함합니다. 따라서 사용자는 Node.js를 설치할 필요 없습니다.

**Q: 앱 크기를 줄일 수 있나?**

A: 일부 파일을 제외하고 빌드할 수 있습니다. package.json의 `build.files`에서 수정 가능합니다.

**Q: 자동 업데이트를 지원하나?**

A: 네! [ELECTRON-BUILD.md](ELECTRON-BUILD.md)에서 GitHub Releases 자동 업데이트 설정 방법을 참고하세요.

**Q: 인스톨러 없이 휴대용으로만 배포할 수 있나?**

A: 네, `npm run build:win`에서 생성되는 `*-portable.exe`만 배포하면 됩니다.

---

## 🎉 축하합니다!

**LANBridge가 이제 전문적인 데스크톱 앱이 되었습니다!**

다음 명령으로 시작하세요:

```bash
cd LANBridge
npm install
npm start
```

행운을 빕니다! 🚀
