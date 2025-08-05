const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

// Keep a global reference of the window object
let mainWindow;
let unifiedMappingWindow = null;
let machineToolImporterWindow = null;

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

// Create unified mapping window
function createUnifiedMappingWindow() {
    
    
    // Don't create multiple instances
    if (unifiedMappingWindow) {

        unifiedMappingWindow.focus();
        return;
    }

    // Create the browser window
    unifiedMappingWindow = new BrowserWindow({
        width: 1400,
        height: 800,
        minWidth: 1000,
        minHeight: 600,
        title: 'Unified Mapping Workflow - Lasercomb DXF Studio',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs')
        },
        icon: path.join(__dirname, '../../assets/icon.png'),
        show: false, // Don't show until ready
        titleBarStyle: process.platform === 'darwin' ? 'default' : 'default',
        parent: mainWindow, // Make it a child of the main window
        modal: false // Allow it to be independent
    });

    // Load the unified mapping HTML
    
    unifiedMappingWindow.loadFile(path.join(__dirname, '../renderer/unified-mapping.html'));

    // Show window when ready to prevent visual flash
    unifiedMappingWindow.once('ready-to-show', () => {

        unifiedMappingWindow.show();
    });

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        unifiedMappingWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed
    unifiedMappingWindow.on('closed', () => {
        unifiedMappingWindow = null;
    });

    // Handle window resize
    unifiedMappingWindow.on('resize', () => {
        unifiedMappingWindow.webContents.send('window-resized');
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

ipcMain.handle('show-directory-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Default Save Directory'
    });
    return result;
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
        
        // Also save as XML for better structure and backup
        const xmlPath = path.join(configDir, 'line-types.xml');
        const xmlContent = generateLineTypesXML(lineTypes);
        fs.writeFileSync(xmlPath, xmlContent, 'utf8');
        
        return { success: true, message: `Saved ${lineTypes.length} line types to CSV and XML` };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Helper function to generate Line Types XML with proper formatting
function generateLineTypesXML(lineTypes) {
    const timestamp = new Date().toISOString();
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<LineTypesLibrary>\n';
    
    // Add metadata
    xml += '  <Metadata>\n';
    xml += `    <LastModified>${timestamp}</LastModified>\n`;
    xml += '    <Version>1.0</Version>\n';
    xml += `    <TotalCount>${lineTypes.length}</TotalCount>\n`;
    xml += '  </Metadata>\n';
    
    // Add line types
    xml += '  <LineTypes>\n';
    
    lineTypes.forEach(lineType => {
        xml += `    <LineType id="${escapeXml(lineType.id || '')}">\n`;
        xml += `      <Name>${escapeXml(lineType.name || '')}</Name>\n`;
        xml += `      <Description>${escapeXml(lineType.description || '')}</Description>\n`;
        xml += `      <Type>${escapeXml(lineType.lineType || 'laser')}</Type>\n`;
        xml += `      <Width>${escapeXml((lineType.width || '1.0').toString())}</Width>\n`;
        xml += `      <Color>${escapeXml(lineType.color || '#FF0000')}</Color>\n`;
        xml += '    </LineType>\n';
    });
    
    xml += '  </LineTypes>\n';
    xml += '</LineTypesLibrary>\n';
    
    return xml;
}

// Helper function to escape XML special characters
function escapeXml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function createElementWithText(doc, tagName, textContent) {
    const element = doc.createElement(tagName);
    element.textContent = textContent;
    return element;
}

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
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs')
        },
        title: 'Import Filters Manager'
    });

    importFiltersWindow.loadFile(path.join(__dirname, '../renderer/import-filters.html'));

    if (process.env.NODE_ENV === 'development') {
        importFiltersWindow.webContents.openDevTools();
    }

    importFiltersWindow.on('closed', () => {
        importFiltersWindow = null;
    });
});

// Open Mapping Wizard window
ipcMain.handle('open-mapping-wizard', async () => {
    const mappingWizardWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs')
        },
        title: 'Layer Mapping Wizard',
        resizable: true,
        minimizable: true,
        maximizable: true
    });

    mappingWizardWindow.loadFile(path.join(__dirname, '../renderer/mapping-wizard.html'));

    if (process.env.NODE_ENV === 'development') {
        mappingWizardWindow.webContents.openDevTools();
    }

    mappingWizardWindow.on('closed', () => {
        mappingWizardWindow = null;
    });
});

// Open Global Import Filter Manager window
ipcMain.handle('open-global-import-filter-manager', async () => {
    const globalFilterManagerWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs')
        },
        title: 'Global Import Filter Manager',
        resizable: true,
        minimizable: true,
        maximizable: true
    });

    globalFilterManagerWindow.loadFile(path.join(__dirname, '../renderer/global-import-filter.html'));

    if (process.env.NODE_ENV === 'development') {
        globalFilterManagerWindow.webContents.openDevTools();
    }

    globalFilterManagerWindow.on('closed', () => {
        globalFilterManagerWindow = null;
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
        title: 'Line Types Manager v2.0 - Auto-Save Edition'
    });

    // Add timestamp to force cache reload and always clear cache
    const timestamp = Date.now();
    const htmlPath = path.join(__dirname, '../renderer/line-types.html');
    console.log('🚀 Opening Line Types Manager v2.0 with cache-bust:', timestamp);
    
    lineTypesWindow.loadFile(htmlPath, { 
        query: { 'cache-bust': timestamp.toString() } 
    });
    
    // Always clear cache to ensure fresh code loads (not just in dev mode)
    lineTypesWindow.webContents.once('did-finish-load', () => {
        console.log('🔄 Line Types Manager: Force reloading to clear cache...');
        lineTypesWindow.webContents.reloadIgnoringCache();
    });

    // Always open DevTools to see console messages and verify loading
    lineTypesWindow.webContents.openDevTools();

    lineTypesWindow.on('closed', () => {
        // Window closed
    });
});

// Load postprocessor configuration file
ipcMain.handle('load-postprocessor-config', async (event, profileName) => {
    try {
        const configPath = path.join(__dirname, '../../CONFIG/postprocessors', `${profileName}.json`);
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error loading postprocessor config:', error);
        throw new Error(`Failed to load postprocessor config: ${error.message}`);
    }
});

// Load tool library configuration file
ipcMain.handle('load-tool-library', async (event, libraryName) => {
    try {
        const toolPath = path.join(__dirname, '../../CONFIG/tools', `${libraryName}.json`);
        const toolData = fs.readFileSync(toolPath, 'utf8');
        return JSON.parse(toolData);
    } catch (error) {
        console.error('Error loading tool library:', error);
        throw new Error(`Failed to load tool library: ${error.message}`);
    }
});

// Load optimization algorithms configuration
ipcMain.handle('load-optimization-config', async () => {
    try {
        const optimizationPath = path.join(__dirname, '../../CONFIG/optimization/algorithms.json');
        const optimizationData = fs.readFileSync(optimizationPath, 'utf8');
        return JSON.parse(optimizationData);
    } catch (error) {
        console.error('Error loading optimization config:', error);
        throw new Error(`Failed to load optimization config: ${error.message}`);
    }
});

// Save postprocessor configuration file
ipcMain.handle('save-postprocessor-config', async (event, profileName, configData) => {
    try {
        const configPath = path.join(__dirname, '../../CONFIG/postprocessors', `${profileName}.json`);
        const configDir = path.dirname(configPath);
        
        // Ensure directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        console.error('Error saving postprocessor config:', error);
        throw new Error(`Failed to save postprocessor config: ${error.message}`);
    }
});

// XML Profile Management
// Load available XML profiles
ipcMain.handle('load-xml-profiles', async () => {
    try {
        const profilesDir = path.join(__dirname, '../../CONFIG/profiles');
        
        if (!fs.existsSync(profilesDir)) {
            fs.mkdirSync(profilesDir, { recursive: true });
            return [];
        }
        
        const files = fs.readdirSync(profilesDir).filter(file => file.endsWith('.xml'));
        const profiles = [];
        
        for (const file of files) {
            try {
                const filePath = path.join(profilesDir, file);
                const xmlContent = fs.readFileSync(filePath, 'utf8');
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
                
                const profileInfo = xmlDoc.getElementsByTagName('ProfileInfo')[0];
                if (profileInfo) {
                    const name = profileInfo.getElementsByTagName('Name')[0]?.textContent || file;
                    const description = profileInfo.getElementsByTagName('Description')[0]?.textContent || '';
                    
                    profiles.push({
                        filename: file,
                        name: name,
                        description: description
                    });
                }
            } catch (error) {
                console.error(`Error reading profile ${file}:`, error);
            }
        }
        
        return profiles;
    } catch (error) {
        console.error('Error loading XML profiles:', error);
        throw new Error(`Failed to load XML profiles: ${error.message}`);
    }
});

// Load specific XML profile
ipcMain.handle('load-xml-profile', async (event, filename) => {
    try {
        const profilePath = path.join(__dirname, '../../CONFIG/profiles', filename);
        const xmlContent = fs.readFileSync(profilePath, 'utf8');
        
        // Parse XML to JavaScript object
        const config = parseXMLProfile(xmlContent);
        return config;
    } catch (error) {
        console.error('Error loading XML profile:', error);
        throw new Error(`Failed to load XML profile: ${error.message}`);
    }
});

// Save XML profile
ipcMain.handle('save-xml-profile', async (event, filename, configData) => {
    try {
        const profilesDir = path.join(__dirname, '../../CONFIG/profiles');
        const profilePath = path.join(profilesDir, filename);
        
        // Ensure directory exists
        if (!fs.existsSync(profilesDir)) {
            fs.mkdirSync(profilesDir, { recursive: true });
        }
        
        // Convert JavaScript object to XML
        const xmlContent = generateXMLProfile(configData);
        fs.writeFileSync(profilePath, xmlContent, 'utf8');
        
        return { success: true };
    } catch (error) {
        console.error('Error saving XML profile:', error);
        throw new Error(`Failed to save XML profile: ${error.message}`);
    }
});

// Delete XML profile
ipcMain.handle('delete-xml-profile', async (event, filename) => {
    try {
        const profilesDir = path.join(__dirname, '../../CONFIG/profiles');
        const profilePath = path.join(profilesDir, filename);
        
        if (fs.existsSync(profilePath)) {
            fs.unlinkSync(profilePath);
            return { success: true };
        } else {
            throw new Error('Profile file not found');
        }
    } catch (error) {
        console.error('Error deleting XML profile:', error);
        throw new Error(`Failed to delete XML profile: ${error.message}`);
    }
});

