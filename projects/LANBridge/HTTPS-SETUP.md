# HTTPS 설정 가이드

LANBridge는 화면 공유 기능을 사용하기 위해 **HTTPS** 또는 **localhost**가 필요합니다.  
LAN 내 다른 PC와 화면을 공유하려면 HTTPS를 설정해야 합니다.

---

## 1. 인증서 생성

### Windows (OpenSSL 사용)

#### 1-1. OpenSSL 설치

**방법 1: Chocolatey 사용 (권장)**
```powershell
choco install openssl
```

**방법 2: 직접 설치**
1. https://slproweb.com/products/Win32OpenSSL.html 접속
2. "Win64 OpenSSL v3.x.x" 다운로드 및 설치
3. 환경 변수 PATH에 `C:\Program Files\OpenSSL-Win64\bin` 추가

#### 1-2. 인증서 생성 스크립트 실행

```powershell
cd c:\porject\LANBridge
.\generate-cert.bat
```

생성되는 파일:
- `certs/server.key` - 개인키
- `certs/server.crt` - 자체 서명 인증서 (365일 유효)

---

## 2. Signal Server 시작

### HTTPS 모드 (기본)

```powershell
node signal-server.js
```

인증서가 있으면 자동으로 HTTPS로 실행됩니다.

### HTTP 모드 (강제)

```powershell
$env:HTTPS='false'; node signal-server.js
```

---

## 3. 브라우저에서 접속

### 첫 접속 시 인증서 경고

1. `https://192.168.45.37:3000` 접속
2. **"주의 필요"** 또는 **"연결이 비공개로 설정되어 있지 않습니다"** 경고 표시
3. **"고급"** 클릭
4. **"192.168.45.37(안전하지 않음)(으)로 이동"** 클릭

### Chrome/Edge 인증서 경고 우회 (개발용)

경고 화면에서 직접 입력:
```
thisisunsafe
```
(화면에 표시되지 않지만 입력하면 자동으로 진입)

---

## 4. LAN 내 다른 PC에서 접속

### 같은 WiFi에 연결된 PC에서

1. Signal Server가 실행 중인 PC의 IP 확인 (예: `192.168.45.37`)
2. 브라우저에서 `https://192.168.45.37:3000` 접속
3. 인증서 경고 → "고급" → "계속" 클릭
4. LANBridge 화면 공유 시작

---

## 5. 문제 해결

### "인증서 파일을 찾을 수 없습니다"

```powershell
# certs 폴더 확인
cd c:\porject\LANBridge
dir certs

# 인증서 재생성
.\generate-cert.bat
```

### "포트가 이미 사용 중입니다"

```powershell
# 사용 중인 프로세스 확인
netstat -ano | findstr :3000

# 다른 포트 사용
$env:PORT='3001'; node signal-server.js
```

### Chrome/Edge에서 "NET::ERR_CERT_AUTHORITY_INVALID"

정상 동작입니다. "고급" → "계속"을 클릭하여 진입하세요.  
자체 서명 인증서는 인증 기관의 서명이 없으므로 경고가 발생합니다.

---

## 6. 프로덕션 환경 (선택사항)

### Let's Encrypt 무료 인증서 (공인 IP 필요)

1. Certbot 설치: https://certbot.eff.org/
2. 인증서 발급:
   ```powershell
   certbot certonly --standalone -d yourdomain.com
   ```
3. 인증서 경로 수정 (signal-server.js):
   ```javascript
   const certPath = 'C:/Certbot/live/yourdomain.com/fullchain.pem';
   const keyPath = 'C:/Certbot/live/yourdomain.com/privkey.pem';
   ```

---

## 참고

- **localhost 접속**: `https://localhost:3000` - 같은 PC에서만 화면 공유 가능
- **LAN IP 접속**: `https://192.168.45.37:3000` - 다른 PC와 화면 공유 가능
- 인증서 유효기간: 365일 (만료 시 재생성 필요)
