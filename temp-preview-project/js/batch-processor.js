/**
 * NC File Converter Batch Processing Module
 * Handles processing multiple files at once
 */

NCConverter.BatchProcessor = {
  /**
   * Files queue for batch processing
   */
  fileQueue: [],
  
  /**
   * Conversion results
   */
  results: [],
  
  /**
   * Whether a batch process is currently running
   */
  isProcessing: false,
  
  /**
   * Initialize the batch processor module
   */
  init: function() {
    // Create batch processing UI
    this.createBatchUI();
    
    // Add batch tab activation event
    const batchTab = document.querySelector('[data-tab="batch"]');
    if (batchTab) {
      batchTab.addEventListener('click', this.refreshBatchUI.bind(this));
    }
  },
  
  /**
   * Create batch processing UI elements
   */
  createBatchUI: function() {
    // Create batch tab and content if they don't exist
    if (!document.getElementById('tab-batch')) {
      // Add tab header
      const tabList = document.querySelector('.tab-headers');
      if (tabList) {
        const batchTab = document.createElement('div');
        batchTab.className = 'tab-header';
        batchTab.setAttribute('data-tab', 'batch');
        batchTab.setAttribute('tabindex', '0');
        batchTab.setAttribute('role', 'tab');
        batchTab.setAttribute('aria-selected', 'false');
        batchTab.setAttribute('aria-controls', 'batch-tab');
        batchTab.setAttribute('id', 'tab-batch');
        batchTab.textContent = 'Batch Processing';
        tabList.appendChild(batchTab);
      }
      
      // Add tab content
      const tabsContainer = document.querySelector('.tabs');
      if (tabsContainer) {
        const batchContent = document.createElement('div');
        batchContent.className = 'tab-content';
        batchContent.id = 'batch-tab';
        batchContent.setAttribute('role', 'tabpanel');
        batchContent.setAttribute('aria-labelledby', 'tab-batch');
        batchContent.style.display = 'none';
        
        batchContent.innerHTML = `
          <h3>Batch File Processing</h3>
          <p>Process multiple NC files at once with the same conversion settings.</p>
          
          <div class="card" style="margin-bottom: var(--space-4);">
            <div class="card-body">
              <div class="file-area batch-drop-area" id="batchFileArea" tabindex="0" role="button" aria-label="Select or drop multiple NC files for batch conversion">
                <div class="file-icon" aria-hidden="true">📂</div>
                <p>Click or drop multiple NC files here</p>
                <input type="file" id="batchFileInput" multiple style="display:none;" aria-hidden="true">
              </div>
              
              <div id="batchFileList" style="margin-top: var(--space-3); max-height: 200px; overflow-y: auto; border: 1px solid var(--gray-300); border-radius: var(--border-radius-sm); padding: var(--space-2);"></div>
              
              <div style="margin-top: var(--space-3); display: flex; gap: var(--space-2);">
                <button id="clearBatchBtn" class="btn-secondary" disabled>Clear Files</button>
                <button id="processBatchBtn" class="btn" disabled>Process Files</button>
              </div>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">
              <h4 style="margin-bottom: 0;">Batch Results</h4>
            </div>
            <div class="card-body">
              <div id="batchResults" style="margin-bottom: var(--space-3);">
                <p class="text-center" style="color: var(--gray-500); font-style: italic;">No files processed yet.</p>
              </div>
              
              <div id="batchActions" style="display: none;">
                <button id="downloadAllBtn" class="btn">
                  <i class="icon">⬇️</i> Download All (ZIP)
                </button>
                <button id="saveAllToPathBtn" class="btn" style="margin-left: var(--space-2);">
                  <i class="icon">💾</i> Save All to Path
                </button>
              </div>
            </div>
          </div>
        `;
        
        tabsContainer.appendChild(batchContent);
        
        // Set up event listeners for batch UI
        this.setupBatchEventListeners();
      }
    }
  },
  
  /**
   * Set up event listeners for batch processing UI
   */
  setupBatchEventListeners: function() {
    const batchFileArea = document.getElementById('batchFileArea');
    const batchFileInput = document.getElementById('batchFileInput');
    const clearBatchBtn = document.getElementById('clearBatchBtn');
    const processBatchBtn = document.getElementById('processBatchBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const saveAllToPathBtn = document.getElementById('saveAllToPathBtn');
    
    if (batchFileArea && batchFileInput) {
      // File drop area click
      batchFileArea.addEventListener('click', () => batchFileInput.click());
      
      // Drag and drop support
      batchFileArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        batchFileArea.classList.add('hover');
        e.dataTransfer.dropEffect = 'copy';
      });
      
      batchFileArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        batchFileArea.classList.remove('hover');
      });
      
      batchFileArea.addEventListener('drop', (e) => {
        e.preventDefault();
        batchFileArea.classList.remove('hover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.addFilesToQueue(e.dataTransfer.files);
        }
      });
      
      // File input change
      batchFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.addFilesToQueue(e.target.files);
        }
      });
    }
    
    // Clear files button
    if (clearBatchBtn) {
      clearBatchBtn.addEventListener('click', this.clearFileQueue.bind(this));
    }
    
    // Process files button
    if (processBatchBtn) {
      processBatchBtn.addEventListener('click', this.processBatch.bind(this));
    }
    
    // Download all button
    if (downloadAllBtn) {
      downloadAllBtn.addEventListener('click', this.downloadAllResults.bind(this));
    }
    
    // Save all to path button
    if (saveAllToPathBtn) {
      saveAllToPathBtn.addEventListener('click', this.saveAllToPath.bind(this));
    }
  },
  
  /**
   * Refresh the batch UI when tab is activated
   */
  refreshBatchUI: function() {
    this.updateFileList();
    this.updateResultsList();
  },
  
  /**
   * Add files to the processing queue
   * @param {FileList} files - Files to add to the queue
   */
  addFilesToQueue: function(files) {
    // Filter for .nc, .txt, and other relevant file types
    const validFiles = Array.from(files).filter(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['nc', 'txt', 'g', 'gcode', 'cnc', 'tap', 'mpf'].includes(ext);
    });
    
    if (validFiles.length === 0) {
      NCConverter.UIHelpers.showToast('No valid NC files found. Please select .nc, .txt, or other NC files.', 'warning');
      return;
    }
    
    // Add valid files to queue, avoiding duplicates
    const existingNames = this.fileQueue.map(f => f.name);
    const newFiles = validFiles.filter(f => !existingNames.includes(f.name));
    
    if (newFiles.length === 0) {
      NCConverter.UIHelpers.showToast('All selected files are already in the queue.', 'info');
      return;
    }
    
    this.fileQueue = this.fileQueue.concat(newFiles);
    
    // Enable buttons if we have files
    document.getElementById('clearBatchBtn').disabled = false;
    document.getElementById('processBatchBtn').disabled = false;
    
    // Update the UI
    this.updateFileList();
    
    NCConverter.UIHelpers.showToast(`${newFiles.length} file(s) added to queue.`, 'success');
  },
  
  /**
   * Update the file list UI
   */
  updateFileList: function() {
    const fileListEl = document.getElementById('batchFileList');
    if (!fileListEl) return;
    
    if (this.fileQueue.length === 0) {
      fileListEl.innerHTML = '<p class="text-center" style="color: var(--gray-500); font-style: italic;">No files in queue.</p>';
      return;
    }
    
    // Create list of files
    let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
    
    this.fileQueue.forEach((file, index) => {
      html += `
        <li style="display: flex; align-items: center; padding: var(--space-2); border-bottom: 1px solid var(--gray-300);">
          <span style="flex-grow: 1;">${file.name} (${this.formatFileSize(file.size)})</span>
          <button class="remove-file-btn btn-sm btn-danger" data-index="${index}">Remove</button>
        </li>
      `;
    });
    
    html += '</ul>';
    fileListEl.innerHTML = html;
    
    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-file-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index'));
        this.removeFileFromQueue(index);
      });
    });
  },
  
  /**
   * Remove a file from the queue
   * @param {number} index - Index of the file to remove
   */
  removeFileFromQueue: function(index) {
    if (index >= 0 && index < this.fileQueue.length) {
      const fileName = this.fileQueue[index].name;
      this.fileQueue.splice(index, 1);
      
      // Update UI
      this.updateFileList();
      
      // Disable buttons if no files
      document.getElementById('clearBatchBtn').disabled = this.fileQueue.length === 0;
      document.getElementById('processBatchBtn').disabled = this.fileQueue.length === 0;
      
      NCConverter.UIHelpers.showToast(`Removed "${fileName}" from queue.`, 'info');
    }
  },
  
  /**
   * Clear all files from the queue
   */
  clearFileQueue: function() {
    if (this.fileQueue.length === 0) return;
    
    this.fileQueue = [];
    
    // Update UI
    this.updateFileList();
    
    // Disable buttons
    document.getElementById('clearBatchBtn').disabled = true;
    document.getElementById('processBatchBtn').disabled = true;
    
    NCConverter.UIHelpers.showToast('File queue cleared.', 'info');
  },
  
  /**
   * Process all files in the batch queue
   */
  processBatch: function() {
    if (this.isProcessing) {
      NCConverter.UIHelpers.showToast('Batch processing already in progress.', 'warning');
      return;
    }
    
    if (this.fileQueue.length === 0) {
      NCConverter.UIHelpers.showToast('No files in queue to process.', 'warning');
      return;
    }
    
    // Reset results
    this.results = [];
    this.isProcessing = true;
    
    // Update UI
    const processBatchBtn = document.getElementById('processBatchBtn');
    processBatchBtn.disabled = true;
    processBatchBtn.textContent = 'Processing...';
    
    document.getElementById('batchResults').innerHTML = `
      <div style="text-align: center;">
        <p>Processing ${this.fileQueue.length} files...</p>
        <progress id="batchProgress" value="0" max="${this.fileQueue.length}" style="width: 100%; margin-top: var(--space-2);"></progress>
        <p id="batchProgressText">0/${this.fileQueue.length} complete</p>
      </div>
    `;
    
    // Get current conversion settings
    const conversionType = document.querySelector('input[name="conversionType"]:checked').value;
    const mmPrecision = parseInt(document.getElementById('mmPrecision').value) || 3;
    const inchPrecision = parseInt(document.getElementById('inchPrecision').value) || 5;
    
    // Process files sequentially
    this.processNextFile(0, conversionType, mmPrecision, inchPrecision);
  },
  
  /**
   * Process the next file in the queue
   * @param {number} index - Index of the file to process
   * @param {string} conversionType - Type of conversion to perform
   * @param {number} mmPrecision - Precision for mm values
   * @param {number} inchPrecision - Precision for inch values
   */
  processNextFile: function(index, conversionType, mmPrecision, inchPrecision) {
    if (index >= this.fileQueue.length) {
      // All files processed
      this.finishBatchProcessing();
      return;
    }
    
    const file = this.fileQueue[index];
    
    // Read file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let content = e.target.result;
        // Insert inch header if needed (batch)
        if (NCConverter.Conversion && typeof NCConverter.Conversion.insertInchHeaderIfNeeded === 'function') {
          content = NCConverter.Conversion.insertInchHeaderIfNeeded(content);
        }
        
        // Detect units if using auto-detect
        let effectiveConversionType = conversionType;
        if (conversionType === 'autoDetect') {
          // Simple unit detection logic
          const lower = content.toLowerCase();
          if (/g20\b/.test(lower)) {
            effectiveConversionType = 'inchToMm';
          } else if (/g21\b/.test(lower)) {
            effectiveConversionType = 'mmToInch';
          } else {
            // Analyze coordinate values
            const matches = content.match(/[XY]\s*-?\d+\.?\d*/g) || [];
            const vals = matches.map(m => parseFloat(m.replace(/[XY]\s*/, "")));
            
            if (vals.length > 0) {
              const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
              effectiveConversionType = avg < 30 ? 'inchToMm' : 'mmToInch';
            } else {
              // Default to inchToMm if can't detect
              effectiveConversionType = 'inchToMm';
            }
          }
        }
        
        // Get tokens for conversion
        const tokens = NCConverter.TokenManager.getTokens();
        
        // Convert content based on detected type
        let convertedContent;
        let outputUnit;
        
        if (effectiveConversionType === 'inchToMm') {
          convertedContent = NCConverter.Conversion.inchToMm(content, tokens, mmPrecision);
          outputUnit = 'mm';
        } else if (effectiveConversionType === 'mmToInch') {
          convertedContent = NCConverter.Conversion.mmToInch(content, tokens, inchPrecision);
          outputUnit = 'inch';
        } else if (effectiveConversionType === 'keepUnits') {
          // No unit conversion, just process other options
          let result = content;
          const normalizeSpacingElement = document.getElementById('normalizeSpacing');
          if (normalizeSpacingElement && normalizeSpacingElement.checked) {
            result = NCConverter.Conversion.normalizeSpacing(result);
          }
          convertedContent = result;
          // Try to detect the output unit
          const detectedUnitElement = document.getElementById('detectedUnit');
          if (detectedUnitElement && detectedUnitElement.textContent) {
            outputUnit = detectedUnitElement.textContent;
          } else {
            outputUnit = 'unknown';
          }
        }
        
        // Apply H function mappings to ORIGINAL content before conversion
        let contentForConversion = content;
        if (NCConverter.state.hMapping && NCConverter.state.hMapping.length > 0) {
          contentForConversion = NCConverter.Conversion.applyHMapping(content);
        }
        
        // Re-do conversion with H-mapped content
        if (effectiveConversionType === 'inchToMm') {
          convertedContent = NCConverter.Conversion.inchToMm(contentForConversion, tokens, mmPrecision);
        } else if (effectiveConversionType === 'mmToInch') {
          convertedContent = NCConverter.Conversion.mmToInch(contentForConversion, tokens, inchPrecision);
        } else if (effectiveConversionType === 'keepUnits') {
          let result = contentForConversion;
          const normalizeSpacingElement = document.getElementById('normalizeSpacing');
          if (normalizeSpacingElement && normalizeSpacingElement.checked) {
            result = NCConverter.Conversion.normalizeSpacing(result);
          }
          convertedContent = result;
        }
        
        // Store result
        this.results.push({
          originalFile: file,
          convertedContent: convertedContent,
          conversionType: effectiveConversionType,
          outputUnit: outputUnit,
          success: true
        });
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        
        // Store error result
        this.results.push({
          originalFile: file,
          error: error.message,
          success: false
        });
      }
      
      // Update progress
      document.getElementById('batchProgress').value = index + 1;
      document.getElementById('batchProgressText').textContent = `${index + 1}/${this.fileQueue.length} complete`;
      
      // Process next file
      setTimeout(() => {
        this.processNextFile(index + 1, conversionType, mmPrecision, inchPrecision);
      }, 50); // Small delay to allow UI updates
    };
    
    reader.onerror = () => {
      // Handle read error
      this.results.push({
        originalFile: file,
        error: 'Failed to read file',
        success: false
      });
      
      // Update progress
      document.getElementById('batchProgress').value = index + 1;
      document.getElementById('batchProgressText').textContent = `${index + 1}/${this.fileQueue.length} complete`;
      
      // Process next file
      setTimeout(() => {
        this.processNextFile(index + 1, conversionType, mmPrecision, inchPrecision);
      }, 50);
    };
    
    reader.readAsText(file);
  },
  
  /**
   * Complete the batch processing and update UI
   */
  finishBatchProcessing: function() {
    this.isProcessing = false;
    
    // Update UI
    const processBatchBtn = document.getElementById('processBatchBtn');
    processBatchBtn.disabled = false;
    processBatchBtn.textContent = 'Process Files';
    
    // Show results
    this.updateResultsList();
    
    // Show download button if we have successful conversions
    const hasSuccessful = this.results.some(r => r.success);
    document.getElementById('batchActions').style.display = hasSuccessful ? 'block' : 'none';
    
    NCConverter.UIHelpers.showToast('Batch processing complete!', 'success');
  },
  
  /**
   * Update the results list UI
   */
  updateResultsList: function() {
    const resultsEl = document.getElementById('batchResults');
    if (!resultsEl) return;
    
    if (this.results.length === 0) {
      resultsEl.innerHTML = '<p class="text-center" style="color: var(--gray-500); font-style: italic;">No files processed yet.</p>';
      return;
    }
    
    // Count successes and failures
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.length - successful;
    
    // Create results summary
    let html = `
      <div style="margin-bottom: var(--space-3);">
        <p><strong>Processing Complete:</strong> ${successful} successful, ${failed} failed</p>
      </div>
    `;
    
    // Create list of files and their results
    html += '<div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--gray-300); border-radius: var(--border-radius-sm); margin-bottom: var(--space-3);">';
    html += '<ul style="list-style: none; padding: 0; margin: 0;">';
    
    this.results.forEach((result, index) => {
      const fileName = result.originalFile.name;
      const fileIcon = result.success ? '✅' : '❌';
      const fileClass = result.success ? 'success' : 'error';
      
      html += `
        <li style="display: flex; align-items: center; padding: var(--space-2); border-bottom: 1px solid var(--gray-300);">
          <span style="margin-right: var(--space-2);">${fileIcon}</span>
          <span style="flex-grow: 1; ${!result.success ? 'color: var(--danger-color);' : ''}">${fileName}</span>
          ${result.success ? 
            `<span style="margin-right: var(--space-2);">${result.outputUnit}</span>
             <button class="download-result-btn btn-sm" data-index="${index}" style="margin-right: var(--space-1);">Download</button>
             <button class="save-result-btn btn-sm" data-index="${index}">💾</button>` : 
            `<span style="color: var(--danger-color);">${result.error}</span>`
          }
        </li>
      `;
    });
    
    html += '</ul></div>';
    
    resultsEl.innerHTML = html;
    
    // Add event listeners to download buttons
    document.querySelectorAll('.download-result-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index'));
        this.downloadSingleResult(index);
      });
    });
    
    // Add event listeners to save-to-path buttons
    document.querySelectorAll('.save-result-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index'));
        this.saveSingleResultToPath(index);
      });
    });
  },
  
  /**
   * Download a single result file
   * @param {number} index - Index of the result to download
   */
  downloadSingleResult: function(index) {
    if (index >= 0 && index < this.results.length && this.results[index].success) {
      const result = this.results[index];
      const blob = new Blob([result.convertedContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      
      // Create filename with appropriate suffix
      const originalName = result.originalFile.name;
      const dotIndex = originalName.lastIndexOf('.');
      const suffix = result.outputUnit;
      
      a.download = dotIndex !== -1
        ? originalName.substring(0, dotIndex) + '_' + suffix + originalName.substring(dotIndex)
        : originalName + '_' + suffix;
        
      // Trigger download
      a.click();
      
      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
    }
  },
  
  /**
   * Download all successful results as a ZIP file
   */
  downloadAllResults: function() {
    const successfulResults = this.results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      NCConverter.UIHelpers.showToast('No successful conversions to download.', 'warning');
      return;
    }
    
    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
      // Load JSZip dynamically
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => this.createAndDownloadZip(successfulResults);
      script.onerror = () => {
        NCConverter.UIHelpers.showToast('Failed to load ZIP library. Please try downloading files individually.', 'error');
      };
      document.head.appendChild(script);
    } else {
      this.createAndDownloadZip(successfulResults);
    }
  },
  
  /**
   * Create and download a ZIP file with all successful results
   * @param {Array} results - Array of successful conversion results
   */
  createAndDownloadZip: function(results) {
    const zip = new JSZip();
    
    // Add each file to the ZIP
    results.forEach(result => {
      const originalName = result.originalFile.name;
      const dotIndex = originalName.lastIndexOf('.');
      const suffix = result.outputUnit;
      
      const fileName = dotIndex !== -1
        ? originalName.substring(0, dotIndex) + '_' + suffix + originalName.substring(dotIndex)
        : originalName + '_' + suffix;
      
      zip.file(fileName, result.convertedContent);
    });
    
    // Generate ZIP and trigger download
    zip.generateAsync({ type: 'blob' })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nc_converted_files.zip';
        a.click();
        
        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 100);
        
        NCConverter.UIHelpers.showToast('All files downloaded as ZIP.', 'success');
      })
      .catch(error => {
        console.error('Error creating ZIP file:', error);
        NCConverter.UIHelpers.showToast('Failed to create ZIP file. Please try downloading files individually.', 'error');
      });
  },
  
  /**
   * Format file size in human-readable format
   * @param {number} bytes - File size in bytes
   * @return {string} Formatted file size
   */
  formatFileSize: function(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },
  
  /**
   * Save a single result file to the custom save path
   * @param {number} index - Index of the result to save
   */
  saveSingleResultToPath: function(index) {
    if (index >= 0 && index < this.results.length && this.results[index].success) {
      const result = this.results[index];
      
      // Temporarily set the converted content and selected file for FileSaver
      const originalSelectedFile = NCConverter.state.selectedFile;
      const originalConvertedContent = NCConverter.state.convertedContent;
      
      // Set up for FileSaver
      NCConverter.state.selectedFile = result.originalFile;
      NCConverter.state.convertedContent = result.convertedContent;
      
      // Use the FileSaver module to handle custom path saving
      if (NCConverter.FileSaver && typeof NCConverter.FileSaver.handleSaveClick === "function") {
        NCConverter.FileSaver.handleSaveClick();
      } else {
        NCConverter.UIHelpers.showToast("FileSaver module not available", "error");
      }
      
      // Restore original state
      NCConverter.state.selectedFile = originalSelectedFile;
      NCConverter.state.convertedContent = originalConvertedContent;
    }
  },
  
  /**
   * Save all successful results to the custom save path
   */
  saveAllToPath: function() {
    const successfulResults = this.results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      NCConverter.UIHelpers.showToast('No successful conversions to save.', 'warning');
      return;
    }
    
    // Check if we have a directory handle or custom path
    const hasDirectoryHandle = NCConverter.state.directoryHandle;
    const customPath = NCConverter.state.settings?.customSavePath?.trim();
    
    if (!hasDirectoryHandle && (!customPath || customPath.startsWith('[Selected Directory:'))) {
      NCConverter.UIHelpers.showToast("Please select a directory using 'Browse' in Settings, or enter a manual path.", "warning");
      return;
    }
    
    if (hasDirectoryHandle) {
      this.saveAllToDirectoryHandle(successfulResults);
    } else {
      NCConverter.UIHelpers.showToast("Batch save to manual paths requires individual file saves. Please use 'Save All (ZIP)' or save files individually.", "info");
    }
  },
  
  /**
   * Save all files using the directory handle
   * @param {Array} results - Array of successful conversion results
   */
  saveAllToDirectoryHandle: async function(results) {
    try {
      let savedCount = 0;
      
      for (const result of results) {
        try {
          // Create filename with appropriate suffix
          const originalName = result.originalFile.name;
          const dotIndex = originalName.lastIndexOf('.');
          const suffix = result.outputUnit;
          
          const fileName = dotIndex !== -1
            ? originalName.substring(0, dotIndex) + '_' + suffix + originalName.substring(dotIndex)
            : originalName + '_' + suffix;
          
          // Create file handle
          const fileHandle = await NCConverter.state.directoryHandle.getFileHandle(fileName, { create: true });
          
          // Write content
          const writable = await fileHandle.createWritable();
          await writable.write(result.convertedContent);
          await writable.close();
          
          savedCount++;
        } catch (fileError) {
          console.error(`Error saving file ${result.originalFile.name}:`, fileError);
        }
      }
      
      if (savedCount === results.length) {
        NCConverter.UIHelpers.showToast(`All ${savedCount} files saved successfully.`, 'success');
      } else if (savedCount > 0) {
        NCConverter.UIHelpers.showToast(`${savedCount} of ${results.length} files saved successfully.`, 'warning');
      } else {
        NCConverter.UIHelpers.showToast('Failed to save files. Please check directory permissions.', 'error');
      }
    } catch (error) {
      console.error('Error saving files to directory:', error);
      NCConverter.UIHelpers.showToast('Failed to save files to directory. Please try again.', 'error');
    }
  }
};
