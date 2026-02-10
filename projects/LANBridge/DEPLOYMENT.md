# LANBridge 배포 가이드

다른 PC 사용자에게 LANBridge를 전달하고 배포하는 방법입니다.

## 🚀 배포 방법 (3가지)

### 방법 1: ZIP 압축 파일 (가장 간단) ⭐ 추천

#### Step 1: 압축 파일 만들기

**Windows에서:**

1. LANBridge 폴더 우클릭
2. **"폴더 압축..."** 또는 **"압축된 폴더로 보내기"** 선택  
   (또는 우클릭 → 7-Zip/WinRAR → "압축" 선택)
3. **LANBridge-portable.zip** 생성

**Mac에서:**

1. LANBridge 폴더 우클릭
2. **"압축"** 선택
3. 자동으로 **LANBridge.zip** 생성

**Linux에서:**

```bash
zip -r LANBridge-portable.zip LANBridge/
# 또는
tar -czf LANBridge-portable.tar.gz LANBridge/
```

#### Step 2: ZIP 파일 전달

- 👉 **카톡/메신저**: 파일 첨부로 전달
- 📧 **이메일**: 용량이 작아서(~1MB) 이메일 첨부 가능
- ☁️ **구글 드라이브/원드라이브**: 링크로 공유
- 💾 **USB 드라이브**: 직접 복사

#### Step 3: 받는 쪽에서 설정

받은 사람이 하는 일:

1. **ZIP 파일 압축 해제**
   - 우클릭 → 압축 해제 (또는 "모두 추출")
   - 또는 더블 클릭으로 자동 압축 해제

2. **Node.js 설치** (아직 안 했다면)
   - https://nodejs.org/ko/ 방문
   - LTS 버전 다운로드 및 설치
   - 컴퓨터 재부팅

3. **start.bat 더블클릭**
   - 첫 실행 시 npm install 자동 실행 (~1-2분)
   - 런처 UI 자동 열림
   - "서버 시작" 버튼 클릭

4. **LAN 주소 복사 후 공유**
   - 런처에 표시된 주소 (예: `192.168.0.100:3000`)
   - 상대방에게 전달

---

### 방법 2: GitHub 리포지토리 (팀 협업용)

#### Step 1: GitHub에 업로드

```bash
# 프로젝트 폴더에서:
git init
git add .
git commit -m "Initial LANBridge commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/lanbridge.git
git push -u origin main
```

#### Step 2: 다른 사용자가 클론

```bash
git clone https://github.com/YOUR-USERNAME/lanbridge.git
cd lanbridge
npm install
node launcher.js
```

**장점:**
- 🔄 버전 관리 용이
- 📝 변경 사항 추적
- 🤝 협업 가능

---

### 방법 3: 설치 프로그램 만들기 (고급)

#### NSIS 또는 Inno Setup 사용

```nsis
; Inno Setup 예시
[Setup]
AppName=LANBridge
AppVersion=1.0.0
DefaultDirName={pf}\LANBridge
DefaultGroupName=LANBridge

[Files]
Source: "launcher.js"; DestDir: "{app}"
Source: "launcher.html"; DestDir: "{app}"
Source: "signal-server.js"; DestDir: "{app}"
Source: "*.js"; DestDir: "{app}"
Source: "*.html"; DestDir: "{app}"
Source: "*.css"; DestDir: "{app}"
Source: "package.json"; DestDir: "{app}"

[Icons]
Name: "{group}\LANBridge"; Filename: "{app}\start.bat"
```

**장점:**
- 💾 설치 프로그램 (exe)
- 🖱️ 원클릭 설치
- 🗑️ 제어판에서 쉽게 제거

⚠️ **주의**: NSIS 설치 필요, 고급 사용자용

---

## 📋 배포 체크리스트

**배포 전 확인:**

- [ ] 모든 파일이 포함되어 있나? (적어도 `start.bat`, `launcher.js`, `signal-server.js`, `index.html`)
- [ ] `node_modules` 폴더는?
  - ZIP 크기가 크면 (>500MB) 제외 가능
  - ZIP 크기가 작으면 (<10MB) 포함해도 OK
- [ ] `README.md` 포함?
- [ ] 최신 버전인지 확인?

**배포 후 테스트:**

받는 사용자:

- [ ] ZIP 압축 해제 성공?
- [ ] Node.js 설치 확인?
- [ ] `npm install` 자동 설정되어 있나? (또는 수동 실행)
- [ ] `start.bat` 더블클릭 → 런처 UI 열림?
- [ ] "서버 시작" → "✅ 서버 실행 중"?
- [ ] LAN 주소 표시됨?
- [ ] 브라우저에서 LAN:3000 접속 가능?

---

## 🎯 상황별 배포 시나리오

### 시나리오 1: 회사 내부 네트워크

**배포 대상:** 같은 사무실 내 직원들

**추천 방법:**
1. ✅ ZIP 파일 생성
2. ✅ 공유 드라이브 (구글 드라이브, 원드라이브)에 업로드
3. ✅ README.md와 함께 링크 공유
4. ✅ 초기 설정 가이드 제공

**설정 가이드 메시지 예:**

```
[LANBridge 배포 안내]

안녕하세요! 자료 공유 앱을 배포합니다.

📥 설치 방법:
1. 아래 링크에서 LANBridge-portable.zip 다운로드
   → https://drive.google.com/file/d/...
   
2. 폴더 압축 해제
3. start.bat 더블클릭 (약 1-2분 대기)
4. 런처 UI에서 "서버 시작" 클릭
5. 표시된 LAN 주소를 다른 사람에게 공유

❓ 문제 발생 시:
- Node.js 설치 여부 확인 (https://nodejs.org/ko/)
- 브라우저 콘솔에서 에러 확인 (F12)
- 방화벽 설정 확인

감사합니다!
```