// Parse XML profile to JavaScript object
function parseXMLProfile(xmlContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    const root = xmlDoc.getElementsByTagName('PostprocessorProfile')[0];
    
    const config = {};
    
    // Parse ProfileInfo
    const profileInfo = root.getElementsByTagName('ProfileInfo')[0];
    if (profileInfo) {
        config.profileInfo = {
            name: getTextContent(profileInfo, 'Name'),
            description: getTextContent(profileInfo, 'Description'),
            version: getTextContent(profileInfo, 'Version'),
            created: getTextContent(profileInfo, 'Created'),
            lastModified: getTextContent(profileInfo, 'LastModified'),
            author: getTextContent(profileInfo, 'Author')
        };
    }
    
    // Parse MachineSettings
    const machineSettings = root.getElementsByTagName('MachineSettings')[0];
    if (machineSettings) {
        const scalingHeader = machineSettings.getElementsByTagName('ScalingHeader')[0];
        config.units = {
            feedInchMachine: getTextContent(machineSettings, 'FeedInchMachine') === 'true',
            scalingHeader: scalingHeader ? {
                enabled: getTextContent(scalingHeader, 'Enabled') === 'true',
                parameter: getTextContent(scalingHeader, 'Parameter'),
                scaleCommand: getTextContent(scalingHeader, 'ScaleCommand'),
                comment: getTextContent(scalingHeader, 'Comment')
            } : null
        };
    }
    
    // Parse Tools
    const toolsElement = root.getElementsByTagName('Tools')[0];
    if (toolsElement) {
        config.tools = {};
        const toolElements = toolsElement.getElementsByTagName('Tool');
        for (let i = 0; i < toolElements.length; i++) {
            const tool = toolElements[i];
            const toolId = tool.getAttribute('ID');
            config.tools[toolId] = {
                name: getTextContent(tool, 'Name'),
                description: getTextContent(tool, 'Description'),
                width: parseFloat(getTextContent(tool, 'Width')),
                hCode: getTextContent(tool, 'HCode')
            };
        }
    }
    
    // Parse ToolSettings
    const toolSettings = root.getElementsByTagName('ToolSettings')[0];
    if (toolSettings) {
        const speeds = toolSettings.getElementsByTagName('Speeds')[0];
        const toolChange = toolSettings.getElementsByTagName('ToolChange')[0];
        const validation = toolSettings.getElementsByTagName('Validation')[0];
        const enabledSections = toolSettings.getElementsByTagName('EnabledSections')[0];
        
        config.toolSettings = {
            speeds: speeds ? {
                engraving: parseInt(getTextContent(speeds, 'Engraving')),
                cutting: parseInt(getTextContent(speeds, 'Cutting')),
                perforation: parseInt(getTextContent(speeds, 'Perforation'))
            } : null,
            toolChange: toolChange ? {
                time: parseFloat(getTextContent(toolChange, 'Time')),
                command: getTextContent(toolChange, 'Command')
            } : null,
            validation: validation ? {
                validateWidths: getTextContent(validation, 'ValidateWidths') === 'true',
                warnOnMissingTools: getTextContent(validation, 'WarnOnMissingTools') === 'true'
            } : null,
            enabledSections: enabledSections ? {
                cuttingSpeeds: getTextContent(enabledSections, 'CuttingSpeeds') === 'true',
                toolChange: getTextContent(enabledSections, 'ToolChange') === 'true',
                safetySettings: getTextContent(enabledSections, 'SafetySettings') === 'true'
            } : {
                cuttingSpeeds: false,
                toolChange: false,
                safetySettings: true  // Default enabled
            }
        };
    }
    
    // Parse LineTypeMappings (legacy)
    const lineTypeMappings = root.getElementsByTagName('LineTypeMappings')[0];
    if (lineTypeMappings) {
        config.lineTypeMappings = {};
        
        // Custom mappings
        const customMappings = lineTypeMappings.getElementsByTagName('CustomMappings')[0];
        if (customMappings) {
            config.lineTypeMappings.customMappings = {};
            const mappings = customMappings.getElementsByTagName('Mapping');
            for (let i = 0; i < mappings.length; i++) {
                const mapping = mappings[i];
                const lineType = mapping.getAttribute('LineType');
                const tool = mapping.getAttribute('Tool');
                config.lineTypeMappings.customMappings[lineType] = tool;
            }
        }
        
        // Layer mappings
        const layerMappings = lineTypeMappings.getElementsByTagName('LayerMappings')[0];
        if (layerMappings) {
            config.lineTypeMappings.layerMappings = {};
            const mappings = layerMappings.getElementsByTagName('LayerMapping');
            for (let i = 0; i < mappings.length; i++) {
                const mapping = mappings[i];
                const layer = mapping.getAttribute('Layer');
                const lineType = mapping.getAttribute('LineType');
                config.lineTypeMappings.layerMappings[layer] = lineType;
            }
        }
        
        // Color mappings
        const colorMappings = lineTypeMappings.getElementsByTagName('ColorMappings')[0];
        if (colorMappings) {
            config.lineTypeMappings.colorMappings = {};
            const mappings = colorMappings.getElementsByTagName('ColorMapping');
            for (let i = 0; i < mappings.length; i++) {
                const mapping = mappings[i];
                const color = mapping.getAttribute('Color');
                const lineType = mapping.getAttribute('LineType');
                config.lineTypeMappings.colorMappings[color] = lineType;
            }
        }
        
        // Rules
        const rules = lineTypeMappings.getElementsByTagName('Rules')[0];
        if (rules) {
            config.lineTypeMappings.rules = {
                layerPriority: getTextContent(rules, 'LayerPriority') === 'true',
                colorFallback: getTextContent(rules, 'ColorFallback') === 'true',
                entityOverride: getTextContent(rules, 'EntityOverride') === 'true',
                caseInsensitive: getTextContent(rules, 'CaseInsensitive') === 'true'
            };
        }
    }

    // Parse MappingWorkflow (new unified mapping system)
    const mappingWorkflow = root.getElementsByTagName('MappingWorkflow')[0];
    if (mappingWorkflow) {
        config.mappingWorkflow = {};
        
        // Parse LineTypeToTool mappings
        const lineTypeToTool = mappingWorkflow.getElementsByTagName('LineTypeToTool')[0];
        if (lineTypeToTool) {
            config.mappingWorkflow.lineTypeToTool = [];
            const mappings = lineTypeToTool.getElementsByTagName('LineTypeMapping');
            for (let i = 0; i < mappings.length; i++) {
                const mapping = mappings[i];
                const lineType = mapping.getAttribute('LineType');
                const tool = mapping.getAttribute('Tool');
                config.mappingWorkflow.lineTypeToTool.push({
                    lineType: lineType,
                    tool: tool
                });
            }
        }
    }
    
    // Parse Header
    const header = root.getElementsByTagName('Header')[0];
    if (header) {
        config.header = {
            template: getTextContent(header, 'Template'),
            includeFileInfo: getTextContent(header, 'IncludeFileInfo') === 'true',
            includeBounds: getTextContent(header, 'IncludeBounds') === 'true',
            includeSetCount: getTextContent(header, 'IncludeSetCount') === 'true',
            includeProgramStart: getTextContent(header, 'IncludeProgramStart') === 'true',
            programStart: getTextContent(header, 'ProgramStart')
        };
        
        // Setup commands
        const setupCommands = header.getElementsByTagName('SetupCommands')[0];
        if (setupCommands) {
            config.header.setupCommands = [];
            const commands = setupCommands.getElementsByTagName('Command');
            for (let i = 0; i < commands.length; i++) {
                config.header.setupCommands.push(commands[i].textContent);
            }
        }
    }
    
    // Parse Optimization
    const optimization = root.getElementsByTagName('Optimization')[0];
    if (optimization) {
        config.optimization = {
            primaryStrategy: getTextContent(optimization, 'PrimaryStrategy'),
            withinGroupOptimization: getTextContent(optimization, 'WithinGroupOptimization'),
            includeComments: getTextContent(optimization, 'IncludeComments') === 'true',
            validateWidths: getTextContent(optimization, 'ValidateWidths') === 'true',
            respectManualBreaks: getTextContent(optimization, 'RespectManualBreaks') === 'true'
        };
        
        // Parse Priority settings
        const priority = optimization.getElementsByTagName('Priority')[0];
        if (priority) {
            config.optimization.priority = {
                mode: getTextContent(priority, 'Mode') || 'tool',
                items: []
            };
            
            // Parse PriorityItem elements
            const priorityItems = priority.getElementsByTagName('PriorityItem');
            for (let i = 0; i < priorityItems.length; i++) {
                const item = priorityItems[i];
                const order = parseInt(item.getAttribute('order')) || 0;
                const value = item.getAttribute('value') || '';
                
                config.optimization.priority.items.push({
                    order: order,
                    value: value
                });
            }
            
            // Sort items by order
            config.optimization.priority.items.sort((a, b) => a.order - b.order);
        }
    }
    
    // Parse GCode
    const gcode = root.getElementsByTagName('GCode')[0];
    if (gcode) {
        config.gcode = {
            rapidMove: getTextContent(gcode, 'RapidMove'),
            linearMove: getTextContent(gcode, 'LinearMove'),
            cwArc: getTextContent(gcode, 'CwArc'),
            ccwArc: getTextContent(gcode, 'CcwArc'),
            homeCommand: getTextContent(gcode, 'HomeCommand'),
            programEnd: getTextContent(gcode, 'ProgramEnd')
        };
    }
    
    // Parse Laser
    const laser = root.getElementsByTagName('Laser')[0];
    if (laser) {
        config.laser = {
            laserOn: getTextContent(laser, 'LaserOn'),
            laserOff: getTextContent(laser, 'LaserOff'),
            toolChange: getTextContent(laser, 'ToolChange')
        };
        
        const comments = laser.getElementsByTagName('Comments')[0];
        if (comments) {
            config.laser.comments = {
                enabled: getTextContent(comments, 'Enabled') === 'true',
                onCommand: getTextContent(comments, 'OnCommand'),
                offCommand: getTextContent(comments, 'OffCommand'),
                toolChange: getTextContent(comments, 'ToolChange')
            };
        }
    }
    
    // Parse LineNumbers
    const lineNumbers = root.getElementsByTagName('LineNumbers')[0];
    if (lineNumbers) {
        config.lineNumbers = {
            enabled: getTextContent(lineNumbers, 'Enabled') === 'true',
            startNumber: parseInt(getTextContent(lineNumbers, 'StartNumber')),
            increment: parseInt(getTextContent(lineNumbers, 'Increment')),
            format: getTextContent(lineNumbers, 'Format')
        };
    }
    
    return config;
}

