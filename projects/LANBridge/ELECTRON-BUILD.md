# LANBridge Electron 데스크톱 앱 빌드 가이드

Electron 기반의 네이티브 윈도우/맥/리눅스 앱으로 LANBridge를 빌드하고 배포하는 방법입니다.

## 🎯 목표

```
LANBridge.exe (Windows)
LANBridge.app (Mac)
LANBridge.AppImage (Linux)
```

더블클릭만으로 앱 실행 가능 (브라우저 열 필요 없음)

## 📋 요구사항

### 필수

- **Node.js v16+** ([다운로드](https://nodejs.org/))
- **npm v7+** (Node.js와 함께 설치됨)

### Windows 빌드 시

- Visual Studio 또는 Build Tools (자동 감지 및 설치 유도)

### Mac 빌드 시

- Xcode Command Line Tools
  ```bash
  xcode-select --install
  ```

### 모든 플랫폼용 크로스 빌드

- Docker (선택사항, 더 안정적)

## 🚀 빠른 시작

### Step 1: 의존성 설치

```bash
cd LANBridge
npm install
```

첫 설치 시 `electron`과 `electron-builder` 다운로드 (총 ~200MB, 5-10분)

### Step 2: 개발 모드로 테스트

```bash
npm start
```

또는

```bash
npm run dev    # 개발자 도구 활성화
```

네이티브 Electron 앱 윈도우가 열립니다!

### Step 3: 빌드

#### Windows용 빌드

```bash
npm run build:win
```

결과: `dist/LANBridge-Setup-1.0.0.exe` (설치 프로그램)

#### Mac용 빌드

```bash
npm run build:mac
```

결과: `dist/LANBridge-1.0.0.dmg` (설치 이미지)

#### Linux용 빌드

```bash
npm run build:linux
```

결과: `dist/LANBridge-1.0.0.AppImage` (휴대용 앱)

#### 모든 플랫폼 빌드

```bash
npm run build:all
```

또는 간단하게:

```bash
node build.js          # 현재 플랫폼용
node build.js all      # 모든 플랫폼용
```

## 📦 빌드 결과물

### Windows

```
dist/
├── LANBridge-Setup-1.0.0.exe      ← 설치 프로그램 (~50MB)
├── LANBridge-1.0.0-portable.exe   ← 휴대용 실행파일 (~120MB)
└── builder-effective-config.yaml
```

**installer** vs **portable**:
- **installer**: 제어판에서 제거 가능, 바탕화면 아이콘 생성
- **portable**: 어디서나 실행 가능, 설치 불필요

### Mac

```
dist/
├── LANBridge-1.0.0.dmg            ← DMG 설치 이미지 (~150MB)
└── LANBridge-1.0.0-arm64.dmg       ← Apple Silicon용
```

### Linux

```
dist/
├── LANBridge-1.0.0.AppImage       ← 포ータ블 앱 (~120MB)
└── lanbridge-1.0.0-1.x86_64.rpm   ← RPM 패키지 (선택사항)
```

## 🎨 커스텀 아이콘 추가

현재 Electron 앱은 기본 아이콘을 사용합니다. 프로덕션 배포 전에 커스텀 아이콘을 추가하세요.

### 1. 로고 이미지 준비

원본 이미지: `assets/logo.png` (정사각형, 투명 배경 권장)

### 2. 아이콘 생성

**Option A: 온라인 도구 사용 (가장 간단)**

1. https://www.icoconvert.com/ 방문
2. `assets/logo.png` 업로드
3. 필요한 형식 다운로드:
   - Windows: `icon.ico` (256x256)
   - Mac: `icon.icns` (1024x1024)
   - Linux: `icon.png` (512x512)

**Option B: ImageMagick 사용**

```bash
# Windows용 ICO
convert assets/logo.png -define icon:auto-resize=256,128,96,64,48,32,16 assets/icon.ico

# Mac용 ICNS (Mac에서만 가능)
iconutil -c icns assets/logo.iconset -o assets/icon.icns

# Linux용 PNG
convert assets/logo.png -resize 512x512 assets/icon.png
```

**Option C: Electron Icon Builder 사용**

```bash
npm install -g electron-icon-builder

electron-icon-builder --input=assets/logo.png --output=assets --flatten
```

### 3. 아이콘 파일 배치

```
LANBridge/
├── assets/
│   ├── icon.ico      ← Windows 아이콘 (256x256)
│   ├── icon.icns     ← Mac 아이콘 (1024x1024)
│   ├── icon.png      ← Linux 아이콘 (512x512)
│   └── logo.png      ← 원본 로고
```

## 🔄 자동 업데이트 설정 (선택사항)

향후 사용자가 자동으로 최신 버전을 받을 수 있습니다.

### 1. GitHub Releases에 배포

```bash
# 1. GitHub에 업로드
git tag v1.0.1
git push origin v1.0.1

# 2. Release 생성 및 dist/ 파일 첨부
# https://github.com/yourusername/lanbridge/releases
```

### 2. app/main.js에 자동 업데이트 추가

```javascript
const { autoUpdater } = require('electron-updater');

app.on('ready', () => {
  // ... 기존 코드 ...
  
  // 자동 업데이트 확인
  autoUpdater.checkForUpdatesAndNotify();
});
```

### 3. package.json에 설정

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "yourusername",
      "repo": "lanbridge"
    }
  }
}
```

## 📋 배포 체크리스트

### 빌드 전

- [ ] 모든 기능 테스트 완료
- [ ] 버전 번호 업데이트 (`package.json`)
- [ ] 아이콘 파일 준비 (assets/)
- [ ] 테스트 빌드 실행(`npm start`)

### 빌드 후

- [ ] dist/ 폴더의 exe/dmg/AppImage 테스트
- [ ] 다른 PC에서 설치 및 실행 테스트
- [ ] 서버 시작/중지 기능 확인
- [ ] LAN 주소 표시 확인
- [ ] P2P 연결 테스트

### 배포 전

- [ ] 체인지로그 작성
- [ ] 버전 태그 생성 (`git tag v1.0.0`)
- [ ] GitHub Releases에 바이너리 첨부
- [ ] 배포 공지

## 🔧 고급 설정

### 코드 서명 (Mac)

프로덕션 배포 시 Apple 개발자 계정으로 코드 서명:

```bash
npm run build:mac --  --publish=always
```

### 서명 인증서 설정

```json
{
  "build": {
    "mac": {
      "identity": "Your Developer Id",
      "certificateFile": "path/to/certificate.p12"
    }
  }
}
```

### 크로스 플랫폼 빌드 (Docker)

모든 플랫폼용을 한 곳에서 빌드:

```bash
npm run build:all
```

## 🎬 사용자 배포 가이드

배포할 때 사용자에게 제공할 설명:

### Windows

```
1. LANBridge-Setup-1.0.0.exe 다운로드
2. 더블클릭 → 설치 마법사 따라가기
3. 설치 완료 후 자동 실행
4. "서버 시작" 클릭 → 준비 완료!
```

### Mac

```
1. LANBridge-1.0.0.dmg 다운로드
2. 더블클릭 → Finder 열림
3. LANBridge 아이콘을 Applications으로 드래그
4. Applications 폴더에서 실행
```

### Linux

```
bash
1. LANBridge-1.0.0.AppImage 다운로드
2. 우클릭 → Properties → Permissions → "Executable" 체크
3. 더블클릭으로 실행
   또는 터미널: chmod +x LANBridge-*.AppImage && ./LANBridge-*.AppImage
