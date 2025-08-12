/**
 * DXF Batch Monitor - Enhanced File Watching and Processing
 * Adapted from existing batch processing infrastructure for DXF workflow
 */

const { ipcRenderer } = require('electron');
const path = require('path');

class DXFBatchMonitor {
    constructor() {
        // Core state (adapted from existing batch processor)
        this.fileQueue = [];
        this.processedResults = [];
        this.isMonitoring = false;
        this.isProcessing = false;
        
        // Monitoring configuration
        this.inputFolder = '';
        this.outputFolder = '';
        this.watcherActive = false;
        
        // Statistics
        this.stats = {
            sessionProcessed: 0,
            sessionSuccessful: 0,
            sessionFailed: 0
        };
        
        // File stability tracking (10-second wait as requested)
        this.fileStabilityDelay = 10000; // 10 seconds
        this.pendingFiles = new Map(); // Track files waiting for stability
        
        // UI elements cache
        this.elements = {};
        
        // Log storage for filtering/search/export
        this.processingLogEntries = [];
        this.outputLogEntries = [];

        this.init();
    }

    /**
     * Initialize the batch monitor (similar to existing BatchInitializer)
     */
    init() {
        console.log('DXF Batch Monitor initializing...');
        
        // Cache DOM elements
        this.cacheElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up IPC communication with main process
        this.setupIPC();
        
        // Load saved settings
        this.loadSettings();
        
        // Initialize logs
        this.addLogEntry('Batch monitor initialized and ready', 'info');
        this.addOutputLogEntry('Output monitor ready', 'info');
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        this.elements = {
            // Status indicators
            monitoringStatus: document.getElementById('monitoringStatus'),
            queueCount: document.getElementById('queueCount'),
            successCount: document.getElementById('successCount'),
            errorCount: document.getElementById('errorCount'),
            
            // Input controls
            inputFolder: document.getElementById('inputFolder'),
            outputFolder: document.getElementById('outputFolder'),
            browseInputBtn: document.getElementById('browseInputBtn'),
            browseOutputBtn: document.getElementById('browseOutputBtn'),
            
            // Monitoring controls
            startMonitoringBtn: document.getElementById('startMonitoringBtn'),
            stopMonitoringBtn: document.getElementById('stopMonitoringBtn'),
            manualScanBtn: document.getElementById('manualScanBtn'),
            
            // File lists and logs
            fileQueue: document.getElementById('fileQueue'),
            recentResults: document.getElementById('recentResults'),
            processingLog: document.getElementById('processingLog'),
            outputLog: document.getElementById('outputLog'),
            
            // Clear buttons
            clearLogBtn: document.getElementById('clearLogBtn'),
            clearOutputLogBtn: document.getElementById('clearOutputLogBtn'),
            clearResultsBtn: document.getElementById('clearResultsBtn'),

            // Log filter/search/export
            processingLogFilter: document.getElementById('processingLogFilter'),
            processingLogSearch: document.getElementById('processingLogSearch'),
            exportProcessingLogBtn: document.getElementById('exportProcessingLogBtn'),
            outputLogFilter: document.getElementById('outputLogFilter'),
            outputLogSearch: document.getElementById('outputLogSearch'),
            exportOutputLogBtn: document.getElementById('exportOutputLogBtn')
        };
    }

    /**
     * Set up event listeners (adapted from existing batch code)
     */
    setupEventListeners() {
        // Folder browsing
        this.elements.browseInputBtn.addEventListener('click', () => this.browseFolder('input'));
        this.elements.browseOutputBtn.addEventListener('click', () => this.browseFolder('output'));
        
        // Monitoring controls
        this.elements.startMonitoringBtn.addEventListener('click', () => this.startMonitoring());
        this.elements.stopMonitoringBtn.addEventListener('click', () => this.stopMonitoring());
        this.elements.manualScanBtn.addEventListener('click', () => this.manualScan());
        
        // Clear buttons
        this.elements.clearLogBtn.addEventListener('click', () => this.clearLog('processing'));
        this.elements.clearOutputLogBtn.addEventListener('click', () => this.clearLog('output'));
        this.elements.clearResultsBtn.addEventListener('click', () => this.clearResults());
        
        // Folder input changes
        this.elements.inputFolder.addEventListener('change', () => this.saveSettings());
        this.elements.outputFolder.addEventListener('change', () => this.saveSettings());
        
        // Window close handling
        window.addEventListener('beforeunload', () => {
            this.stopMonitoring();
            this.saveSettings();
        });
        
        // Log filter/search/export events
        this.elements.processingLogFilter.addEventListener('change', () => this.renderProcessingLog());
        this.elements.processingLogSearch.addEventListener('input', () => this.renderProcessingLog());
        this.elements.exportProcessingLogBtn.addEventListener('click', () => this.exportLog('processing'));

        this.elements.outputLogFilter.addEventListener('change', () => this.renderOutputLog());
        this.elements.outputLogSearch.addEventListener('input', () => this.renderOutputLog());
        this.elements.exportOutputLogBtn.addEventListener('click', () => this.exportLog('output'));
    }