// Generate XML from JavaScript object
function generateXMLProfile(config) {
    const serializer = new XMLSerializer();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString('<?xml version="1.0" encoding="UTF-8"?><PostprocessorProfile></PostprocessorProfile>', 'text/xml');
    const root = xmlDoc.documentElement;
    
    // Add ProfileInfo
    if (config.profileInfo) {
        const profileInfo = xmlDoc.createElement('ProfileInfo');
        addTextElement(xmlDoc, profileInfo, 'Name', config.profileInfo.name);
        addTextElement(xmlDoc, profileInfo, 'Description', config.profileInfo.description);
        addTextElement(xmlDoc, profileInfo, 'Version', config.profileInfo.version);
        addTextElement(xmlDoc, profileInfo, 'Created', config.profileInfo.created);
        addTextElement(xmlDoc, profileInfo, 'LastModified', new Date().toISOString().split('T')[0]);
        addTextElement(xmlDoc, profileInfo, 'Author', config.profileInfo.author);
        root.appendChild(profileInfo);
    }
    
    // Add MachineSettings
    if (config.units) {
        const machineSettings = xmlDoc.createElement('MachineSettings');
        addTextElement(xmlDoc, machineSettings, 'Type', config.units.feedInchMachine ? 'inch_with_scaling' : 'metric');
        addTextElement(xmlDoc, machineSettings, 'Units', config.units.feedInchMachine ? 'inch' : 'mm');
        addTextElement(xmlDoc, machineSettings, 'FeedInchMachine', config.units.feedInchMachine ? 'true' : 'false');
        
        if (config.units.scalingHeader) {
            const scalingHeader = xmlDoc.createElement('ScalingHeader');
            addTextElement(xmlDoc, scalingHeader, 'Enabled', config.units.scalingHeader.enabled ? 'true' : 'false');
            addTextElement(xmlDoc, scalingHeader, 'Parameter', config.units.scalingHeader.parameter);
            addTextElement(xmlDoc, scalingHeader, 'ScaleCommand', config.units.scalingHeader.scaleCommand);
            addTextElement(xmlDoc, scalingHeader, 'Comment', config.units.scalingHeader.comment);
            machineSettings.appendChild(scalingHeader);
        }
        root.appendChild(machineSettings);
    }
    
    // Add Tools
    if (config.tools) {
        const toolsElement = xmlDoc.createElement('Tools');
        Object.entries(config.tools).forEach(([toolId, tool]) => {
            const toolElement = xmlDoc.createElement('Tool');
            toolElement.setAttribute('ID', toolId);
            addTextElement(xmlDoc, toolElement, 'Name', tool.name);
            addTextElement(xmlDoc, toolElement, 'Description', tool.description);
            addTextElement(xmlDoc, toolElement, 'Width', tool.width.toString());
            addTextElement(xmlDoc, toolElement, 'HCode', tool.hCode);
            if (tool.application) {
                addTextElement(xmlDoc, toolElement, 'Application', Array.isArray(tool.application) ? tool.application.join(',') : tool.application);
            }
            toolsElement.appendChild(toolElement);
        });
        root.appendChild(toolsElement);
    }
    
    // Add ToolSettings
    if (config.toolSettings) {
        const toolSettings = xmlDoc.createElement('ToolSettings');
        
        if (config.toolSettings.speeds) {
            const speeds = xmlDoc.createElement('Speeds');
            addTextElement(xmlDoc, speeds, 'Engraving', config.toolSettings.speeds.engraving.toString());
            addTextElement(xmlDoc, speeds, 'Cutting', config.toolSettings.speeds.cutting.toString());
            addTextElement(xmlDoc, speeds, 'Perforation', config.toolSettings.speeds.perforation.toString());
            toolSettings.appendChild(speeds);
        }
        
        if (config.toolSettings.toolChange) {
            const toolChange = xmlDoc.createElement('ToolChange');
            addTextElement(xmlDoc, toolChange, 'Time', config.toolSettings.toolChange.time.toString());
            addTextElement(xmlDoc, toolChange, 'Command', config.toolSettings.toolChange.command);
            toolSettings.appendChild(toolChange);
        }
        
        if (config.toolSettings.validation) {
            const validation = xmlDoc.createElement('Validation');
            addTextElement(xmlDoc, validation, 'ValidateWidths', config.toolSettings.validation.validateWidths ? 'true' : 'false');
            addTextElement(xmlDoc, validation, 'WarnOnMissingTools', config.toolSettings.validation.warnOnMissingTools ? 'true' : 'false');
            toolSettings.appendChild(validation);
        }
        
        if (config.toolSettings.enabledSections) {
            const enabledSections = xmlDoc.createElement('EnabledSections');
            addTextElement(xmlDoc, enabledSections, 'CuttingSpeeds', config.toolSettings.enabledSections.cuttingSpeeds ? 'true' : 'false');
            addTextElement(xmlDoc, enabledSections, 'ToolChange', config.toolSettings.enabledSections.toolChange ? 'true' : 'false');
            addTextElement(xmlDoc, enabledSections, 'SafetySettings', config.toolSettings.enabledSections.safetySettings ? 'true' : 'false');
            toolSettings.appendChild(enabledSections);
        }
        
        root.appendChild(toolSettings);
    }
    
    // Add LineTypeMappings
    if (config.lineTypeMappings) {
        const lineTypeMappings = xmlDoc.createElement('LineTypeMappings');
        
        // Custom mappings
        if (config.lineTypeMappings.customMappings) {
            const customMappings = xmlDoc.createElement('CustomMappings');
            Object.entries(config.lineTypeMappings.customMappings).forEach(([lineType, tool]) => {
                const mapping = xmlDoc.createElement('Mapping');
                mapping.setAttribute('LineType', lineType);
                mapping.setAttribute('Tool', tool);
                customMappings.appendChild(mapping);
            });
            lineTypeMappings.appendChild(customMappings);
        }
        
        // Layer mappings
        if (config.lineTypeMappings.layerMappings) {
            const layerMappings = xmlDoc.createElement('LayerMappings');
            Object.entries(config.lineTypeMappings.layerMappings).forEach(([layer, lineType]) => {
                const mapping = xmlDoc.createElement('LayerMapping');
                mapping.setAttribute('Layer', layer);
                mapping.setAttribute('LineType', lineType);
                layerMappings.appendChild(mapping);
            });
            lineTypeMappings.appendChild(layerMappings);
        }
        
        // Color mappings
        if (config.lineTypeMappings.colorMappings) {
            const colorMappings = xmlDoc.createElement('ColorMappings');
            Object.entries(config.lineTypeMappings.colorMappings).forEach(([color, lineType]) => {
                const mapping = xmlDoc.createElement('ColorMapping');
                mapping.setAttribute('Color', color);
                mapping.setAttribute('LineType', lineType);
                colorMappings.appendChild(mapping);
            });
            lineTypeMappings.appendChild(colorMappings);
        }
        
        // Rules
        if (config.lineTypeMappings.rules) {
            const rules = xmlDoc.createElement('Rules');
            addTextElement(xmlDoc, rules, 'LayerPriority', config.lineTypeMappings.rules.layerPriority ? 'true' : 'false');
            addTextElement(xmlDoc, rules, 'ColorFallback', config.lineTypeMappings.rules.colorFallback ? 'true' : 'false');
            addTextElement(xmlDoc, rules, 'EntityOverride', config.lineTypeMappings.rules.entityOverride ? 'true' : 'false');
            addTextElement(xmlDoc, rules, 'CaseInsensitive', config.lineTypeMappings.rules.caseInsensitive ? 'true' : 'false');
            lineTypeMappings.appendChild(rules);
        }
        
        root.appendChild(lineTypeMappings);
    }
    
    // Add Header
    if (config.header) {
        const header = xmlDoc.createElement('Header');
        addTextElement(xmlDoc, header, 'Template', config.header.template);
        addTextElement(xmlDoc, header, 'IncludeFileInfo', config.header.includeFileInfo ? 'true' : 'false');
        addTextElement(xmlDoc, header, 'IncludeBounds', config.header.includeBounds ? 'true' : 'false');
        addTextElement(xmlDoc, header, 'IncludeSetCount', config.header.includeSetCount ? 'true' : 'false');
        addTextElement(xmlDoc, header, 'IncludeProgramStart', config.header.includeProgramStart ? 'true' : 'false');
        addTextElement(xmlDoc, header, 'ProgramStart', config.header.programStart);
        
        if (config.header.setupCommands && config.header.setupCommands.length > 0) {
            const setupCommands = xmlDoc.createElement('SetupCommands');
            config.header.setupCommands.forEach(command => {
                addTextElement(xmlDoc, setupCommands, 'Command', command);
            });
            header.appendChild(setupCommands);
        }
        
        root.appendChild(header);
    }
    
    // Add Optimization
    if (config.optimization) {
        const optimization = xmlDoc.createElement('Optimization');
        addTextElement(xmlDoc, optimization, 'PrimaryStrategy', config.optimization.primaryStrategy);
        addTextElement(xmlDoc, optimization, 'WithinGroupOptimization', config.optimization.withinGroupOptimization);
        addTextElement(xmlDoc, optimization, 'IncludeComments', config.optimization.includeComments ? 'true' : 'false');
        addTextElement(xmlDoc, optimization, 'ValidateWidths', config.optimization.validateWidths ? 'true' : 'false');
        addTextElement(xmlDoc, optimization, 'RespectManualBreaks', config.optimization.respectManualBreaks ? 'true' : 'false');
        
        // Add Priority settings
        if (config.optimization.priority) {
            const priority = xmlDoc.createElement('Priority');
            addTextElement(xmlDoc, priority, 'Mode', config.optimization.priority.mode);
            
            // Add LineTypeOrder
            if (config.optimization.priority.lineTypeOrder && config.optimization.priority.lineTypeOrder.length > 0) {
                const lineTypeOrder = xmlDoc.createElement('LineTypeOrder');
                config.optimization.priority.lineTypeOrder.forEach(item => {
                    addTextElement(xmlDoc, lineTypeOrder, 'Item', item);
                });
                priority.appendChild(lineTypeOrder);
            }
            
            // Add ToolOrder
            if (config.optimization.priority.toolOrder && config.optimization.priority.toolOrder.length > 0) {
                const toolOrder = xmlDoc.createElement('ToolOrder');
                config.optimization.priority.toolOrder.forEach(item => {
                    addTextElement(xmlDoc, toolOrder, 'Item', item);
                });
                priority.appendChild(toolOrder);
            }
            
            optimization.appendChild(priority);
        }
        
        root.appendChild(optimization);
    }
    
    // Add GCode
    if (config.gcode) {
        const gcode = xmlDoc.createElement('GCode');
        addTextElement(xmlDoc, gcode, 'RapidMove', config.gcode.rapidMove);
        addTextElement(xmlDoc, gcode, 'LinearMove', config.gcode.linearMove);
        addTextElement(xmlDoc, gcode, 'CwArc', config.gcode.cwArc);
        addTextElement(xmlDoc, gcode, 'CcwArc', config.gcode.ccwArc);
        addTextElement(xmlDoc, gcode, 'HomeCommand', config.gcode.homeCommand);
        addTextElement(xmlDoc, gcode, 'ProgramEnd', config.gcode.programEnd);
        root.appendChild(gcode);
    }
    
    // Add Laser
    if (config.laser) {
        const laser = xmlDoc.createElement('Laser');
        addTextElement(xmlDoc, laser, 'LaserOn', config.laser.laserOn);
        addTextElement(xmlDoc, laser, 'LaserOff', config.laser.laserOff);
        addTextElement(xmlDoc, laser, 'ToolChange', config.laser.toolChange);
        
        if (config.laser.comments) {
            const comments = xmlDoc.createElement('Comments');
            addTextElement(xmlDoc, comments, 'Enabled', config.laser.comments.enabled ? 'true' : 'false');
            addTextElement(xmlDoc, comments, 'OnCommand', config.laser.comments.onCommand);
            addTextElement(xmlDoc, comments, 'OffCommand', config.laser.comments.offCommand);
            addTextElement(xmlDoc, comments, 'ToolChange', config.laser.comments.toolChange);
            laser.appendChild(comments);
        }
        
        root.appendChild(laser);
    }
    
    // Add LineNumbers
    if (config.lineNumbers) {
        const lineNumbers = xmlDoc.createElement('LineNumbers');
        addTextElement(xmlDoc, lineNumbers, 'Enabled', config.lineNumbers.enabled ? 'true' : 'false');
        addTextElement(xmlDoc, lineNumbers, 'StartNumber', config.lineNumbers.startNumber.toString());
        addTextElement(xmlDoc, lineNumbers, 'Increment', config.lineNumbers.increment.toString());
        addTextElement(xmlDoc, lineNumbers, 'Format', config.lineNumbers.format);
        root.appendChild(lineNumbers);
    }
    
    // Generate formatted XML with proper indentation
    const xmlString = serializer.serializeToString(xmlDoc);
    
    // Format the XML with proper indentation
    return formatXML(xmlString);
}

// Helper functions
function getTextContent(parent, tagName) {
    const element = parent.getElementsByTagName(tagName)[0];
    if (!element) return '';
    
    // Clean up text content - remove newlines and extra whitespace
    const textContent = element.textContent || '';
    return textContent.trim().replace(/\s+/g, ' ');
}

function addTextElement(xmlDoc, parent, tagName, textContent) {
    const element = xmlDoc.createElement(tagName);
    element.textContent = textContent || '';
    parent.appendChild(element);
}

