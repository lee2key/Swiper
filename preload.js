const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('swiper', {
  chooseFolder: () => ipcRenderer.invoke('photos:choose-folder'),
  revealInExplorer: (filePath) => ipcRenderer.invoke('photos:reveal-in-explorer', filePath),
  renameRanked: (filePaths) => ipcRenderer.invoke('photos:rename-ranked', filePaths),
});
