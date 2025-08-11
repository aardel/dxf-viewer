const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Batch Monitor API
    openBatchMonitor: () => ipcRenderer.send('open-batch-monitor'),
    // File operations
    showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
    showDirectoryDialog: () => ipcRenderer.invoke('show-directory-dialog'),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    showErrorDialog: (title, message) => ipcRenderer.invoke('show-error-dialog', title, message),
    saveLayerMapping: (content, defaultFilename) => ipcRenderer.invoke('save-layer-mapping', content, defaultFilename),
    saveLayerMappingFixed: (content, filename, dxfFilePath) => ipcRenderer.invoke('save-layer-mapping-fixed', content, filename, dxfFilePath),
    saveDinFile: (content, filename, savePath) => ipcRenderer.invoke('save-din-file', content, filename, savePath),
    
        // Line Types API
    loadLineTypes: () => ipcRenderer.invoke('load-line-types'),
    saveLineTypes: (lineTypes) => ipcRenderer.invoke('save-line-types', lineTypes),
    saveLineType: (lineType) => ipcRenderer.invoke('save-line-type', lineType),
    deleteLineType: (lineTypeId) => ipcRenderer.invoke('delete-line-type', lineTypeId),
    openLineTypesManager: () => ipcRenderer.invoke('open-line-types-manager'),





    // Global Import Filter API
    loadGlobalImportFilter: () => ipcRenderer.invoke('load-global-import-filter'),
    saveGlobalImportFilter: (filterData) => ipcRenderer.invoke('save-global-import-filter', filterData),
    applyGlobalImportFilter: (layers) => ipcRenderer.invoke('apply-global-import-filter', layers),
    addRuleToGlobalImportFilter: (ruleData) => ipcRenderer.invoke('add-rule-to-global-import-filter', ruleData),
    syncRuleToActiveProfile: (payload) => ipcRenderer.invoke('sync-rule-to-active-profile', payload),
    updateRuleInGlobalImportFilter: (ruleId, ruleData) => ipcRenderer.invoke('update-rule-in-global-import-filter', ruleId, ruleData),
    deleteRuleFromGlobalImportFilter: (ruleId) => ipcRenderer.invoke('delete-rule-from-global-import-filter', ruleId),

    openGlobalImportFilterManager: () => ipcRenderer.invoke('open-global-import-filter-manager'),

    // Postprocessor Configuration API
    loadPostprocessorConfig: (profileName) => ipcRenderer.invoke('load-postprocessor-config', profileName),
    loadToolLibrary: (libraryName) => ipcRenderer.invoke('load-tool-library', libraryName),
    loadOptimizationConfig: () => ipcRenderer.invoke('load-optimization-config'),
    savePostprocessorConfig: (profileName, configData) => ipcRenderer.invoke('save-postprocessor-config', profileName, configData),
    
    // XML Profile Management API
    loadXmlProfiles: () => ipcRenderer.invoke('load-xml-profiles'),
    loadXmlProfile: (filename) => ipcRenderer.invoke('load-xml-profile', filename),
    saveXmlProfile: (filename, configData) => ipcRenderer.invoke('save-xml-profile', filename, configData),
    deleteXmlProfile: (filename) => ipcRenderer.invoke('delete-xml-profile', filename),
    getCurrentProfile: () => ipcRenderer.invoke('get-current-profile'),
    getMainWindowCurrentProfile: () => ipcRenderer.invoke('get-main-window-current-profile'),

    // DXF Viewer API
    parseUnified: (content, filename) => ipcRenderer.invoke('parse-unified', content, filename),
    clearCache: () => ipcRenderer.invoke('clear-cache'),

    // Unified Mapping Window API
    openUnifiedMappingWindow: () => ipcRenderer.invoke('open-unified-mapping-window'),
    closeUnifiedMappingWindow: () => ipcRenderer.invoke('close-unified-mapping-window'),
    getDxfLayers: () => ipcRenderer.invoke('get-dxf-layers'),
    getInternalLineTypes: () => ipcRenderer.invoke('get-internal-line-types'),
    getMachineTools: () => ipcRenderer.invoke('get-machine-tools'),
    saveUnifiedMappings: (mappings) => ipcRenderer.invoke('save-unified-mappings', mappings),
    
    // Profile-based Mapping API
    getToolsFromProfile: (profileName) => ipcRenderer.invoke('get-tools-from-profile', profileName),
    getLineTypeMappingsFromProfile: (profileName) => ipcRenderer.invoke('get-line-type-mappings-from-profile', profileName),
    saveLineTypeMappingsToProfile: (mappings, profileName) => ipcRenderer.invoke('save-line-type-mappings-to-profile', mappings, profileName),
    updateOutputSettingsOnly: (outputSettings, profileName) => ipcRenderer.invoke('update-output-settings-only', outputSettings, profileName),
    
            // Machine Tool Import API
        saveMachineTools: (tools, importMode, profileName) => ipcRenderer.invoke('save-machine-tools', tools, importMode, profileName),
        
        // Output Manager API
        updateOutputManagerTitle: (profileName) => ipcRenderer.invoke('update-output-manager-title', profileName),
    openMachineToolImporter: () => ipcRenderer.invoke('open-machine-tool-importer'),
    refreshToolConfiguration: () => ipcRenderer.invoke('refresh-tool-configuration'),
    // Output Manager
    openOutputManager: () => ipcRenderer.invoke('open-output-manager'),
    
    // Priority Configuration API
    savePriorityConfiguration: (profileName, mode, items) => ipcRenderer.invoke('save-priority-configuration', profileName, mode, items),
    loadPriorityConfiguration: (profileName) => ipcRenderer.invoke('load-priority-configuration', profileName),

    // Configuration validation
    validateConfiguration: () => ipcRenderer.invoke('validate-configuration'),
    fixConfigurationIssue: (issue) => ipcRenderer.invoke('fix-configuration-issue', issue),

    // Event listeners
    onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
    onClearViewer: (callback) => ipcRenderer.on('clear-viewer', callback),
    onFitToView: (callback) => ipcRenderer.on('fit-to-view', callback),
    onWindowResized: (callback) => ipcRenderer.on('window-resized', callback),
    onRulesUpdated: (callback) => ipcRenderer.on('rules-updated', callback),
    onRefreshToolConfiguration: (callback) => ipcRenderer.on('refresh-tool-configuration', callback),

    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});