// Get tools from the active profile
async function getToolsFromActiveProfile() {
    try {
        // Get the active profile filename from the main window
        if (mainWindow) {
            const activeProfile = await mainWindow.webContents.executeJavaScript(`
                try {
                    const select = document.getElementById('postprocessorProfile');
                    if (select && select.value && select.value !== 'custom') {
                        return select.value;
                    }
                    return null;
                } catch (e) {
                    console.error('Error getting active profile:', e);
                    return null;
                }
            `);
            
            console.log('Active profile detected:', activeProfile);
            
            if (activeProfile) {
                const profilesDir = path.join(__dirname, '../../CONFIG/profiles');
                const profilePath = path.join(profilesDir, activeProfile);
                
                console.log('Looking for profile at:', profilePath);
                
                if (fs.existsSync(profilePath)) {
                    console.log('Profile file found, parsing tools...');
                    const xmlContent = fs.readFileSync(profilePath, 'utf8');
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
                    
                    // Parse tools from XML
                    const toolsElement = xmlDoc.getElementsByTagName('Tools')[0];
                    if (toolsElement) {
                        const tools = {};
                        const toolElements = toolsElement.getElementsByTagName('Tool');
                        
                        console.log(`Found ${toolElements.length} tools in profile`);
                        
                        for (let i = 0; i < toolElements.length; i++) {
                            const tool = toolElements[i];
                            const toolId = tool.getAttribute('ID');
                            
                            if (toolId) {
                                tools[toolId] = {
                                    name: getTextContent(tool, 'Name'),
                                    description: getTextContent(tool, 'Description'),
                                    width: parseFloat(getTextContent(tool, 'Width')) || 0,
                                    hCode: getTextContent(tool, 'HCode')
                                };
                                console.log(`Parsed tool ${toolId}:`, tools[toolId]);
                            }
                        }
                        
                        return tools;
                    } else {
                        console.log('No Tools element found in profile');
                    }
                } else {
                    console.log('Profile file not found at:', profilePath);
                }
            } else {
                console.log('No active profile detected');
            }
        } else {
            console.log('Main window not available');
        }
        
        return null;
    } catch (error) {
        console.error('Error getting tools from active profile:', error);
        return null;
    }
}

// Get tools from a specific profile file
function getToolsFromProfileFile(profileFilename) {
    try {
        const profilesDir = path.join(__dirname, '../../CONFIG/profiles');
        const profilePath = path.join(profilesDir, profileFilename);
        
        console.log('Looking for profile at:', profilePath);
        
        if (fs.existsSync(profilePath)) {
            console.log('Profile file found, parsing tools...');
            const xmlContent = fs.readFileSync(profilePath, 'utf8');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            // Parse tools from XML
            const toolsElement = xmlDoc.getElementsByTagName('Tools')[0];
            if (toolsElement) {
                const tools = {};
                const toolElements = toolsElement.getElementsByTagName('Tool');
                
                console.log(`Found ${toolElements.length} tools in profile`);
                
                for (let i = 0; i < toolElements.length; i++) {
                    const tool = toolElements[i];
                    const toolId = tool.getAttribute('ID');
                    
                    if (toolId) {
                        tools[toolId] = {
                            name: getTextContent(tool, 'Name'),
                            description: getTextContent(tool, 'Description'),
                            width: parseFloat(getTextContent(tool, 'Width')) || 0,
                            hCode: getTextContent(tool, 'HCode')
                        };
                        console.log(`Parsed tool ${toolId}:`, tools[toolId]);
                    }
                }
                
                return tools;
            } else {
                console.log('No Tools element found in profile');
            }
        } else {
            console.log('Profile file not found at:', profilePath);
        }
        
        return null;
    } catch (error) {
        console.error('Error getting tools from profile file:', error);
        return null;
    }
}

// Get layer-to-line-type mappings from a specific profile file
function getLayerToLineTypeMappingsFromProfile(profileFilename) {
    try {
        const profilesDir = path.join(__dirname, '../../CONFIG/profiles');
        const profilePath = path.join(profilesDir, profileFilename);
        
        console.log('Looking for layer mappings in profile:', profilePath);
        
        if (fs.existsSync(profilePath)) {
            const xmlContent = fs.readFileSync(profilePath, 'utf8');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            // Parse LayerToLineType mappings from XML
            const mappingWorkflow = xmlDoc.getElementsByTagName('MappingWorkflow')[0];
            if (mappingWorkflow) {
                const layerToLineType = mappingWorkflow.getElementsByTagName('LayerToLineType')[0];
                if (layerToLineType) {
                    const mappings = {};
                    const layerMappings = layerToLineType.getElementsByTagName('LayerMapping');
                    
                    console.log(`Found ${layerMappings.length} layer-to-line-type mappings in profile`);
                    
                    for (let i = 0; i < layerMappings.length; i++) {
                        const mapping = layerMappings[i];
                        const layer = mapping.getAttribute('Layer');
                        const lineType = mapping.getAttribute('LineType');
                        
                        if (layer && lineType) {
                            mappings[layer] = lineType;
                            console.log(`Layer mapping: ${layer} -> ${lineType}`);
                        }
                    }
                    
                    return mappings;
                } else {
                    console.log('No LayerToLineType element found in profile');
                }
            } else {
                console.log('No MappingWorkflow element found in profile');
            }
        } else {
            console.log('Profile file not found at:', profilePath);
        }
        
        return {};
    } catch (error) {
        console.error('Error getting layer-to-line-type mappings from profile:', error);
        return {};
    }
}

// Get file-specific mappings from a profile
function getFileSpecificMappingsFromProfile(profileFilename, fileName = null, fileHash = null) {
    try {
        const profilesDir = path.join(__dirname, '../../CONFIG/profiles');
        const profilePath = path.join(profilesDir, profileFilename);
        
        console.log('Looking for file-specific mappings in profile:', profilePath);
        
        if (fs.existsSync(profilePath)) {
            const xmlContent = fs.readFileSync(profilePath, 'utf8');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            const mappingWorkflow = xmlDoc.getElementsByTagName('MappingWorkflow')[0];
            if (mappingWorkflow) {
                const fileSpecificMappings = mappingWorkflow.getElementsByTagName('FileSpecificMappings')[0];
                if (fileSpecificMappings) {
                    const fileMappings = fileSpecificMappings.getElementsByTagName('FileMapping');
                    const mappings = {};
                    
                    console.log(`Found ${fileMappings.length} file-specific mappings in profile`);
                    
                    for (let i = 0; i < fileMappings.length; i++) {
                        const fileMapping = fileMappings[i];
                        const mappingFileName = fileMapping.getAttribute('FileName');
                        const mappingFileHash = fileMapping.getAttribute('FileHash');
                        
                        // If fileName is provided, only return mappings for that specific file
                        if (fileName && mappingFileName !== fileName) {
                            continue;
                        }
                        
                        // If fileHash is provided, verify the hash matches
                        if (fileHash && mappingFileHash !== fileHash) {
                            continue;
                        }
                        
                        const layerMappings = fileMapping.getElementsByTagName('LayerMapping');
                        const fileLayerMappings = {};
                        
                        for (let j = 0; j < layerMappings.length; j++) {
                            const mapping = layerMappings[j];
                            const layer = mapping.getAttribute('Layer');
                            const lineType = mapping.getAttribute('LineType');
                            
                            if (layer && lineType) {
                                fileLayerMappings[layer] = lineType;
                                console.log(`File-specific mapping: ${layer} -> ${lineType}`);
                            }
                        }
                        
                        if (Object.keys(fileLayerMappings).length > 0) {
                            mappings[mappingFileName] = {
                                mappings: fileLayerMappings,
                                fileHash: mappingFileHash,
                                metadata: getFileMappingMetadata(fileMapping)
                            };
                        }
                    }
                    
                    return mappings;
                } else {
                    console.log('No FileSpecificMappings element found in profile');
                }
            } else {
                console.log('No MappingWorkflow element found in profile');
            }
        } else {
            console.log('Profile file not found at:', profilePath);
        }
        
        return {};
    } catch (error) {
        console.error('Error getting file-specific mappings from profile:', error);
        return {};
    }
}

// Get metadata from a file mapping element
function getFileMappingMetadata(fileMappingElement) {
    try {
        const metadata = {};
        const metadataElement = fileMappingElement.getElementsByTagName('Metadata')[0];
        
        if (metadataElement) {
            const created = metadataElement.getElementsByTagName('Created')[0];
            const lastModified = metadataElement.getElementsByTagName('LastModified')[0];
            const description = metadataElement.getElementsByTagName('Description')[0];
            
            if (created) metadata.created = created.textContent;
            if (lastModified) metadata.lastModified = lastModified.textContent;
            if (description) metadata.description = description.textContent;
        }
        
        return metadata;
    } catch (error) {
        console.error('Error getting file mapping metadata:', error);
        return {};
    }
}

// Calculate a simple hash for a file (for conflict detection)
function calculateFileHash(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Create a simple hash based on file size, modification time, and content length
        const hashData = `${stats.size}_${stats.mtime.getTime()}_${content.length}`;
        const hash = require('crypto').createHash('md5').update(hashData).digest('hex');
        
        return hash.substring(0, 12); // Return first 12 characters for readability
    } catch (error) {
        console.error('Error calculating file hash:', error);
        return null;
    }
}

// Get combined mappings (global + file-specific) for a specific file
function getCombinedMappingsForFile(profileFilename, fileName, filePath = null) {
    try {
        // Get global mappings
        const globalMappings = getLayerToLineTypeMappingsFromProfile(profileFilename);
        
        // Get file-specific mappings
        let fileHash = null;
        if (filePath) {
            fileHash = calculateFileHash(filePath);
        }
        
        const fileSpecificMappings = getFileSpecificMappingsFromProfile(profileFilename, fileName, fileHash);
        
        // Combine mappings (file-specific override global)
        const combinedMappings = { ...globalMappings };
        
        if (fileSpecificMappings[fileName]) {
            const fileMappings = fileSpecificMappings[fileName].mappings;
            Object.assign(combinedMappings, fileMappings);
            console.log(`Applied ${Object.keys(fileMappings).length} file-specific mappings for ${fileName}`);
        }
        
        return {
            globalMappings: globalMappings,
            fileSpecificMappings: fileSpecificMappings[fileName] || null,
            combinedMappings: combinedMappings,
            fileHash: fileHash
        };
    } catch (error) {
        console.error('Error getting combined mappings for file:', error);
        return {
            globalMappings: {},
            fileSpecificMappings: null,
            combinedMappings: {},
            fileHash: null
        };
    }
}