```

## 🐛 문제 해결

### "electron not found" 오류

```bash
npm install
npm start
```

### 빌드가 아이콘이 없다고 경고

아이콘 파일을 `assets/` 폴더에 추가하세요:
- `icon.ico` (Windows)
- `icon.icns` (Mac)
- `icon.png` (Linux)

### Windows에서 "cannot find msbuild" 오류

Visual Studio Build Tools 설치:

```bash
# npm이 자동으로 설치하도록 시도
npm install --global windows-build-tools

# 또는 수동으로 설치
# https://visualstudio.microsoft.com/visual-cpp-build-tools/
```

### Mac에서 "code signature invalid" 오류

```bash
rm -rf dist/
npm run build:mac
```

## 📊 파일 크기 최적화

빌드 결과물 크기 감소:

```json
{
  "build": {
    "win": {
      "certificateFile": "...",
      "asar": true,
      "artifactBuildStarted": false
    }
  }
}
```

현재 크기:
- Windows: ~50MB (installer), ~120MB (portable)
- Mac: ~150MB (dmg)
- Linux: ~120MB (AppImage)

## 🚀 다음 단계

1. **테스트 릴리스**: v0.9.0 태그 생성 후 테스트
2. **사용자 피드백**: beta 사용자 모집
3. **정식 릴리스**: v1.0.0 배포
4. **앱스토어 등록**: Apple/Google Play 등록 (향후)

## 📞 지원

문제가 있으시면:

1. 콘솔 로그 확인 (개발자 도구: F12)
2. GitHub Issues에 보고
3. 커뮤니티 피드백

---

**Happy Packaging! 🎉**
