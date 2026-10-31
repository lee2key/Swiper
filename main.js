const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.jfif']);
const videoExtensions = new Set(['.mp4', '.webm', '.ogv', '.ogg', '.m4v', '.mov']);

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: 'Swiper',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    backgroundColor: '#10151f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.loadFile('index.html');
}

app.whenReady().then(() => {
  ipcMain.handle('photos:choose-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;

    const folder = result.filePaths[0];
    const entries = await fs.readdir(folder, { withFileTypes: true });
    const photos = entries
      .filter((entry) => {
        const extension = path.extname(entry.name).toLowerCase();
        return entry.isFile() && (imageExtensions.has(extension) || videoExtensions.has(extension));
      })
      .map((entry) => {
        const filePath = path.join(folder, entry.name);
        const extension = path.extname(entry.name).toLowerCase();
        return {
          id: filePath,
          name: entry.name,
          url: pathToFileURL(filePath).href,
          type: videoExtensions.has(extension) ? 'video' : 'image',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return { folder, photos };
  });

  ipcMain.handle('photos:reveal-in-explorer', (_event, filePath) => {
    if (typeof filePath === 'string') shell.showItemInFolder(filePath);
  });

  ipcMain.handle('photos:rename-ranked', async (_event, rankedPaths) => {
    if (!Array.isArray(rankedPaths) || rankedPaths.length === 0 || !rankedPaths.every((item) => typeof item === 'string')) {
      throw new Error('No ranked files were provided.');
    }

    const sourcePaths = new Set(rankedPaths.map((filePath) => path.resolve(filePath).toLowerCase()));
    const plans = rankedPaths.map((filePath, index) => {
      const resolvedPath = path.resolve(filePath);
      const directory = path.dirname(resolvedPath);
      // Re-running this action updates an existing rank instead of stacking prefixes.
      const originalName = path.basename(resolvedPath).replace(/^\d{3,}_/, '');
      const targetName = `${String(index + 1).padStart(3, '0')}_${originalName}`;
      return {
        source: resolvedPath,
        target: path.join(directory, targetName),
        temporary: path.join(directory, `.${path.basename(resolvedPath)}.swiper-${Date.now()}-${index}.tmp`),
      };
    });

    const targetPaths = new Set();
    for (const plan of plans) {
      const targetKey = plan.target.toLowerCase();
      if (targetPaths.has(targetKey)) throw new Error(`Two files would receive the same name: ${path.basename(plan.target)}`);
      targetPaths.add(targetKey);
      try {
        await fs.access(plan.target);
        if (!sourcePaths.has(targetKey)) throw new Error(`Cannot rename because this file already exists: ${path.basename(plan.target)}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    const moved = [];
    try {
      for (const plan of plans) {
        await fs.rename(plan.source, plan.temporary);
        moved.push(plan);
      }
      for (const plan of plans) {
        await fs.rename(plan.temporary, plan.target);
        plan.finished = true;
      }
    } catch (error) {
      // Best-effort rollback keeps the folder unchanged if any rename fails halfway through.
      for (const plan of [...moved].reverse()) {
        const currentPath = plan.finished ? plan.target : plan.temporary;
        try { await fs.rename(currentPath, plan.source); } catch { /* Preserve the original error. */ }
      }
      throw error;
    }

    return plans.map((plan) => ({
      oldPath: plan.source,
      newPath: plan.target,
      name: path.basename(plan.target),
      url: pathToFileURL(plan.target).href,
    }));
  });

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length || createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