// Save file-specific mappings to a profile
function saveFileSpecificMappingsToProfile(profileFilename, fileName, fileHash, mappings, description = '') {
    try {
        const profilesDir = path.join(__dirname, '../../CONFIG/profiles');
        const profilePath = path.join(profilesDir, profileFilename);
        
        if (!fs.existsSync(profilePath)) {
            throw new Error(`Profile file not found: ${profilePath}`);
        }
        
        const xmlContent = fs.readFileSync(profilePath, 'utf8');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        // Find or create MappingWorkflow element
        let mappingWorkflow = xmlDoc.getElementsByTagName('MappingWorkflow')[0];
        if (!mappingWorkflow) {
            mappingWorkflow = xmlDoc.createElement('MappingWorkflow');
            xmlDoc.documentElement.appendChild(mappingWorkflow);
        }
        
        // Find or create FileSpecificMappings element
        let fileSpecificMappings = mappingWorkflow.getElementsByTagName('FileSpecificMappings')[0];
        if (!fileSpecificMappings) {
            fileSpecificMappings = xmlDoc.createElement('FileSpecificMappings');
            mappingWorkflow.appendChild(fileSpecificMappings);
        }
        
        // Remove existing file mapping if it exists
        const existingFileMappings = fileSpecificMappings.getElementsByTagName('FileMapping');
        for (let i = 0; i < existingFileMappings.length; i++) {
            const existingMapping = existingFileMappings[i];
            if (existingMapping.getAttribute('FileName') === fileName) {
                fileSpecificMappings.removeChild(existingMapping);
                break;
            }
        }
        
        // Create new file mapping
        const fileMapping = xmlDoc.createElement('FileMapping');
        fileMapping.setAttribute('FileName', fileName);
        fileMapping.setAttribute('FileHash', fileHash);
        
        // Add layer mappings
        Object.entries(mappings).forEach(([layer, lineType]) => {
            const layerMapping = xmlDoc.createElement('LayerMapping');
            layerMapping.setAttribute('Layer', layer);
            layerMapping.setAttribute('LineType', lineType);
            fileMapping.appendChild(layerMapping);
        });
        
        // Add metadata
        const metadata = xmlDoc.createElement('Metadata');
        const created = xmlDoc.createElement('Created');
        const lastModified = xmlDoc.createElement('LastModified');
        const desc = xmlDoc.createElement('Description');
        
        const now = new Date().toISOString();
        created.textContent = now;
        lastModified.textContent = now;
        desc.textContent = description || `File-specific mappings for ${fileName}`;
        
        metadata.appendChild(created);
        metadata.appendChild(lastModified);
        metadata.appendChild(desc);
        fileMapping.appendChild(metadata);
        
        fileSpecificMappings.appendChild(fileMapping);
        
        // Save the updated XML
        const serializer = new XMLSerializer();
        const updatedXml = serializer.serializeToString(xmlDoc);
        const formattedXml = formatXML(updatedXml);
        
        fs.writeFileSync(profilePath, formattedXml, 'utf8');
        
        console.log(`Successfully saved file-specific mappings for ${fileName}`);
        return true;
        
    } catch (error) {
        console.error('Error saving file-specific mappings to profile:', error);
        return false;
    }
}

// Format XML with proper indentation and line breaks
function formatXML(xmlString) {
    let formatted = '';
    let indent = '';
    const tab = '    ';
    let inTag = false;
    let inClosingTag = false;
    
    for (let i = 0; i < xmlString.length; i++) {
        const char = xmlString[i];
        const nextChar = xmlString[i + 1];
        
        if (char === '<') {
            if (nextChar === '/') {
                inClosingTag = true;
                // Reduce indent for closing tags
                indent = indent.substring(0, indent.length - tab.length);
                formatted += '\n' + indent;
            } else {
                inTag = true;
                formatted += '\n' + indent;
            }
        }
        
        formatted += char;
        
        if (char === '>') {
            inTag = false;
            if (inClosingTag) {
                inClosingTag = false;
            } else {
                // Increase indent for opening tags (but not self-closing tags)
                if (xmlString[i - 1] !== '/') {
                    indent += tab;
                }
            }
        }
    }
    
    // Remove the first newline and return
    return formatted.substring(1);
}

// Unified Mapping Window IPC handlers
ipcMain.handle('open-unified-mapping-window', async () => {
    console.log('IPC: Opening unified mapping window...');
    createUnifiedMappingWindow();
    return { success: true };
});

ipcMain.handle('close-unified-mapping-window', async () => {
    if (unifiedMappingWindow) {
        unifiedMappingWindow.close();
        unifiedMappingWindow = null;
    }
    return { success: true };
});

ipcMain.handle('get-dxf-layers', async () => {
    try {
        // Try to get real DXF layers from the main window
        if (mainWindow) {
            const layers = await mainWindow.webContents.executeJavaScript(`
                try {
                    // Check if viewer exists and has parsed DXF data
                    if (typeof window !== 'undefined' && window.viewer && window.viewer.parsedDxf) {
                        console.log('Getting DXF layers from viewer...');
                        
                        // Try to get the processed layers that were already created in loadDxfContent
                        if (window.currentDxfLayers && Array.isArray(window.currentDxfLayers)) {
                            console.log('Found existing processed layers:', window.currentDxfLayers.length);
                            return window.currentDxfLayers;
                        }
                        
                        // Fallback: try to get layers from the viewer's internal system
                        if (typeof window.viewer.GetLayers === 'function') {
                            const viewerLayers = window.viewer.GetLayers(false);
                            if (viewerLayers && Array.isArray(viewerLayers)) {
                                console.log('Got layers from viewer.GetLayers():', viewerLayers.length);
                                return viewerLayers;
                            }
                        }
                        
                        // Fallback: try to get layers from the internal map
                        if (window.viewer.layers && window.viewer.layers instanceof Map) {
                            const layersFromMap = Array.from(window.viewer.layers.values());
                            console.log('Got layers from viewer.layers map:', layersFromMap.length);
                            return layersFromMap;
                        }
                    }
                    
                    console.log('No DXF file loaded or no layers found, returning empty array');
                    return [];
                } catch (e) {
                    console.error('Error in get-dxf-layers script:', e);
                    return [];
                }
            `);
            
            if (layers && layers.length > 0) {
                return layers;
            }
        }
        
        // Return sample data if no real data available
        return [
            {
                name: '0',
                displayName: '0',
                color: 0xffffff,
                on: true,
                objectCount: 15
            },
            {
                name: 'CUT_OUTER',
                displayName: 'CUT_OUTER',
                color: 0xff0000,
                on: true,
                objectCount: 8
            },
            {
                name: 'CUT_INNER',
                displayName: 'CUT_INNER',
                color: 0x00ff00,
                on: true,
                objectCount: 12
            },
            {
                name: 'ENGRAVE',
                displayName: 'ENGRAVE',
                color: 0x0000ff,
                on: true,
                objectCount: 5
            },
            {
                name: 'DIMENSIONS',
                displayName: 'DIMENSIONS',
                color: 0xffff00,
                on: true,
                objectCount: 3
            }
        ];
    } catch (error) {
        console.error('Error getting DXF layers:', error);
        return [];
    }
});

ipcMain.handle('get-internal-line-types', async () => {
    try {
        // Load internal line types from the line types XML configuration
        const lineTypesPath = path.join(__dirname, '../../CONFIG/LineTypes/line-types.xml');
        const lineTypes = [];
        
        console.log('Loading line types from:', lineTypesPath);
        
        if (fs.existsSync(lineTypesPath)) {
            console.log('Line types XML file found, parsing...');
            const xmlContent = fs.readFileSync(lineTypesPath, 'utf8');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            // Parse line types from XML
            const lineTypesElement = xmlDoc.getElementsByTagName('LineTypes')[0];
            if (lineTypesElement) {
                const lineTypeElements = lineTypesElement.getElementsByTagName('LineType');
                console.log(`Found ${lineTypeElements.length} line types in XML`);
                
                for (let i = 0; i < lineTypeElements.length; i++) {
                    const lineType = lineTypeElements[i];
                    const id = lineType.getAttribute('id');
                    
                    if (id) {
                        const lineTypeData = {
                            id: id,
                            name: getTextContent(lineType, 'Name'),
                            description: getTextContent(lineType, 'Description'),
                            type: getTextContent(lineType, 'Type'),
                            width: parseFloat(getTextContent(lineType, 'Width')) || 0,
                            color: getTextContent(lineType, 'Color') || '#FF0000',
                            mappedLayers: [],
                            assignedTool: null
                        };
                        
                        lineTypes.push(lineTypeData);
                        console.log(`Parsed line type ${id}: ${lineTypeData.name}`);
                    }
                }
            } else {
                console.log('No LineTypes element found in XML');
            }
        } else {
            console.log('Line types XML file not found at:', lineTypesPath);
        }
        
        // If no line types found in file, return defaults
        if (lineTypes.length === 0) {
            console.log('No line types found, returning defaults');
            return [
                { 
                    name: '1st CW', 
                    mappedLayers: ['CUT_OUTER'], 
                    assignedTool: 'T2' 
                },
                { 
                    name: '2nd CW', 
                    mappedLayers: ['CUT_INNER'], 
                    assignedTool: 'T3' 
                },
                { 
                    name: '3rd CW', 
                    mappedLayers: ['ENGRAVE'], 
                    assignedTool: 'T1' 
                },
                { 
                    name: '4th CW', 
                    mappedLayers: ['DIMENSIONS'], 
                    assignedTool: 'T1' 
                }
            ];
        }
        
        console.log(`Returning ${lineTypes.length} line types from XML`);
        return lineTypes;
    } catch (error) {
        console.error('Error getting internal line types:', error);
        return [];
    }
});

ipcMain.handle('get-machine-tools', async () => {
    try {
        // First try to get tools from the active profile
        const activeProfileTools = await getToolsFromActiveProfile();
        if (activeProfileTools && Object.keys(activeProfileTools).length > 0) {
            console.log('Using tools from active profile:', Object.keys(activeProfileTools));
            return activeProfileTools;
        }
        
        console.warn('No tools found in active profile');
        return {};
    } catch (error) {
        console.error('Error getting machine tools:', error);
        return {};
    }
});



// Get layer-to-line-type mappings from a specific profile
ipcMain.handle('get-layer-mappings-from-profile', async (event, profileFilename) => {
    try {
        console.log('Getting layer mappings from profile:', profileFilename);
        const mappings = getLayerToLineTypeMappingsFromProfile(profileFilename);
        if (mappings && Object.keys(mappings).length > 0) {
            console.log('Successfully got layer mappings from profile:', Object.keys(mappings));
            return mappings;
        } else {
            console.log('No layer mappings found in profile, returning empty object');
            return {};
        }
    } catch (error) {
        console.error('Error getting layer mappings from profile:', error);
        return {};
    }
});

// Get file-specific mappings from a profile
ipcMain.handle('get-file-specific-mappings-from-profile', async (event, profileFilename, fileName, fileHash) => {
    try {
        console.log('Getting file-specific mappings from profile:', profileFilename, 'for file:', fileName);
        const mappings = getFileSpecificMappingsFromProfile(profileFilename, fileName, fileHash);
        if (mappings && Object.keys(mappings).length > 0) {
            console.log('Successfully got file-specific mappings from profile:', Object.keys(mappings));
            return mappings;
        } else {
            console.log('No file-specific mappings found in profile, returning empty object');
            return {};
        }
    } catch (error) {
        console.error('Error getting file-specific mappings from profile:', error);
        return {};
    }
});

// Get combined mappings (global + file-specific) for a specific file
ipcMain.handle('get-combined-mappings-for-file', async (event, profileFilename, fileName, filePath) => {
    try {
        console.log('Getting combined mappings for file:', fileName, 'from profile:', profileFilename);
        const combinedMappings = getCombinedMappingsForFile(profileFilename, fileName, filePath);
        console.log('Successfully got combined mappings for file:', fileName);
        return combinedMappings;
    } catch (error) {
        console.error('Error getting combined mappings for file:', error);
        return {
            globalMappings: {},
            fileSpecificMappings: null,
            combinedMappings: {},
            fileHash: null
        };
    }
});