### 시나리오 2: 가정 사용자

**배포 대상:** 가족/친구

**추천 방법:**
1. ✅ ZIP 파일 생성 (압축 크기 최소화)
2. ✅ USB나 메신저로 전달
3. ✅ 카톡/전화로 간단 설정 지원
4. ✅ 원격 지원 (TeamViewer 등)

**카톡 설명 메시지:**

```
앱 설정하는 법:

1. 받은 파일 압축 해제
2. start.bat 더블클릭
3. 브라우저 창 나타나면 "서버 시작" 클릭
4. IP 주소 나오는데 그걸 내게 알려줘
5. 난 그 주소로 접속해서 너와 채팅!
```

### 시나리오 3: 오픈소스 배포

**배포 대상:** 인터넷 사용자

**추천 방법:**
1. ✅ GitHub에 업로드
2. ✅ GitHub Releases에 ZIP 첨부
3. ✅ 상세한 README.md 작성
4. ✅ 설치 스크립트 제공

**GitHub Releases 설명 예:**

```markdown
# LANBridge v1.0.0

로컬 네트워크에서 WebRTC 기반 P2P 채팅 앱

## 설치

### Windows/Mac/Linux
1. `LANBridge-portable.zip` 다운로드
2. 압축 해제
3. `start.bat` (Windows) 또는 `sh start.sh` (Mac/Linux) 실행

### Node.js 필수
- nodejs.org/ko/ 에서 LTS 버전 설치

## 사용법
1. 런처에서 "서버 시작" 클릭
2. LAN 주소로 다른 PC 접속
3. 채팅 시작!
```

---

## 🔧 자동 설치 스크립트

### Windows 배치 파일 (start.bat 개선)

현재 [start.bat](start.bat)을 수정해 npm 자동 설치 포함:

```batch
@echo off
chcp 65001 >nul
title LANBridge Launcher

echo ╔══════════════════════════════════╗
echo ║     LANBridge Portable           ║
echo ║     Press any key to start...    ║
echo ╚══════════════════════════════════╝
pause

REM npm install 확인 및 실행
if not exist node_modules (
    echo [*] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [!] npm install failed. Please check Node.js installation.
        pause
        exit /b 1
    )
)

REM 런처 시작
echo [✓] Starting LANBridge Launcher...
start "LANBridge" "http://localhost:9100"
node launcher.js

pause
```

### Mac/Linux 설치 스크립트 (start.sh)

```bash
#!/bin/bash

echo "╔══════════════════════════════════╗"
echo "║     LANBridge Portable           ║"
echo "╚══════════════════════════════════╝"

# Node.js 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please download from https://nodejs.org/ko/"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"

# npm install 확인
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ npm install failed"
        exit 1
    fi
fi

echo "[✓] Starting LANBridge Launcher..."

# Mac에서 브라우저 자동 열기
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:9100"
fi

# Linux에서 브라우저 자동 열기
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:9100"
fi

node launcher.js
```

---

## 📊 배포 형태 비교표

| 요소 | ZIP 파일 | GitHub | 설치프로그램 |
|------|---------|--------|------------|
| **복잡도** | ⭐ 매우 간단 | ⭐⭐⭐ 중간 | ⭐⭐⭐⭐ 복잡 |
| **파일 크기** | ~1-5MB | ~1-5MB | ~50-100MB |
| **설치 시간** | 1-2분 | 1-2분 | 3-5분 |
| **사용 대상** | 일반 사용자 | 개발자 | 기업 배포 |
| **버전 업데이트** | 수동 | `git pull` | 자동 |
| **추천도** | ★★★★★ | ★★★★☆ | ★★☆☆☆ |

**결론:** 
- 👉 **대부분의 경우 ZIP 파일 추천**
- GitHub는 팀 협업이나 오픈소스 배포용
- 설치 프로그램은 기업 환경용

---

## 💡 배포 팁

**1. 파일 크기 최적화**

```bash
# node_modules 제외하고 압축
zip -r LANBridge-portable.zip LANBridge/ -x "LANBridge/node_modules/*"

# 또는 실행 후 설치하도록 안내
```

**2. README 포함**

```bash
# ZIP에 설정 가이드 추가
# LANBridge/
# ├── SETUP-KO.md       (한글 설정 가이드)
# ├── SETUP-EN.md       (영문 설정 가이드)
# └── ...
```

**3. 버전 표시**

```json
// package.json
{
  "name": "lanbridge",
  "version": "1.0.0",
  "description": "P2P Chat App on Local WiFi",
  ...
}
```

**4. 체인지로그 유지**

```markdown
# CHANGELOG.md

## [1.0.0] - 2026-02-07
- ✅ Initial release
- ✅ Portable launcher
- ✅ P2P chat
```

---

## 🎬 배포 시연 예시

### 누군가가 질문할 때:

**사용자 A:** "다른 동료 5명에게도 이 앱을 쓰게 하고 싶은데 어떻게?"

**답변:**

```
1️⃣ ZIP 파일 생성
   - 이 폴더 우클릭 → 압축

2️⃣ 공유 드라이브에 업로드
   - 구글 드라이브 또는 원드라이브

3️⃣ 각 사람에게 링크 전달
   - "LANBridge-portable.zip 다운로드 받아서
     압축 해제 후 start.bat 클릭하면 됩니다"

4️⃣ 각자 start.bat 실행 후
   - 표시된 IP 주소를 서로 공유
   - 같은 WiFi 연결하면 자동으로 채팅 가능!
```

---

## 🚀 다음 단계

배포 후:

1. **사용자 피드백 수집**
2. **버그 리포트 정리**
3. **개선 사항 적용**
4. **v1.1.0 배포**

---

**Made with ❤️ for easy deployment**
