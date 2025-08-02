const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    showErrorDialog: (title, message) => ipcRenderer.invoke('show-error-dialog', title, message),
    saveLayerMapping: (content, defaultFilename) => ipcRenderer.invoke('save-layer-mapping', content, defaultFilename),
    saveLayerMappingFixed: (content, filename, dxfFilePath) => ipcRenderer.invoke('save-layer-mapping-fixed', content, filename, dxfFilePath),
    
        // Line Types API
    loadLineTypes: () => ipcRenderer.invoke('load-line-types'),
    saveLineType: (lineType) => ipcRenderer.invoke('save-line-type', lineType),
    deleteLineType: (lineTypeId) => ipcRenderer.invoke('delete-line-type', lineTypeId),
    openLineTypesManager: () => ipcRenderer.invoke('open-line-types-manager'),

    // Import Filters API
    loadImportFilters: () => ipcRenderer.invoke('load-import-filters'),
    saveImportFilter: (profile) => ipcRenderer.invoke('save-import-filter', profile),
    deleteImportFilter: (profileId) => ipcRenderer.invoke('delete-import-filter', profileId),
    openImportFiltersManager: () => ipcRenderer.invoke('open-import-filters-manager'),

    // DXF Viewer API

    // Event listeners
    onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
    onClearViewer: (callback) => ipcRenderer.on('clear-viewer', callback),
    onFitToView: (callback) => ipcRenderer.on('fit-to-view', callback),
    onWindowResized: (callback) => ipcRenderer.on('window-resized', callback),

    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});