    /**
     * Set up IPC communication with main process
     */
    setupIPC() {
        // File watcher events
        ipcRenderer.on('file-added', (event, filePath) => {
            this.handleFileDetected(filePath);
        });
        
        ipcRenderer.on('file-removed', (event, filePath) => {
            this.handleFileRemoved(filePath);
        });
        
        ipcRenderer.on('watcher-error', (event, error) => {
            this.addLogEntry(`File watcher error: ${error}`, 'error');
        });
        
        // Main app communication for DXF processing
        ipcRenderer.on('dxf-processing-complete', (event, result) => {
            this.handleProcessingComplete(result);
        });
        
        ipcRenderer.on('dxf-processing-error', (event, error) => {
            this.handleProcessingError(error);
        });
    }

    /**
     * Browse for folder (input or output)
     */
    async browseFolder(type) {
        try {
            const result = await ipcRenderer.invoke('select-folder');
            if (result && !result.canceled && result.filePaths.length > 0) {
                const folderPath = result.filePaths[0];
                
                if (type === 'input') {
                    this.elements.inputFolder.value = folderPath;
                    this.inputFolder = folderPath;
                } else {
                    this.elements.outputFolder.value = folderPath;
                    this.outputFolder = folderPath;
                }
                
                this.saveSettings();
                this.addLogEntry(`${type === 'input' ? 'Input' : 'Output'} folder set: ${folderPath}`, 'info');
            }
        } catch (error) {
            this.addLogEntry(`Error selecting folder: ${error.message}`, 'error');
        }
    }

    /**
     * Start folder monitoring
     */
    async startMonitoring() {
        if (!this.inputFolder) {
            this.addLogEntry('Please select an input folder first', 'warning');
            return;
        }
        
        if (!this.outputFolder) {
            this.addLogEntry('Please select an output folder first', 'warning');
            return;
        }

        try {
            // Start file watcher via main process
            await ipcRenderer.invoke('start-file-watcher', this.inputFolder);
            
            this.isMonitoring = true;
            this.watcherActive = true;
            
            // Update UI
            this.updateMonitoringStatus(true);
            this.elements.startMonitoringBtn.disabled = true;
            this.elements.stopMonitoringBtn.disabled = false;
            
            this.addLogEntry(`Started monitoring: ${this.inputFolder}`, 'success');
            
            // Perform initial scan
            this.manualScan();
            
        } catch (error) {
            this.addLogEntry(`Failed to start monitoring: ${error.message}`, 'error');
        }
    }

    /**
     * Stop folder monitoring
     */
    async stopMonitoring() {
        try {
            await ipcRenderer.invoke('stop-file-watcher');
            
            this.isMonitoring = false;
            this.watcherActive = false;
            
            // Update UI
            this.updateMonitoringStatus(false);
            this.elements.startMonitoringBtn.disabled = false;
            this.elements.stopMonitoringBtn.disabled = true;
            
            this.addLogEntry('Monitoring stopped', 'info');
            
        } catch (error) {
            this.addLogEntry(`Error stopping monitoring: ${error.message}`, 'error');
        }
    }

    /**
     * Perform manual scan of input folder
     */
    async manualScan() {
        if (!this.inputFolder) {
            this.addLogEntry('No input folder selected', 'warning');
            return;
        }

        try {
            this.addLogEntry('Performing manual scan...', 'info');
            const files = await ipcRenderer.invoke('scan-folder', this.inputFolder);
            
            // Filter for supported files (DXF, DDS, CF2)
            const supportedFiles = files.filter(file => {
                const ext = file.toLowerCase();
                return ext.endsWith('.dxf') || ext.endsWith('.dds') || ext.endsWith('.cf2');
            });
            
            if (supportedFiles.length === 0) {
                this.addLogEntry('No supported files (DXF, DDS, CF2) found in input folder', 'info');
                return;
            }
            
            // Add files to queue
            for (const file of supportedFiles) {
                const fullPath = path.join(this.inputFolder, file);
                if (!this.isFileInQueue(fullPath)) {
                    this.addFileToQueue(fullPath);
                }
            }
            
            this.addLogEntry(`Manual scan complete: ${supportedFiles.length} supported files found`, 'success');
            
        } catch (error) {
            this.addLogEntry(`Manual scan failed: ${error.message}`, 'error');
        }
    }

