const { contextBridge, ipcRenderer } = require('electron');

// 안전한 API를 렌더러에 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // 폴더/파일 선택
  openFolder: () => ipcRenderer.invoke('open-folder'),
  openFile: (filters) => ipcRenderer.invoke('open-file', filters),
  
  // URL 열기
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // LAN IP 가져오기
  getLanIp: () => ipcRenderer.invoke('get-lan-ip'),
  
  // 윈도우 제어
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close')
});
