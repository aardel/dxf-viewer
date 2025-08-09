const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const indexPath = path.join(__dirname, '..', 'unified-viewer.html');
  mainWindow.loadFile(indexPath);

  const menu = Menu.buildFromTemplate(buildMenu());
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  return [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialog()
        },
        {
          label: 'Open Sample…',
          submenu: [
            {
              label: 'SAMPLE.cf2',
              click: () => openKnownFile(path.join(__dirname, '..', 'samples', 'SAMPLE.cf2'))
            },
            {
              label: 'test-1.dds',
              click: () => openKnownFile(path.join(__dirname, '..', 'samples', 'test-1.dds'))
            },
            {
              label: 'TEST1.cf2',
              click: () => openKnownFile(path.join(__dirname, '..', 'samples', 'TEST1.cf2'))
            },
            {
              label: 'test2.cf2',
              click: () => openKnownFile(path.join(__dirname, '..', 'samples', 'test2.cf2'))
            },
            {
              label: 'TEST3.cf2',
              click: () => openKnownFile(path.join(__dirname, '..', 'samples', 'TEST3.cf2'))
            }
          ]
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Toggle Measure',
          accelerator: 'M',
          click: () => broadcast('menu-toggle-measure')
        },
        {
          label: 'Fit to View',
          accelerator: '0',
          click: () => broadcast('menu-fit')
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About',
              message: 'Unified CAD Viewer (DDS/CFF2)'
            });
          }
        }
      ]
    }
  ];
}

function broadcast(channel, payload) {
  if (mainWindow) mainWindow.webContents.send(channel, payload);
}

async function openFileDialog() {
  if (!mainWindow) return;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Open CAD file',
    properties: ['openFile'],
    filters: [
      { name: 'CAD Files', extensions: ['dds', 'cf2', 'cff2'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (res.canceled || !res.filePaths.length) return;
  openKnownFile(res.filePaths[0]);
}

function openKnownFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const baseName = path.basename(filePath);
    if (process.platform === 'darwin') app.addRecentDocument(filePath);
    broadcast('open-file', { filePath, baseName, data });
  } catch (err) {
    log('error', `Failed to open file: ${filePath} -> ${err.message}`);
    dialog.showErrorBox('Open failed', err.message);
  }
}

// Basic logging
const logsDir = path.join(app.getPath('userData'), 'logs');
function ensureLogsDir() { try { fs.mkdirSync(logsDir, { recursive: true }); } catch (_) {} }
function log(level, message) {
  ensureLogsDir();
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  fs.appendFile(path.join(logsDir, 'app.log'), line, () => {});
}

ipcMain.on('renderer-log', (_e, payload) => {
  try { log(payload?.level || 'info', String(payload?.message || '')); } catch (_) {}
});

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});