// Save file-specific mappings to a profile
ipcMain.handle('save-file-specific-mappings-to-profile', async (event, profileFilename, fileName, fileHash, mappings, description) => {
    try {
        console.log('Saving file-specific mappings for file:', fileName, 'to profile:', profileFilename);
        const success = saveFileSpecificMappingsToProfile(profileFilename, fileName, fileHash, mappings, description);
        if (success) {
            console.log('Successfully saved file-specific mappings for file:', fileName);
            return { success: true };
        } else {
            console.log('Failed to save file-specific mappings for file:', fileName);
            return { success: false, error: 'Failed to save mappings' };
        }
    } catch (error) {
        console.error('Error saving file-specific mappings to profile:', error);
        return { success: false, error: error.message };
    }
});

// Calculate file hash
ipcMain.handle('calculate-file-hash', async (event, filePath) => {
    try {
        console.log('Calculating file hash for:', filePath);
        const hash = calculateFileHash(filePath);
        if (hash) {
            console.log('Successfully calculated file hash:', hash);
            return { success: true, hash: hash };
        } else {
            console.log('Failed to calculate file hash');
            return { success: false, error: 'Failed to calculate hash' };
        }
    } catch (error) {
        console.error('Error calculating file hash:', error);
        return { success: false, error: error.message };
    }
});