    /**
     * Handle file detected by watcher
     */
    handleFileDetected(filePath) {
        // Check if it's a supported file (DXF, DDS, CF2)
        const ext = filePath.toLowerCase();
        if (!ext.endsWith('.dxf') && !ext.endsWith('.dds') && !ext.endsWith('.cf2')) {
            return;
        }
        
        // Check if already in queue or being tracked
        if (this.isFileInQueue(filePath) || this.pendingFiles.has(filePath)) {
            return;
        }
        
        this.addLogEntry(`File detected: ${path.basename(filePath)}`, 'info');
        
        // Start stability timer (10 seconds as requested)
        this.pendingFiles.set(filePath, {
            detectTime: Date.now(),
            timer: setTimeout(() => {
                this.handleFileStable(filePath);
            }, this.fileStabilityDelay)
        });
        
        this.addLogEntry(`Waiting for file stability: ${path.basename(filePath)} (${this.fileStabilityDelay/1000}s)`, 'info');
    }

    /**
     * Handle file becoming stable (10 seconds without changes)
     */
    handleFileStable(filePath) {
        if (this.pendingFiles.has(filePath)) {
            this.pendingFiles.delete(filePath);
            this.addFileToQueue(filePath);
            this.addLogEntry(`File stable, added to queue: ${path.basename(filePath)}`, 'success');
        }
    }

    /**
     * Handle file removed from folder
     */
    handleFileRemoved(filePath) {
        // Cancel pending file if it was removed
        if (this.pendingFiles.has(filePath)) {
            clearTimeout(this.pendingFiles.get(filePath).timer);
            this.pendingFiles.delete(filePath);
            this.addLogEntry(`File removed before processing: ${path.basename(filePath)}`, 'warning');
        }
        
        // Remove from queue if present
        this.removeFileFromQueue(filePath);
    }

    /**
     * Add file to processing queue (adapted from existing batch code)
     */
    addFileToQueue(filePath) {
        const fileName = path.basename(filePath);
        
        // Check for duplicates
        if (this.isFileInQueue(filePath)) {
            return;
        }
        
        const fileItem = {
            path: filePath,
            name: fileName,
            status: 'pending',
            addedAt: new Date(),
            size: 0 // Will be populated by file stats
        };
        
        this.fileQueue.push(fileItem);
        this.updateFileQueueUI();
        
        // Start processing immediately if not already processing
        if (!this.isProcessing) {
            this.processNextFile();
        }
    }

    /**
     * Check if file is already in queue
     */
    isFileInQueue(filePath) {
        return this.fileQueue.some(item => item.path === filePath);
    }

    /**
     * Remove file from queue
     */
    removeFileFromQueue(filePath) {
        const initialLength = this.fileQueue.length;
        this.fileQueue = this.fileQueue.filter(item => item.path !== filePath);
        
        if (this.fileQueue.length !== initialLength) {
            this.updateFileQueueUI();
        }
    }

    /**
     * Process next file in queue (using silent processing functions from main app)
     */
    async processNextFile() {
        if (this.isProcessing || this.fileQueue.length === 0) {
            return;
        }

        // Prevent processing if output folder is not set
        if (!this.outputFolder) {
            this.addLogEntry('Output folder is not set. Cannot process files.', 'error');
            // Mark all pending files as error
            this.fileQueue.forEach(item => {
                if (item.status === 'pending') {
                    item.status = 'error';
                    this.handleProcessingError(item, 'Output folder not set');
                }
            });
            this.updateFileQueueUI();
            return;
        }

        const fileItem = this.fileQueue.find(item => item.status === 'pending');
        if (!fileItem) {
            return;
        }

        this.isProcessing = true;
        fileItem.status = 'processing';
        this.updateFileQueueUI();

        this.addLogEntry(`Processing: ${fileItem.name}`, 'info');

        try {
            // Generate output path
            const fileName = fileItem.name.replace(/\.[^/.]+$/, ''); // Remove extension
            const outputPath = path.join(this.outputFolder, `${fileName}.din`);
            
            // Use IPC to call the unified processing function in the main app
            const result = await ipcRenderer.invoke('process-unified-file', { inputPath: fileItem.path, outputFolder: this.outputFolder });

            if (result.success) {
                fileItem.status = 'completed';
                this.handleProcessingSuccess(fileItem, result);
            } else {
                fileItem.status = 'error';
                this.handleProcessingError(fileItem, result.error || 'Unknown error', result.reason);
            }

        } catch (error) {
            fileItem.status = 'error';
            this.handleProcessingError(fileItem, error.message);
        }

        this.isProcessing = false;
        this.updateFileQueueUI();

        // Process next file
        setTimeout(() => {
            this.processNextFile();
        }, 300); // Add a 300ms delay to avoid EMFILE errors
    }

