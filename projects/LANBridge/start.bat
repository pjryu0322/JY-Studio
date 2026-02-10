@echo off
echo ========================================
echo  LANBridge - P2P Local Network Share
echo ========================================
echo.
echo  [자동 포트 점검] 3000번 포트 사용 중인지 확인...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
	echo  [포트 점유 PID] %%a
	taskkill /PID %%a /F >nul 2>&1
	echo  [PID %%a 종료 완료]
)
echo.
echo  Starting Signal Server...
echo.
cd /d "%~dp0"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set LAN_IP=%%i
if "%LAN_IP%"=="" set LAN_IP=localhost
echo  Local:  https://localhost:3000
echo  LAN:    https://%LAN_IP%:3000
echo  Admin:  https://localhost:3000/admin
echo.
start "" "https://localhost:3000"
"C:\Program Files\nodejs\node.exe" signal-server.js
pause
