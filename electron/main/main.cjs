const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'Lasercomb DXF Studio',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs')
        },
        icon: path.join(__dirname, '../../assets/icon.png'),
        show: false, // Don't show until ready
        titleBarStyle: process.platform === 'darwin' ? 'default' : 'default'
    });

    // Load the app
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle window resize
    mainWindow.on('resize', () => {
        mainWindow.webContents.send('window-resized');
    });
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open DXF File...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: [
                                { name: 'DXF Files', extensions: ['dxf'] },
                                { name: 'All Files', extensions: ['*'] }
                            ]
                        });

                        if (!result.canceled && result.filePaths.length > 0) {
                            const filePath = result.filePaths[0];
                            try {
                                const fileContent = fs.readFileSync(filePath, 'utf8');
                                const fileName = path.basename(filePath);
                                mainWindow.webContents.send('file-opened', {
                                    name: fileName,
                                    content: fileContent,
                                    path: filePath
                                });
                            } catch (error) {
                                dialog.showErrorBox('Error', `Failed to read file: ${error.message}`);
                            }
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Clear Viewer',
                    accelerator: 'CmdOrCtrl+K',
                    click: () => {
                        mainWindow.webContents.send('clear-viewer');
                    }
                },
                {
                    label: 'Fit to View',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => {
                        mainWindow.webContents.send('fit-to-view');
                    }
                },
                { type: 'separator' },
                {
                    role: 'quit'
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
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
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
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
        });

        // Window menu
        template[3].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' }
        ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// IPC handlers
ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'DXF Files', extensions: ['dxf'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    return result;
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('show-error-dialog', async (event, title, message) => {
    dialog.showErrorBox(title, message);
});

ipcMain.handle('save-layer-mapping', async (event, content, defaultFilename) => {
    try {
        // First, let the user choose where to save the original DXF file's location
        // We'll use the Documents folder as fallback, but user can navigate to DXF location
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Layer Mapping',
            defaultPath: path.join(app.getPath('documents'), defaultFilename),
            filters: [
                { name: 'Text Files', extensions: ['txt'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result.canceled) {
            return { success: false, cancelled: true };
        }

        // Get the directory where user wants to save
        const selectedDir = path.dirname(result.filePath);
        const filename = path.basename(result.filePath);
        
        // Create the CONFIG/DXF MAP subfolder structure
        const configDir = path.join(selectedDir, 'CONFIG', 'DXF MAP');
        const finalPath = path.join(configDir, filename);

        // Create directory structure if it doesn't exist
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Write the file to the CONFIG/DXF MAP subfolder
        fs.writeFileSync(finalPath, content, 'utf8');
        
        return { 
            success: true, 
            filePath: finalPath 
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message 
        };
    }
});

ipcMain.handle('save-layer-mapping-fixed', async (event, content, filename, dxfFilePath) => {
    try {
        // Get the application root directory (where the electron app is located)
        const appRoot = process.cwd(); // This gives us the DXF-Viewer root directory
        
        // Create the CONFIG/DXF MAP subfolder structure in the app root
        const configDir = path.join(appRoot, 'CONFIG', 'DXF MAP');
        const finalPath = path.join(configDir, filename);

        // Create directory structure if it doesn't exist
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Write the file to the CONFIG/DXF MAP subfolder
        fs.writeFileSync(finalPath, content, 'utf8');
        
        return { 
            success: true, 
            filePath: finalPath 
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message 
        };
    }
});

// Line Types Management
ipcMain.handle('load-line-types', async () => {
    try {
        const configPath = path.join(process.cwd(), 'CONFIG', 'LineTypes', 'line-types.csv');
        
        if (!fs.existsSync(configPath)) {
            return { success: false, error: 'Line types file not found' };
        }
        
        const csvContent = fs.readFileSync(configPath, 'utf8');
        const lines = csvContent.trim().split('\n');
        const headers = lines[0].split(',');
        
        const lineTypes = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const lineType = {};
            
            headers.forEach((header, index) => {
                const value = values[index]?.trim();
                if (header === 'id') {
                    lineType[header] = parseInt(value);
                } else if (header === 'width') {
                    lineType[header] = parseFloat(value);
                } else {
                    lineType[header] = value;
                }
            });
            
            lineTypes.push(lineType);
        }
        
        return { success: true, data: lineTypes };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-line-types', async (event, lineTypes) => {
    try {
        const configDir = path.join(process.cwd(), 'CONFIG', 'LineTypes');
        const configPath = path.join(configDir, 'line-types.csv');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // Generate CSV content
        const headers = ['id', 'name', 'description', 'lineType', 'processMethod', 'width', 'color'];
        let csvContent = headers.join(',') + '\n';
        
        lineTypes.forEach(lineType => {
            const row = headers.map(header => {
                const value = lineType[header];
                // Escape commas in values if needed
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }
                return value;
            });
            csvContent += row.join(',') + '\n';
        });
        
        fs.writeFileSync(configPath, csvContent, 'utf8');
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Import Filters IPC handlers
ipcMain.handle('load-import-filters', async () => {
    try {
        const configDir = path.join(process.cwd(), 'CONFIG', 'import-filters');
        
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
            return [];
        }
        
        const files = fs.readdirSync(configDir).filter(file => file.endsWith('.json'));
        const profiles = [];
        
        for (const file of files) {
            try {
                const filePath = path.join(configDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const profile = JSON.parse(content);
                profiles.push(profile);
            } catch (error) {
                console.error(`Error loading profile ${file}:`, error);
            }
        }
        
        return profiles;
    } catch (error) {
        console.error('Error loading import filters:', error);
        return [];
    }
});

ipcMain.handle('save-import-filter', async (event, profileData) => {
    try {
        const configDir = path.join(process.cwd(), 'CONFIG', 'import-filters');
        
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        const fileName = `${profileData.id}.json`;
        const filePath = path.join(configDir, fileName);
        
        fs.writeFileSync(filePath, JSON.stringify(profileData, null, 2), 'utf8');
        
        return { success: true };
    } catch (error) {
        console.error('Error saving import filter:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-import-filter', async (event, profileId) => {
    try {
        const configDir = path.join(process.cwd(), 'CONFIG', 'import-filters');
        const filePath = path.join(configDir, `${profileId}.json`);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting import filter:', error);
        return { success: false, error: error.message };
    }
});

// Open Import Filters Manager window
ipcMain.handle('open-import-filters-manager', async () => {
    const importFiltersWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs')
        },
        parent: mainWindow,
        modal: false,
        title: 'Import Filters Manager'
    });

    importFiltersWindow.loadFile(path.join(__dirname, '../renderer/import-filters.html'));

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        importFiltersWindow.webContents.openDevTools();
    }

    importFiltersWindow.on('closed', () => {
        // Window closed
    });
});

// Open Line Types Manager window
ipcMain.handle('open-line-types-manager', async () => {
    const lineTypesWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs')
        },
        parent: mainWindow,
        modal: false,
        title: 'Line Types Manager'
    });

    lineTypesWindow.loadFile(path.join(__dirname, '../renderer/line-types.html'));

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        lineTypesWindow.webContents.openDevTools();
    }

    lineTypesWindow.on('closed', () => {
        // Window closed
    });
});

// App event handlers
app.whenReady().then(() => {
    createWindow();
    createMenu();

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
    });
});

// Security: prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== 'null') {
            event.preventDefault();
        }
    });
});