// Save unified mappings
ipcMain.handle('save-unified-mappings', async (event, mappings) => {
    try {
        // Save mappings to a configuration file
        const mappingsPath = path.join(__dirname, '../../CONFIG/mappings/unified_mappings.json');
        
        // Ensure the directory exists
        const mappingsDir = path.dirname(mappingsPath);
        if (!fs.existsSync(mappingsDir)) {
            fs.mkdirSync(mappingsDir, { recursive: true });
        }
        
        // Save the mappings with timestamp
        const mappingData = {
            timestamp: new Date().toISOString(),
            mappings: mappings
        };
        
        fs.writeFileSync(mappingsPath, JSON.stringify(mappingData, null, 2));
        console.log('Unified mappings saved successfully');
        
        return { success: true };
    } catch (error) {
        console.error('Error saving unified mappings:', error);
        throw new Error(`Failed to save mappings: ${error.message}`);
    }
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

// Global Import Filter Functions

// Load the global import filter
function loadGlobalImportFilter() {
    try {
        const configDir = path.join(process.cwd(), 'CONFIG', 'import-filters');
        const globalFilterPath = path.join(configDir, 'global_import_filter.json');
        
        if (fs.existsSync(globalFilterPath)) {
            const content = fs.readFileSync(globalFilterPath, 'utf8');
            const globalFilter = JSON.parse(content);
            console.log('Global import filter loaded successfully');
            return globalFilter;
        } else {
            console.log('Global import filter not found, creating default');
            return createDefaultGlobalImportFilter();
        }
    } catch (error) {
        console.error('Error loading global import filter:', error);
        return createDefaultGlobalImportFilter();
    }
}

// Create default global import filter
function createDefaultGlobalImportFilter() {
    const defaultFilter = {
        id: "global_import_filter",
        name: "Global Import Filter",
        description: "Single global import filter for all DXF files",
        version: "1.0",
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        active: true,
        rules: [],
        settings: {
            autoCreateRules: true,
            mergeDuplicateLayers: true,
            caseInsensitive: true,
            colorTolerance: 5,
            defaultLineTypeId: "1",
            conflictResolution: "prompt_user"
        },
        statistics: {
            totalRules: 0,
            uniqueLayers: 0,
            uniqueColors: 0,
            lastConsolidated: new Date().toISOString()
        }
    };
    
    saveGlobalImportFilter(defaultFilter);
    return defaultFilter;
}

// Save the global import filter
function saveGlobalImportFilter(globalFilter) {
    try {
        const configDir = path.join(process.cwd(), 'CONFIG', 'import-filters');
        const globalFilterPath = path.join(configDir, 'global_import_filter.json');
        
        // Ensure directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // Update metadata
        globalFilter.modified = new Date().toISOString();
        globalFilter.statistics.totalRules = globalFilter.rules.length;
        globalFilter.statistics.uniqueLayers = new Set(globalFilter.rules.map(r => r.layerName)).size;
        globalFilter.statistics.uniqueColors = new Set(globalFilter.rules.map(r => r.color)).size;
        
        fs.writeFileSync(globalFilterPath, JSON.stringify(globalFilter, null, 2), 'utf8');
        console.log('Global import filter saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving global import filter:', error);
        return false;
    }
}

// Consolidate all existing import filter profiles into the global filter
function consolidateImportFiltersToGlobal() {
    try {
        console.log('Consolidating import filters to global filter...');
        
        const configDir = path.join(process.cwd(), 'CONFIG', 'import-filters');
        const globalFilter = loadGlobalImportFilter();
        
        // Get all profile files except the global filter
        const profileFiles = fs.readdirSync(configDir)
            .filter(file => file.endsWith('.json') && file !== 'global_import_filter.json');
        
        const consolidatedRules = [];
        const ruleIdMap = new Map(); // Track rule IDs to avoid duplicates
        
        // Process each profile file
        profileFiles.forEach(profileFile => {
            try {
                const profilePath = path.join(configDir, profileFile);
                const profileContent = fs.readFileSync(profilePath, 'utf8');
                const profile = JSON.parse(profileContent);
                
                console.log(`Processing profile: ${profile.name || profileFile}`);
                
                if (profile.rules && Array.isArray(profile.rules)) {
                    profile.rules.forEach(rule => {
                        // Create unique key for rule identification
                        const ruleKey = `${rule.layerName}_${rule.color}`;
                        
                        if (!ruleIdMap.has(ruleKey)) {
                            // Generate new rule ID
                            const newRuleId = consolidatedRules.length + 1;
                            
                            // Add colorHex property for display consistency
                            const colorHex = aciToHex(parseInt(rule.color) || 7);
                            
                            const consolidatedRule = {
                                id: newRuleId,
                                layerName: rule.layerName,
                                color: rule.color,
                                colorHex: colorHex,
                                lineTypeId: rule.lineTypeId || "1",
                                description: rule.description || `Rule from ${profile.name || profileFile}`,
                                source: profile.id || profileFile.replace('.json', '')
                            };
                            
                            consolidatedRules.push(consolidatedRule);
                            ruleIdMap.set(ruleKey, newRuleId);
                            
                            console.log(`Added rule: ${rule.layerName} -> ${rule.lineTypeId}`);
                        } else {
                            console.log(`Skipped duplicate rule: ${rule.layerName}`);
                        }
                    });
                }
            } catch (error) {
                console.error(`Error processing profile ${profileFile}:`, error);
            }
        });
        
        // Update global filter with consolidated rules
        globalFilter.rules = consolidatedRules;
        globalFilter.statistics.lastConsolidated = new Date().toISOString();
        
        // Save the updated global filter
        saveGlobalImportFilter(globalFilter);
        
        console.log(`Consolidation complete: ${consolidatedRules.length} unique rules from ${profileFiles.length} profiles`);
        return {
            success: true,
            consolidatedCount: consolidatedRules.length,
            profileCount: profileFiles.length,
            globalFilter: globalFilter
        };
        
    } catch (error) {
        console.error('Error consolidating import filters:', error);
        return { success: false, error: error.message };
    }
}

// Apply global import filter to DXF layers
function applyGlobalImportFilter(dxfLayers, globalFilter) {
    try {
        console.log('Applying global import filter to DXF layers...');
        
        if (!globalFilter || !globalFilter.rules || !globalFilter.active) {
            console.log('Global import filter not available or inactive');
            return dxfLayers;
        }
        
        const appliedLayers = [];
        const unmatchedLayers = [];
        
        dxfLayers.forEach(layer => {
            // Find matching rule
            const matchingRule = findMatchingRule(layer, globalFilter.rules, globalFilter.settings);
            
            if (matchingRule) {
                // Apply the rule
                const appliedLayer = {
                    ...layer,
                    lineTypeId: matchingRule.lineTypeId,
                    importFilterApplied: true,
                    appliedRuleId: matchingRule.id,
                    appliedRuleSource: matchingRule.source
                };
                appliedLayers.push(appliedLayer);
                console.log(`Applied rule ${matchingRule.id} to layer ${layer.name}`);
            } else {
                // No matching rule found
                unmatchedLayers.push(layer);
                console.log(`No matching rule found for layer ${layer.name}`);
            }
        });
        
        console.log(`Filter applied: ${appliedLayers.length} matched, ${unmatchedLayers.length} unmatched`);
        
        return {
            appliedLayers: appliedLayers,
            unmatchedLayers: unmatchedLayers,
            totalLayers: dxfLayers.length
        };
        
    } catch (error) {
        console.error('Error applying global import filter:', error);
        return {
            appliedLayers: dxfLayers,
            unmatchedLayers: [],
            totalLayers: dxfLayers.length
        };
    }
}

// Find matching rule for a layer
function findMatchingRule(layer, rules, settings) {
    try {
        for (const rule of rules) {
            // Check layer name match
            const layerNameMatch = settings.caseInsensitive ? 
                layer.name.toLowerCase() === rule.layerName.toLowerCase() :
                layer.name === rule.layerName;
            
            if (layerNameMatch) {
                // Convert rule.color to number for comparison
                const ruleColorNum = parseInt(rule.color);
                const layerColorNum = parseInt(layer.color);
                const colorMatch = layerColorNum === ruleColorNum;
                
                if (colorMatch) {
                    return rule;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error finding matching rule:', error);
        return null;
    }
}

// Convert ACI color index to hex for display only
function aciToHex(aci) {
    // Simple ACI to hex conversion for common colors
    const aciToHexMap = {
        1: '#FF0000',    // Red
        2: '#FFFF00',    // Yellow
        3: '#00FF00',    // Green
        4: '#00FFFF',    // Cyan
        5: '#0000FF',    // Blue
        6: '#FF00FF',    // Magenta
        7: '#FFFFFF',    // White
        8: '#808080',    // Gray
        9: '#C0C0C0',    // Light Gray
        255: '#0000FF',  // Blue
        38912: '#009800', // Green (specific to your DXF)
        65407: '#00FF7F', // Light Green (specific to your DXF)
        16776960: '#FFFF00'  // Yellow (PUNCHES layer)
    };
    
    return aciToHexMap[aci] || '#FFFFFF'; // Default to white if not found
}

// Global Import Filter IPC handlers

// Load global import filter
ipcMain.handle('load-global-import-filter', async () => {
    try {
        console.log('Loading global import filter...');
        const globalFilter = loadGlobalImportFilter();
        return { success: true, data: globalFilter };
    } catch (error) {
        console.error('Error loading global import filter:', error);
        return { success: false, error: error.message };
    }
});

// Save global import filter
ipcMain.handle('save-global-import-filter', async (event, globalFilter) => {
    try {
        console.log('Saving global import filter...');
        const success = saveGlobalImportFilter(globalFilter);
        if (success) {
            return { success: true };
        } else {
            return { success: false, error: 'Failed to save global import filter' };
        }
    } catch (error) {
        console.error('Error saving global import filter:', error);
        return { success: false, error: error.message };
    }
});

// Consolidate import filters to global
ipcMain.handle('consolidate-import-filters-to-global', async () => {
    try {
        console.log('Consolidating import filters to global...');
        const result = consolidateImportFiltersToGlobal();
        if (result && result.success) {
            return { 
                success: true, 
                consolidatedCount: result.consolidatedCount || 0,
                profileCount: result.profileCount || 0,
                data: result.globalFilter || result
            };
        } else {
            return { success: false, error: 'Failed to consolidate import filters' };
        }
    } catch (error) {
        console.error('Error consolidating import filters:', error);
        return { success: false, error: error.message };
    }
});

// Apply global import filter to DXF layers
ipcMain.handle('apply-global-import-filter', async (event, dxfLayers) => {
    try {
        console.log('Applying global import filter to DXF layers...');
        const globalFilter = loadGlobalImportFilter();
        const result = applyGlobalImportFilter(dxfLayers, globalFilter);
        return { success: true, data: result };
    } catch (error) {
        console.error('Error applying global import filter:', error);
        return { success: false, error: error.message };
    }
});

// Add rule to global import filter
ipcMain.handle('add-rule-to-global-import-filter', async (event, rule) => {
    try {
        console.log('Adding rule to global import filter...');
        const globalFilter = loadGlobalImportFilter();
        
        // Generate new rule ID
        const newRuleId = globalFilter.rules.length + 1;
        
        // Add colorHex property for display consistency
        const colorHex = aciToHex(parseInt(rule.color) || 7);
        
        const newRule = {
            id: newRuleId,
            layerName: rule.layerName,
            color: rule.color,
            colorHex: colorHex,
            lineTypeId: rule.lineTypeId || "1",
            description: rule.description || `Rule for ${rule.layerName}`,
            source: rule.source || "manual"
        };
        
        globalFilter.rules.push(newRule);
        saveGlobalImportFilter(globalFilter);
        
        return { success: true, data: newRule };
    } catch (error) {
        console.error('Error adding rule to global import filter:', error);
        return { success: false, error: error.message };
    }
});

// Update rule in global import filter
ipcMain.handle('update-rule-in-global-import-filter', async (event, ruleId, updatedRule) => {
    try {
        console.log('Updating rule in global import filter...');
        const globalFilter = loadGlobalImportFilter();
        
        const ruleIndex = globalFilter.rules.findIndex(r => r.id === ruleId);
        if (ruleIndex !== -1) {
            globalFilter.rules[ruleIndex] = { ...globalFilter.rules[ruleIndex], ...updatedRule };
            saveGlobalImportFilter(globalFilter);
            return { success: true, data: globalFilter.rules[ruleIndex] };
        } else {
            return { success: false, error: 'Rule not found' };
        }
    } catch (error) {
        console.error('Error updating rule in global import filter:', error);
        return { success: false, error: error.message };
    }
});

// Delete rule from global import filter
ipcMain.handle('delete-rule-from-global-import-filter', async (event, ruleId) => {
    try {
        console.log('Deleting rule from global import filter...');
        const globalFilter = loadGlobalImportFilter();
        
        const ruleIndex = globalFilter.rules.findIndex(r => r.id === ruleId);
        if (ruleIndex !== -1) {
            const deletedRule = globalFilter.rules.splice(ruleIndex, 1)[0];
            saveGlobalImportFilter(globalFilter);
            return { success: true, data: deletedRule };
        } else {
            return { success: false, error: 'Rule not found' };
        }
    } catch (error) {
        console.error('Error deleting rule from global import filter:', error);
        return { success: false, error: error.message };
    }
});

// Unified Mapping Workflow IPC handlers

// Get tools from profile
ipcMain.handle('get-tools-from-profile', async (event, profileName = 'mtl.xml') => {
    try {
        console.log('Getting tools from profile:', profileName);
        const profilePath = path.join(__dirname, '..', '..', 'CONFIG', 'profiles', profileName);
        
        if (!fs.existsSync(profilePath)) {
            console.log('Profile not found, creating default tools');
            return { success: true, data: getDefaultTools() };
        }
        
        const profileContent = fs.readFileSync(profilePath, 'utf8');
        const tools = parseToolsFromProfile(profileContent);
        return { success: true, data: tools };
    } catch (error) {
        console.error('Error getting tools from profile:', error);
        return { success: false, error: error.message };
    }
});

// Get line type mappings from profile
ipcMain.handle('get-line-type-mappings-from-profile', async (event, profileName = 'mtl.xml') => {
    try {
        console.log('Getting line type mappings from profile:', profileName);
        const profilePath = path.join(__dirname, '..', '..', 'CONFIG', 'profiles', profileName);
        
        if (!fs.existsSync(profilePath)) {
            console.log('Profile not found, creating default mappings');
            return { success: true, data: getDefaultLineTypeMappings() };
        }
        
        const profileContent = fs.readFileSync(profilePath, 'utf8');
        const mappings = parseLineTypeMappingsFromProfile(profileContent);
        return { success: true, data: mappings };
    } catch (error) {
        console.error('Error getting line type mappings from profile:', error);
        return { success: false, error: error.message };
    }
});

    // Save line type mappings to profile
    ipcMain.handle('save-line-type-mappings-to-profile', async (event, mappings, profileName = 'mtl.xml') => {
        try {
            console.log('Saving line type mappings to profile:', profileName);
            const profilePath = path.join(__dirname, '..', '..', 'CONFIG', 'profiles', profileName);
            
            // Load existing profile or create new one
            let profileContent = '';
            if (fs.existsSync(profilePath)) {
                profileContent = fs.readFileSync(profilePath, 'utf8');
            }
            
            const updatedContent = updateProfileWithMappings(profileContent, mappings);
            fs.writeFileSync(profilePath, updatedContent, 'utf8');
            
            return { success: true };
        } catch (error) {
            console.error('Error saving line type mappings to profile:', error);
            return { success: false, error: error.message };
        }
    });

    // Machine Tool Import API
    ipcMain.handle('save-machine-tools', async (event, tools, importMode = 'add_missing') => {
        try {
            console.log('Saving machine tools to profile:', tools.length, 'tools, mode:', importMode);
            
            // Save to mtl.xml profile instead of JSON file
            const profilePath = path.join(__dirname, '..', '..', 'CONFIG', 'profiles', 'mtl.xml');
            
            // Load existing profile or create new one
            let profileContent = '';
            if (fs.existsSync(profilePath)) {
                profileContent = fs.readFileSync(profilePath, 'utf8');
            }
            
            // Parse existing tools from profile
            const existingTools = parseToolsFromProfile(profileContent);
            
            let finalTools = [];
            let importedCount = 0;
            let replacedCount = 0;
            
            switch (importMode) {
                case 'replace_all':
                    // Replace entire tool set
                    finalTools = tools;
                    importedCount = tools.length;
                    replacedCount = existingTools.length;
                    break;
                    
                case 'override_existing':
                    // Override existing tools with same T number
                    const existingToolMap = new Map();
                    existingTools.forEach(tool => {
                        existingToolMap.set(tool.id, tool);
                    });
                    
                    tools.forEach(tool => {
                        if (existingToolMap.has(tool.id)) {
                            existingToolMap.set(tool.id, tool);
                            replacedCount++;
                        } else {
                            existingToolMap.set(tool.id, tool);
                            importedCount++;
                        }
                    });
                    
                    finalTools = Array.from(existingToolMap.values());
                    break;
                    
                case 'add_missing':
                default:
                    // Add only missing tools
                    const existingIds = new Set(existingTools.map(tool => tool.id));
                    
                    tools.forEach(tool => {
                        if (!existingIds.has(tool.id)) {
                            finalTools.push(tool);
                            importedCount++;
                        }
                    });
                    
                    finalTools = [...existingTools, ...finalTools];
                    break;
            }
            
            // Update profile with new tools
            const updatedContent = updateProfileWithTools(profileContent, finalTools);
            fs.writeFileSync(profilePath, updatedContent, 'utf8');
            
            console.log(`Successfully processed tools: ${importedCount} imported, ${replacedCount} replaced`);
            return { 
                success: true, 
                importedCount: importedCount,
                replacedCount: replacedCount,
                totalTools: finalTools.length
            };
            
        } catch (error) {
            console.error('Error saving machine tools:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-machine-tool-importer', async (event) => {
        try {
            console.log('Opening machine tool importer window...');
            
            // Don't create multiple instances
            if (machineToolImporterWindow) {
                console.log('Machine tool importer window already exists, focusing...');
                machineToolImporterWindow.focus();
                return { success: true };
            }
            
            machineToolImporterWindow = new BrowserWindow({
                width: 1200,
                height: 800,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload.cjs')
                },
                title: 'Machine Tool Importer',
                icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
                show: false,
                parent: mainWindow,
                modal: false
            });

            console.log('Machine tool importer window created');

            // Add cache-busting parameter to ensure fresh load
            const cacheBust = Date.now();
            const htmlPath = path.join(__dirname, '..', 'renderer', 'machine-tool-importer.html');
            console.log('Loading HTML file:', htmlPath);
            
            await machineToolImporterWindow.loadFile(htmlPath, {
                query: { cache: cacheBust }
            });
            
            console.log('HTML file loaded successfully');
            
            // Force show the window immediately
            machineToolImporterWindow.show();
            machineToolImporterWindow.focus();
            
            machineToolImporterWindow.once('ready-to-show', () => {
                console.log('Window ready to show, displaying...');
                machineToolImporterWindow.show();
                machineToolImporterWindow.focus();
                console.log('Window should now be visible');
            });

            // Also show the window immediately after loading
            machineToolImporterWindow.once('did-finish-load', () => {
                console.log('Window finished loading, ensuring visibility...');
                if (!machineToolImporterWindow.isVisible()) {
                    machineToolImporterWindow.show();
                    machineToolImporterWindow.focus();
                }
            });

            // Handle window close
            machineToolImporterWindow.on('closed', () => {
                console.log('Machine tool importer window closed');
                machineToolImporterWindow = null;
            });

            // Add error handling for window load
            machineToolImporterWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
                console.error('Window failed to load:', errorCode, errorDescription);
            });

            return { success: true };
        } catch (error) {
            console.error('Error opening machine tool importer:', error);
            return { success: false, error: error.message };
        }
    });

    // Refresh tool configuration interface
    ipcMain.handle('refresh-tool-configuration', async (event) => {
        try {
            console.log('Refreshing tool configuration interface...');
            
            // Send refresh event to all windows
            BrowserWindow.getAllWindows().forEach(window => {
                if (window.webContents) {
                    window.webContents.send('refresh-tool-configuration');
                }
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error refreshing tool configuration:', error);
            return { success: false, error: error.message };
        }
    });

// Helper functions for Unified Mapping Workflow

function getDefaultTools() {
    return [
        { id: 'tool1', name: 'Tool 1', description: 'Default cutting tool', type: 'cut' },
        { id: 'tool2', name: 'Tool 2', description: 'Default engraving tool', type: 'engrave' },
        { id: 'tool3', name: 'Tool 3', description: 'Default marking tool', type: 'mark' }
    ];
}

function getDefaultLineTypeMappings() {
    return [
        { lineTypeId: '1', lineTypeName: '1pt CW', toolId: 'tool1', description: '1 point continuous wave' },
        { lineTypeId: '2', lineTypeName: '2pt CW', toolId: 'tool2', description: '2 point continuous wave' },
        { lineTypeId: '3', lineTypeName: '3pt CW', toolId: 'tool1', description: '3 point continuous wave' },
        { lineTypeId: '4', lineTypeName: '4pt CW', toolId: 'tool2', description: '4 point continuous wave' }
    ];
}

function parseToolsFromProfile(profileContent) {
    try {
        // Parse tools from the existing XML structure
        const toolMatches = profileContent.match(/<Tool ID="([^"]*)">[\s\S]*?<Name>([^<]*)<\/Name>[\s\S]*?<Description>([^<]*)<\/Description>[\s\S]*?<Width>([^<]*)<\/Width>[\s\S]*?<HCode>([^<]*)<\/HCode>[\s\S]*?<\/Tool>/g);
        if (!toolMatches) return getDefaultTools();
        
        return toolMatches.map(match => {
            const idMatch = match.match(/<Tool ID="([^"]*)">/);
            const nameMatch = match.match(/<Name>([^<]*)<\/Name>/);
            const descriptionMatch = match.match(/<Description>([^<]*)<\/Description>/);
            const widthMatch = match.match(/<Width>([^<]*)<\/Width>/);
            const hCodeMatch = match.match(/<HCode>([^<]*)<\/HCode>/);
            
            return {
                id: idMatch ? idMatch[1] : 'unknown',
                name: nameMatch ? nameMatch[1] : 'Unknown Tool',
                description: descriptionMatch ? descriptionMatch[1] : 'Default tool',
                width: widthMatch ? parseFloat(widthMatch[1]) : 0.5,
                hCode: hCodeMatch ? hCodeMatch[1] : 'H1',
                type: 'cut' // Default type
            };
        });
    } catch (error) {
        console.error('Error parsing tools from profile:', error);
        return getDefaultTools();
    }
}

function parseLineTypeMappingsFromProfile(profileContent) {
    try {
        // Parse LineTypeToTool mappings from the existing XML structure
        const mappingMatches = profileContent.match(/<LineTypeMapping LineType="([^"]*)" Tool="([^"]*)"\/>/g);
        if (!mappingMatches) return getDefaultLineTypeMappings();
        
        return mappingMatches.map(match => {
            const lineTypeMatch = match.match(/LineType="([^"]*)"/);
            const toolMatch = match.match(/Tool="([^"]*)"/);
            
            const lineType = lineTypeMatch ? lineTypeMatch[1] : 'unknown';
            const toolId = toolMatch ? toolMatch[1] : 'T1';
            
            return {
                lineTypeId: getLineTypeIdFromName(lineType),
                lineTypeName: lineType,
                toolId: toolId,
                description: `${lineType} mapped to ${toolId}`
            };
        });
    } catch (error) {
        console.error('Error parsing line type mappings from profile:', error);
        return getDefaultLineTypeMappings();
    }
}

function updateProfileWithMappings(profileContent, mappings) {
    try {
        let updatedContent = profileContent;
        
        // Remove existing MappingWorkflow section completely (including whitespace)
        const mappingWorkflowRegex = /<MappingWorkflow>[\s\S]*?<\/MappingWorkflow>/g;
        updatedContent = updatedContent.replace(mappingWorkflowRegex, '');
        
        // Create new MappingWorkflow section with proper formatting
        if (mappings && mappings.length > 0) {
            const newMappingWorkflow = `
    <MappingWorkflow>
        <LineTypeToTool>
            ${mappings.map(mapping => 
                `<LineTypeMapping LineType="${mapping.lineTypeName}" Tool="${mapping.toolId}"/>`
            ).join('\n            ')}
        </LineTypeToTool>
    </MappingWorkflow>`;
            
            // Add before closing PostprocessorProfile tag
            updatedContent = updatedContent.replace('</PostprocessorProfile>', `${newMappingWorkflow}\n    </PostprocessorProfile>`);
        }
        
        return updatedContent;
    } catch (error) {
        console.error('Error updating profile with mappings:', error);
        return profileContent;
    }
}

function getLineTypeName(lineTypeId) {
    const lineTypeMap = {
        '1': '1pt CW',
        '2': '2pt CW',
        '3': '3pt CW',
        '4': '4pt CW',
        '5': '2pt Puls',
        '6': '3pt Puls',
        '7': '4pt Puls',
        '8': '1.5pt CW',
        '9': '1pt Puls',
        '10': '1.5pt Puls'
    };
    return lineTypeMap[lineTypeId] || `Line Type ${lineTypeId}`;
}

function getLineTypeIdFromName(lineTypeName) {
    const lineTypeMap = {
        '1pt CW': '1',
        '2pt CW': '2',
        '3pt CW': '3',
        '4pt CW': '4',
        '2pt Puls': '5',
        '3pt Puls': '6',
        '4pt Puls': '7',
        '1.5pt CW': '8',
        '1pt Puls': '9',
        '1.5pt Puls': '10',
        'cutting': 'cutting',
        'engraving': 'engraving',
        'perforating': 'perforating',
        'scoring': 'scoring',
        'marking': 'marking',
        'construction': 'construction',
        'Fine Cut CW': 'Fine Cut CW',
        'Nozzle Engrave': 'Nozzle Engrave',
        'Engrave': 'Engrave'
    };
    return lineTypeMap[lineTypeName] || lineTypeName;
}

function generateUniqueToolId(existingTools, proposedId) {
    // Check if the proposed ID already exists
    const existingIds = existingTools.map(tool => tool.id);
    
    if (!existingIds.includes(proposedId)) {
        return proposedId;
    }
    
    // If it exists, find a unique variant
    let counter = 1;
    let newId = `${proposedId}_${counter}`;
    
    while (existingIds.includes(newId)) {
        counter++;
        newId = `${proposedId}_${counter}`;
    }
    
    return newId;
}

// Priority Configuration IPC Handlers
ipcMain.handle('save-priority-configuration', async (event, profileName, mode, items) => {
    try {
        console.log(`Saving priority configuration to profile: ${profileName}, mode: ${mode}, items: ${items.length}`);
        
        const profilePath = path.join(__dirname, '..', '..', 'CONFIG', 'profiles', profileName);
        const profileContent = fs.readFileSync(profilePath, 'utf8');
        
        // Parse the XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(profileContent, 'text/xml');
        
        // Find or create the Priority section
        let prioritySection = xmlDoc.getElementsByTagName('Priority')[0];
        if (!prioritySection) {
            prioritySection = xmlDoc.createElement('Priority');
            // Look for Optimization section first, then MappingWorkflow as fallback
            let optimizationSection = xmlDoc.getElementsByTagName('Optimization')[0];
            if (optimizationSection) {
                optimizationSection.appendChild(prioritySection);
            } else {
                const mappingWorkflow = xmlDoc.getElementsByTagName('MappingWorkflow')[0];
                if (mappingWorkflow) {
                    mappingWorkflow.appendChild(prioritySection);
                } else {
                    // If no Optimization or MappingWorkflow, add to root
                    xmlDoc.documentElement.appendChild(prioritySection);
                }
            }
        }
        
        // Clear existing PriorityItem elements
        const existingItems = prioritySection.getElementsByTagName('PriorityItem');
        for (let i = existingItems.length - 1; i >= 0; i--) {
            existingItems[i].parentNode.removeChild(existingItems[i]);
        }
        
        // Add mode attribute
        prioritySection.setAttribute('mode', mode);
        
        // Add items
        items.forEach((item, index) => {
            const itemElement = xmlDoc.createElement('PriorityItem');
            itemElement.setAttribute('order', index + 1);
            itemElement.setAttribute('value', item);
            prioritySection.appendChild(itemElement);
        });
        
        // Save the updated XML with proper line breaks for Priority items
        let updatedContent = new XMLSerializer().serializeToString(xmlDoc);
        
        // Completely replace the Priority section with clean formatting
        const priorityMatch = updatedContent.match(/(\s*)<Priority[^>]*>.*?<\/Priority>/s);
        if (priorityMatch) {
            const prioritySection = priorityMatch[0];
            
            // Extract the mode attribute and Mode element
            const modeAttrMatch = prioritySection.match(/mode="([^"]*)"/);
            const modeAttr = modeAttrMatch ? modeAttrMatch[1] : 'tool';
            const modeElementMatch = prioritySection.match(/<Mode>([^<]*)<\/Mode>/);
            const modeValue = modeElementMatch ? modeElementMatch[1] : 'lineType';
            
            // Extract PriorityItem elements
            const items = prioritySection.match(/<PriorityItem[^>]*\/>/g) || [];
            
            // Build clean Priority section with fixed indentation (8 spaces)
            let cleanPrioritySection = `        <Priority mode="${modeAttr}">\n`;
            cleanPrioritySection += `            <Mode>${modeValue}</Mode>\n`;
            
            if (items.length > 0) {
                items.forEach(item => {
                    cleanPrioritySection += `            ${item}\n`;
                });
            }
            
            cleanPrioritySection += `        </Priority>`;
            
            // Replace the entire Priority section
            updatedContent = updatedContent.replace(priorityMatch[0], '\n' + cleanPrioritySection);
        }
        
        fs.writeFileSync(profilePath, updatedContent, 'utf8');
        
        console.log(`Priority configuration saved successfully: ${items.length} items`);
        return { success: true, message: `Priority configuration saved with ${items.length} items` };
        
    } catch (error) {
        console.error('Error saving priority configuration:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-priority-configuration', async (event, profileName) => {
    try {
        console.log(`Loading priority configuration from profile: ${profileName}`);
        
        const profilePath = path.join(__dirname, '..', '..', 'CONFIG', 'profiles', profileName);
        
        if (!fs.existsSync(profilePath)) {
            console.log('Profile file not found, returning default configuration');
            return { success: true, data: { mode: 'tool', items: [] } };
        }
        
        const profileContent = fs.readFileSync(profilePath, 'utf8');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(profileContent, 'text/xml');
        
        // Find the Priority section (check Optimization first, then MappingWorkflow)
        let prioritySection = xmlDoc.getElementsByTagName('Priority')[0];
        if (!prioritySection) {
            // If not found, check if there's an existing Priority section in Optimization
            const optimizationSection = xmlDoc.getElementsByTagName('Optimization')[0];
            if (optimizationSection) {
                prioritySection = optimizationSection.getElementsByTagName('Priority')[0];
            }
        }
        
        if (!prioritySection) {
            console.log('No priority section found, returning default configuration');
            return { success: true, data: { mode: 'tool', items: [] } };
        }
        
        // Extract mode and items
        const mode = prioritySection.getAttribute('mode') || 'tool';
        const priorityItems = prioritySection.getElementsByTagName('PriorityItem');
        const items = Array.from(priorityItems)
            .sort((a, b) => parseInt(a.getAttribute('order')) - parseInt(b.getAttribute('order')))
            .map(item => item.getAttribute('value'));
        
        console.log(`Priority configuration loaded: mode=${mode}, items=${items.length}`);
        return { success: true, data: { mode, items } };
        
    } catch (error) {
        console.error('Error loading priority configuration:', error);
        return { success: false, error: error.message };
    }
});



function updateProfileWithTools(profileContent, tools) {
    try {
        // Update the existing Tools section
        let updatedContent = profileContent;
        
        // Find the Tools section
        const toolsRegex = /<Tools>[\s\S]*?<\/Tools>/g;
        const existingMatch = updatedContent.match(toolsRegex);
        
        if (existingMatch) {
            // Replace existing Tools section
            const newTools = `
        <Tools>
            ${tools.map(tool => `
            <Tool ID="${tool.id}">
                <Name>${tool.name}</Name>
                <Description>${tool.description}</Description>
                <Width>${tool.width}</Width>
                <HCode>${tool.hCode}</HCode>
            </Tool>`).join('\n            ')}
        </Tools>`;
            
            updatedContent = updatedContent.replace(toolsRegex, newTools);
        } else {
            // Add new Tools section before closing MappingWorkflow tag
            const newTools = `
        <Tools>
            ${tools.map(tool => `
            <Tool ID="${tool.id}">
                <Name>${tool.name}</Name>
                <Description>${tool.description}</Description>
                <Width>${tool.width}</Width>
                <HCode>${tool.hCode}</HCode>
            </Tool>`).join('\n            ')}
        </Tools>`;
            
            updatedContent = updatedContent.replace('</MappingWorkflow>', `${newTools}\n    </MappingWorkflow>`);
        }
        
        return updatedContent;
    } catch (error) {
        console.error('Error updating profile with tools:', error);
        return profileContent;
    }
}