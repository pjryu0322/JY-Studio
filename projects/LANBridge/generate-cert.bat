@echo off
echo ========================================
echo LANBridge HTTPS 인증서 생성
echo ========================================
echo.

REM 인증서 저장 디렉토리
set CERT_DIR=certs
if not exist %CERT_DIR% mkdir %CERT_DIR%

REM OpenSSL 설치 확인
where openssl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [오류] OpenSSL이 설치되어 있지 않습니다.
    echo.
    echo 설치 방법:
    echo 1. Chocolatey 사용: choco install openssl
    echo 2. 직접 다운로드: https://slproweb.com/products/Win32OpenSSL.html
    echo.
    pause
    exit /b 1
)

echo [1/2] 개인키 생성 중...
openssl genrsa -out %CERT_DIR%\server.key 2048

echo [2/2] 자체 서명 인증서 생성 중 (유효기간: 365일)...
openssl req -new -x509 -key %CERT_DIR%\server.key -out %CERT_DIR%\server.crt -days 365 -subj "/C=KR/ST=Seoul/L=Seoul/O=LANBridge/CN=192.168.45.37" -addext "subjectAltName=IP:192.168.45.37,IP:127.0.0.1,DNS:localhost"

echo.
echo ========================================
echo ✅ 인증서 생성 완료!
echo ========================================
echo 파일 위치:
echo - 개인키: %CERT_DIR%\server.key
echo - 인증서: %CERT_DIR%\server.crt
echo.
echo 다음 단계:
echo 1. node signal-server.js 실행
echo 2. 브라우저에서 https://192.168.45.37:3000 접속
echo 3. "주의 필요" 경고 → "고급" → "안전하지 않음(계속)" 클릭
echo.
pause
