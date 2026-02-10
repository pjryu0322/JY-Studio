#!/usr/bin/env node

/**
 * LANBridge Portable Launcher
 * - Starts/stops signal-server.js
 * - Serves a local control UI
 */

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const url = require('url');
const { spawn } = require('child_process');
const os = require('os');

const LAUNCHER_PORT = 9100;
const SIGNAL_PORT = 3000;
const USE_HTTPS = true; // Launcher는 항상 HTTPS

let signalProcess = null;

function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function serveFile(res, filePath, contentType, encoding = 'utf8') {
  fs.readFile(filePath, encoding, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function startSignalServer() {
  if (signalProcess && !signalProcess.killed) {
    return { started: false, reason: 'already-running' };
  }

  const nodePath = process.execPath || 'C:\\Program Files\\nodejs\\node.exe';
  const scriptPath = path.join(__dirname, 'signal-server.js');

  signalProcess = spawn(nodePath, [scriptPath], {
    cwd: __dirname,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: SIGNAL_PORT }
  });

  signalProcess.on('close', () => {
    signalProcess = null;
  });

  return { started: true };
}

function stopSignalServer(callback) {
  if (!signalProcess || signalProcess.killed) {
    if (callback) callback({ success: false, stopped: false, reason: 'not-running' });
    return;
  }

  console.log('[Launcher] Signal Server 종료 요청 중...');
  let killTimeout;
  
  // SIGINT 시그널 먼저 시도 (graceful shutdown)
  signalProcess.kill('SIGINT');
  
  // 프로세스 종료 이벤트 대기
  const onClose = () => {
    if (killTimeout) clearTimeout(killTimeout);
    console.log('[Launcher] ✅ Signal Server 종료됨');
    signalProcess = null;
    if (callback) callback({ success: true, stopped: true });
  };
  
  signalProcess.once('close', onClose);
  
  // 3초 타임아웃 - 강제 종료
  killTimeout = setTimeout(() => {
    if (signalProcess && !signalProcess.killed) {
      console.log('[Launcher] ⚠️  강제 종료 (SIGKILL)');
      try {
        signalProcess.kill('SIGKILL');
      } catch (error) {
        // 이미 종료됨
      }
    }
  }, 3000);
}

function checkHealth(callback) {
  // Signal Server는 HTTPS 사용 (자체 서명 인증서 무시)
  const options = {
    rejectUnauthorized: false,
    timeout: 2000
  };
  
  const req = https.get(`https://localhost:${SIGNAL_PORT}/health`, options, (res) => {
    res.resume();
    res.on('end', () => {
      callback(res.statusCode === 200);
    });
  });
  
  req.on('timeout', () => {
    req.destroy();
    callback(false);
  });
  
  req.on('error', () => {
    callback(false);
  });
}

const server = https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'certs/server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs/server.crt'))
}, (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS 헤더 (모바일 앱에서 접속 가능하도록)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === '/' && req.method === 'GET') {
    startSignalServer();
    const filePath = path.join(__dirname, 'index.html');
    return serveFile(res, filePath, 'text/html; charset=utf-8');
  }

  if ((pathname === '/app' || pathname === '/app/' || pathname === '/app/index.html') && req.method === 'GET') {
    startSignalServer();
    const filePath = path.join(__dirname, 'index.html');
    return serveFile(res, filePath, 'text/html; charset=utf-8');
  }

  if ((pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/index.html') && req.method === 'GET') {
    const filePath = path.join(__dirname, 'launcher.html');
    return serveFile(res, filePath, 'text/html; charset=utf-8');
  }

  if (pathname === '/style.css' && req.method === 'GET') {
    startSignalServer();
    const filePath = path.join(__dirname, 'style.css');
    return serveFile(res, filePath, 'text/css; charset=utf-8');
  }

  if (pathname === '/app.js' && req.method === 'GET') {
    startSignalServer();
    const filePath = path.join(__dirname, 'app.js');
    return serveFile(res, filePath, 'application/javascript; charset=utf-8');
  }

  if (pathname === '/webrtc.js' && req.method === 'GET') {
    startSignalServer();
    const filePath = path.join(__dirname, 'webrtc.js');
    return serveFile(res, filePath, 'application/javascript; charset=utf-8');
  }

  if (pathname === '/protocol.js' && req.method === 'GET') {
    startSignalServer();
    const filePath = path.join(__dirname, 'protocol.js');
    return serveFile(res, filePath, 'application/javascript; charset=utf-8');
  }

  if (pathname === '/signaling.js' && req.method === 'GET') {
    startSignalServer();
    const filePath = path.join(__dirname, 'signaling.js');
    return serveFile(res, filePath, 'application/javascript; charset=utf-8');
  }

  if (pathname === '/favicon.ico' && req.method === 'GET') {
    const filePath = path.join(__dirname, 'favicon.ico');
    return serveFile(res, filePath, 'image/x-icon', null);
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    return checkHealth((healthy) => {
      const lanIp = getLanIP();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        running: healthy,
        managed: Boolean(signalProcess && !signalProcess.killed),
        port: SIGNAL_PORT,
        localUrl: `localhost:${SIGNAL_PORT}`,
        lanUrl: `${lanIp}:${SIGNAL_PORT}`
      }));
    });
  }

  if (pathname === '/api/start' && req.method === 'POST') {
    const result = startSignalServer();
    return checkHealth((healthy) => {
      const lanIp = getLanIP();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: healthy || result.started,
        running: healthy,
        port: SIGNAL_PORT,
        localUrl: `localhost:${SIGNAL_PORT}`,
        lanUrl: `${lanIp}:${SIGNAL_PORT}`,
        note: result.started ? 'started' : result.reason
      }));
    });
  }

  if (pathname === '/api/stop' && req.method === 'POST') {
    // 대기했던 프로세스 종료 후 응답
    stopSignalServer((result) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const lanIp = getLanIP();

server.listen(LAUNCHER_PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║       LANBridge Launcher Started               ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  🔒 Local:  https://localhost:${LAUNCHER_PORT}${' '.repeat(16 - String(LAUNCHER_PORT).length)}║`);
  console.log(`║  🔒 LAN:    https://${lanIp}:${LAUNCHER_PORT}${' '.repeat(30 - lanIp.length - String(LAUNCHER_PORT).length)}║`);
  console.log('║                                                ║');
  console.log('║  Open the URL above to access the control UI  ║');
  console.log('║  Press Ctrl+C to stop the server              ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGINT', () => {
  stopSignalServer();
  server.close(() => process.exit(0));
});