    /**
     * Handle successful processing
     */
    handleProcessingSuccess(fileItem, result) {
        this.stats.sessionSuccessful++;
        this.stats.sessionProcessed++;
        
        const resultItem = {
            ...fileItem,
            processedAt: new Date(),
            outputPath: result.outputPath
        };
        
        this.processedResults.unshift(resultItem);
        
        // Keep only last 50 results
        if (this.processedResults.length > 50) {
            this.processedResults = this.processedResults.slice(0, 50);
        }
        
        this.updateStatistics();
        this.updateResultsUI();
        
        this.addLogEntry(`✅ Successfully processed: ${fileItem.name}`, 'success');
        this.addOutputLogEntry(`Generated: ${path.basename(result.outputPath)}`, 'success');
        
        // Remove from queue
        this.removeFileFromQueue(fileItem.path);
    }

    /**
     * Handle processing error
     */
    handleProcessingError(fileItem, error, reason = null) {
        this.stats.sessionFailed++;
        this.stats.sessionProcessed++;
        
        const resultItem = {
            ...fileItem,
            processedAt: new Date(),
            error: error,
            reason: reason
        };
        
        this.processedResults.unshift(resultItem);
        
        this.updateStatistics();
        this.updateResultsUI();
        
        // Log different types of errors with appropriate levels
        let logLevel = 'error';
        let logMessage = `❌ Failed to process: ${fileItem.name} - ${error}`;
        
        if (reason === 'incomplete_mappings') {
            logLevel = 'warning';
            logMessage = `⚠️ Skipped (incomplete mappings): ${fileItem.name} - ${error}`;
        } else if (reason === 'load_failed') {
            logMessage = `❌ Failed to load: ${fileItem.name} - ${error}`;
        } else if (reason === 'generation_failed') {
            logMessage = `❌ Generation failed: ${fileItem.name} - ${error}`;
        }
        
        this.addLogEntry(logMessage, logLevel);
        
        // Remove from queue
        this.removeFileFromQueue(fileItem.path);
    }

    /**
     * Update file queue UI (adapted from existing batch UI code)
     */
    updateFileQueueUI() {
        if (this.fileQueue.length === 0) {
            this.elements.fileQueue.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <div class="empty-state-text">No files in queue</div>
                    <div class="empty-state-subtext">DXF files will appear here when detected</div>
                </div>
            `;
        } else {
            const html = this.fileQueue.map(item => `
                <div class="file-item">
                    <div class="file-name">${item.name}</div>
                    <div class="file-status ${item.status}">${item.status.toUpperCase()}</div>
                </div>
            `).join('');
            
            this.elements.fileQueue.innerHTML = html;
        }
        
        this.elements.queueCount.textContent = `${this.fileQueue.length} files`;
    }

    /**
     * Update results UI
     */
    updateResultsUI() {
        if (this.processedResults.length === 0) {
            this.elements.recentResults.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div class="empty-state-text">No processing results yet</div>
                    <div class="empty-state-subtext">Completed operations will appear here</div>
                </div>
            `;
        } else {
            const html = this.processedResults.slice(0, 10).map(item => `
                <div class="file-item">
                    <div class="file-name">${item.name}</div>
                    <div class="file-status ${item.status}">${item.status.toUpperCase()}</div>
                </div>
            `).join('');
            
            this.elements.recentResults.innerHTML = html;
        }
    }

    /**
     * Update statistics display
     */
    updateStatistics() {
        this.elements.successCount.textContent = this.stats.sessionSuccessful;
        this.elements.errorCount.textContent = this.stats.sessionFailed;
    }

