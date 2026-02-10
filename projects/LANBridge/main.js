const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow = null;
let launcherServer = null;
let isQuitting = false;

// 애플리케이션 초기화
app.on('ready', createWindow);

// 모든 윈도우 닫혔을 때
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 다시 활성화
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 종료 시 정리
app.on('before-quit', () => {
  isQuitting = true;
  if (launcherServer) {
    launcherServer.kill();
  }
});

// 윈도우 생성
function createWindow() {
  // 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true
    },
    icon: path.join(__dirname, 'assets/icon.ico')
  });

  // 런처 UI 로드
  mainWindow.loadFile('launcher.html');

  // 개발자 도구 (기본 비활성화, 개발 중 활성화하려면 uncomment)
  // mainWindow.webContents.openDevTools();

  // 윈도우 닫혔을 때
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 메뉴 설정
  setupMenu();

  // 런처 서버 자동 시작
  startLauncherServer();
}

// 메뉴 설정
function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About LANBridge',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About LANBridge',
              message: 'LANBridge v1.0.0',
              detail: 'P2P 기반 로컬 네트워크 자료 공유 앱\n\n© 2026 LANBridge Team'
            });
          }
        },
        {
          label: 'Visit GitHub',
          click: async () => {
            await shell.openExternal('https://github.com/yourusername/lanbridge');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 런처 서버 시작
function startLauncherServer() {
  try {
    const launcherPath = path.join(__dirname, 'launcher.js');
    
    launcherServer = spawn('node', [launcherPath], {
      cwd: __dirname,
      stdio: 'pipe',
      detached: false
    });

    launcherServer.stdout?.on('data', (data) => {
      console.log(`[Launcher] ${data.toString()}`);
    });

    launcherServer.stderr?.on('data', (data) => {
      console.error(`[Launcher Error] ${data.toString()}`);
    });

    launcherServer.on('error', (err) => {
      console.error('Failed to start launcher:', err);
    });

    launcherServer.on('exit', (code) => {
      if (!isQuitting) {
        console.log(`Launcher exited with code ${code}`);
      }
    });
  } catch (err) {
    console.error('Error starting launcher:', err);
  }
}

// IPC 이벤트 핸들러 (Renderer ↔ Main 통신)

// 앱 정보 가져오기
ipcMain.handle('get-app-info', async () => {
  return {
    version: app.getVersion(),
    appPath: app.getAppPath(),
    userDataPath: app.getPath('userData'),
    platform: process.platform,
    nodeVersion: process.version
  };
});

// 폴더 열기
ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});

// 파일 열기
ipcMain.handle('open-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: filters,
    properties: ['openFile']
  });
  return result.filePaths[0] || null;
});

// URL 외부 브라우저에서 열기
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

// LAN IP 가져오기
ipcMain.handle('get-lan-ip', async () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
});

// 창 최소화
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

// 창 최대화
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  }
});

// 창 닫기
ipcMain.on('window-close', () => {
  if (mainWindow) {
    isQuitting = true;
    mainWindow.close();
  }
});

console.log('Electron app initialized');