    /**
     * Update monitoring status indicator
     */
    updateMonitoringStatus(active) {
        if (active) {
            this.elements.monitoringStatus.className = 'status-indicator active';
            this.elements.monitoringStatus.innerHTML = `
                <div class="status-dot"></div>
                <span>Monitoring Active</span>
            `;
        } else {
            this.elements.monitoringStatus.className = 'status-indicator inactive';
            this.elements.monitoringStatus.innerHTML = `
                <div class="status-dot"></div>
                <span>Monitoring Inactive</span>
            `;
        }
    }

    /**
     * Add entry to processing log
     */
    addLogEntry(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        this.processingLogEntries.push({ timestamp, level, message });
        if (this.processingLogEntries.length > 1000) this.processingLogEntries.shift();
        this.renderProcessingLog();
    }

    /**
     * Add entry to output log
     */
    addOutputLogEntry(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        this.outputLogEntries.push({ timestamp, level, message });
        if (this.outputLogEntries.length > 1000) this.outputLogEntries.shift();
        this.renderOutputLog();
    }

    renderProcessingLog() {
        const filter = this.elements.processingLogFilter.value;
        const search = this.elements.processingLogSearch.value.toLowerCase();
        const log = this.processingLogEntries
            .filter(entry => (filter === 'all' || entry.level === filter))
            .filter(entry => entry.message.toLowerCase().includes(search));
        this.elements.processingLog.innerHTML = log.map(entry =>
            `<div class="log-entry">
                <span class="log-timestamp">[${entry.timestamp}]</span>
                <span class="log-level-${entry.level}">[${entry.level.toUpperCase()}]</span>
                <span>${entry.message}</span>
            </div>`
        ).join('') || '<div class="log-entry">No log entries.</div>';
        this.elements.processingLog.scrollTop = this.elements.processingLog.scrollHeight;
    }

    renderOutputLog() {
        const filter = this.elements.outputLogFilter.value;
        const search = this.elements.outputLogSearch.value.toLowerCase();
        const log = this.outputLogEntries
            .filter(entry => (filter === 'all' || entry.level === filter))
            .filter(entry => entry.message.toLowerCase().includes(search));
        this.elements.outputLog.innerHTML = log.map(entry =>
            `<div class="log-entry">
                <span class="log-timestamp">[${entry.timestamp}]</span>
                <span class="log-level-${entry.level}">[${entry.level.toUpperCase()}]</span>
                <span>${entry.message}</span>
            </div>`
        ).join('') || '<div class="log-entry">No log entries.</div>';
        this.elements.outputLog.scrollTop = this.elements.outputLog.scrollHeight;
    }

    exportLog(type) {
        let entries = [];
        let filename = '';
        if (type === 'processing') {
            entries = this.processingLogEntries;
            filename = 'processing-log.csv';
        } else {
            entries = this.outputLogEntries;
            filename = 'output-log.csv';
        }
        if (!entries.length) return;
        const csv = 'Timestamp,Level,Message\n' + entries.map(e =>
            `"${e.timestamp}","${e.level}","${e.message.replace(/"/g, '""')}"`
        ).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    /**
     * Clear log content
     */
    clearLog(type) {
        if (type === 'processing') {
            this.elements.processingLog.innerHTML = '';
            this.addLogEntry('Log cleared', 'info');
        } else if (type === 'output') {
            this.elements.outputLog.innerHTML = '';
            this.addOutputLogEntry('Output log cleared', 'info');
        }
    }

    /**
     * Clear results
     */
    clearResults() {
        this.processedResults = [];
        this.updateResultsUI();
        this.addOutputLogEntry('Results cleared', 'info');
    }

    /**
     * Save settings to electron-store
     */
    async saveSettings() {
        const settings = {
            inputFolder: this.inputFolder,
            outputFolder: this.outputFolder,
            fileStabilityDelay: this.fileStabilityDelay
        };
        
        try {
            await ipcRenderer.invoke('save-batch-settings', settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    /**
     * Load settings from electron-store
     */
    async loadSettings() {
        try {
            const settings = await ipcRenderer.invoke('load-batch-settings');
            if (settings) {
                this.inputFolder = settings.inputFolder || '';
                this.outputFolder = settings.outputFolder || '';
                this.fileStabilityDelay = settings.fileStabilityDelay || 10000;
                
                this.elements.inputFolder.value = this.inputFolder;
                this.elements.outputFolder.value = this.outputFolder;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.batchMonitor = new DXFBatchMonitor();
});
