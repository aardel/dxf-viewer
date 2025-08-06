/**
 * NC File Converter Batch Initializer
 * Directly connects batch processing UI elements to functionality
 */

NCConverter.BatchInitializer = {
  // Batch file queue
  fileQueue: [],
  
  // Results of processed files
  processedResults: [],
  
  // Processing state
  isProcessing: false,
  
  // DOM element cache
  elements: {},
  
  /**
   * Initialize the batch functionality
   */
  init: function() {
    console.log("Batch Initializer running");
    
    // Cache UI elements
    this.elements = {
      batchFileArea: document.getElementById('batchFileArea'),
      batchFileInput: document.getElementById('batchFileInput'),
      batchFileList: document.getElementById('batchFileList'),
      clearFilesBtn: document.getElementById('clearBatchBtn'),
      processFilesBtn: document.getElementById('processBatchBtn'),
      batchResults: document.getElementById('batchResults')
    };
    
    if (!this.elements.batchFileArea) {
      console.error("Batch file area not found");
      return;
    }
    
    // Set up event listeners more efficiently
    this.setupEventListeners();
    
    // Check if we have files in queue from previous initialization
    this.updateFileList();
    
    // Create results container if it doesn't exist
    if (!this.elements.batchResults) {
      const batchResults = document.createElement('div');
      batchResults.id = 'batchResults';
      batchResults.className = 'batch-results';
      batchResults.style.marginTop = 'var(--space-4)';
      
      // Find where to insert it
      const batchTab = document.getElementById('batch-tab');
      if (batchTab) {
        batchTab.appendChild(batchResults);
        this.elements.batchResults = batchResults;
      }
    }
  },
  
  /**
   * Set up event listeners for batch UI elements
   */
  setupEventListeners: function() {
    const { batchFileArea, batchFileInput, clearFilesBtn, processFilesBtn } = this.elements;
    
    // Fix file input if it doesn't exist
    if (!batchFileInput && batchFileArea) {
      this.elements.batchFileInput = document.createElement('input');
      this.elements.batchFileInput.type = 'file';
      this.elements.batchFileInput.id = 'batchFileInput';
      this.elements.batchFileInput.multiple = true;
      this.elements.batchFileInput.style.display = 'none';
      batchFileArea.appendChild(this.elements.batchFileInput);
    }
    
    // File area click event
    if (batchFileArea) {
      batchFileArea.onclick = () => {
        if (this.elements.batchFileInput) this.elements.batchFileInput.click();
      };
      
      // Drag and drop events
      batchFileArea.ondragover = (e) => {
        e.preventDefault();
        batchFileArea.classList.add('hover');
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      };
      
      batchFileArea.ondragleave = () => {
        batchFileArea.classList.remove('hover');
      };
      
      batchFileArea.ondrop = (e) => {
        e.preventDefault();
        batchFileArea.classList.remove('hover');
        
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.addFilesToQueue(e.dataTransfer.files);
        }
      };
    }
    
    // File input change event
    if (this.elements.batchFileInput) {
      this.elements.batchFileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.addFilesToQueue(e.target.files);
        }
      };
    }
    
    // Button events - using direct assignment for simplicity and reliability
    if (clearFilesBtn) {
      clearFilesBtn.onclick = this.clearFileQueue.bind(this);
    }
    
    if (processFilesBtn) {
      processFilesBtn.onclick = this.processBatch.bind(this);
    }
    
    console.log("Batch event listeners set up");
  },
  
  /**
   * Add files to the queue
   * @param {FileList} files - Files to add
   */
  addFilesToQueue: function(files) {
    console.log("Adding files to queue:", files.length);
    
    // Don't add files if currently processing
    if (this.isProcessing) {
      this.showToast('Cannot add files while processing is in progress.', 'warning');
      return;
    }
    
    // Filter for NC and text files - EXPANDED FILE TYPE LIST
    const validExtensions = ['nc', 'txt', 'g', 'gcode', 'cnc', 'tap', 'mpf', 'din', 'rot'];
    const validFiles = [];
    
    // Process all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop().toLowerCase();
      
      if (validExtensions.includes(ext)) {
        validFiles.push(file);
      }
    }
    
    if (validFiles.length === 0) {
      this.showToast('No valid NC files found. Accepted formats: .nc, .txt, .din, .rot, .gcode, etc.', 'warning');
      return;
    }
    
    // Add to queue
    this.fileQueue = this.fileQueue.concat(validFiles);
    
    // Update UI
    this.updateFileList();
    
    // Enable buttons
    if (this.elements.clearFilesBtn) this.elements.clearFilesBtn.disabled = false;
    if (this.elements.processFilesBtn) this.elements.processFilesBtn.disabled = false;
    
    // Show notification
    this.showToast(`Added ${validFiles.length} file(s) to the queue.`, 'success');
  },
  
  /**
   * Update the file list UI
   */
  updateFileList: function() {
    const { batchFileList } = this.elements;
    if (!batchFileList) return;
    
    if (this.fileQueue.length === 0) {
      batchFileList.innerHTML = '<p class="text-center" style="color: var(--gray-500); font-style: italic;">No files in queue.</p>';
      
      // Disable buttons if no files
      if (this.elements.clearFilesBtn) this.elements.clearFilesBtn.disabled = true;
      if (this.elements.processFilesBtn) this.elements.processFilesBtn.disabled = true;
      
      return;
    }
    
    // Create list HTML
    let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
    
    this.fileQueue.forEach((file, index) => {
      // Format file size
      let size = file.size;
      let unit = "bytes";
      if (size > 1024) { size = (size / 1024).toFixed(1); unit = "KB"; }
      if (size > 1024) { size = (size / 1024).toFixed(1); unit = "MB"; }
      
      html += `
        <li style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid var(--gray-300);">
          <span style="flex-grow: 1;">${file.name} (${size} ${unit})</span>
          <button class="remove-file-btn btn-sm btn-danger" data-index="${index}" style="padding: 2px 8px;">Remove</button>
        </li>
      `;
    });
    
    html += '</ul>';
    batchFileList.innerHTML = html;
    
    // Enable buttons if files are in queue
    if (this.elements.clearFilesBtn) this.elements.clearFilesBtn.disabled = false;
    if (this.elements.processFilesBtn) this.elements.processFilesBtn.disabled = false;
    
    // Add event listeners to remove buttons
    const removeButtons = batchFileList.querySelectorAll('.remove-file-btn');
    removeButtons.forEach(btn => {
      btn.onclick = (e) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        this.removeFileFromQueue(index);
      };
    });
  },
  
  /**
   * Remove a file from the queue
   * @param {number} index - Index of the file to remove
   */
  removeFileFromQueue: function(index) {
    if (this.isProcessing) {
      this.showToast('Cannot remove files while processing is in progress.', 'warning');
      return;
    }
    
    if (index >= 0 && index < this.fileQueue.length) {
      const fileName = this.fileQueue[index].name;
      this.fileQueue.splice(index, 1);
      
      // Update UI
      this.updateFileList();
      
      // Show notification
      this.showToast(`Removed "${fileName}" from queue.`, 'info');
    }
  },
  
  /**
   * Clear the file queue
   */
  clearFileQueue: function() {
    if (this.isProcessing) {
      this.showToast('Cannot clear queue while processing is in progress.', 'warning');
      return;
    }
    
    if (this.fileQueue.length === 0) return;
    
    this.fileQueue = [];
    
    // Update UI
    this.updateFileList();
    
    // Clear results if any
    this.clearResults();
    
    // Show notification
    this.showToast('File queue cleared.', 'info');
  },
  
  /**
   * Clear results display
   */
  clearResults: function() {
    if (this.elements.batchResults) {
      this.elements.batchResults.innerHTML = '';
    }
    this.processedResults = [];
  },
  
  /**
   * Process the batch
   */
  processBatch: function() {
    console.log("Process batch clicked. File queue length:", this.fileQueue.length);
    
    if (this.isProcessing) {
      this.showToast('Batch processing already in progress.', 'warning');
      return;
    }
    
    if (this.fileQueue.length === 0) {
      this.showToast('No files in queue to process.', 'warning');
      return;
    }
    
    // Mark as processing
    this.isProcessing = true;
    
    // Disable buttons
    if (this.elements.clearFilesBtn) this.elements.clearFilesBtn.disabled = true;
    if (this.elements.processFilesBtn) {
      this.elements.processFilesBtn.disabled = true;
      this.elements.processFilesBtn.textContent = 'Processing...';
    }
    
    // Clear previous results
    this.clearResults();
    
    // Create a dialog to show progress
    this.showProcessingDialog();
    
    // Get conversion settings for batch processing
    const conversionType = document.querySelector('input[name="conversionType"]:checked').value;
    const mmPrecision = parseInt(document.getElementById("mmPrecision").value) || 3;
    const inchPrecision = parseInt(document.getElementById("inchPrecision").value) || 4;
    
    // Start processing
    this.processFiles(conversionType, mmPrecision, inchPrecision);
  },
  
  /**
   * Show processing dialog
   */
  showProcessingDialog: function() {
    // Create results container
    if (!this.elements.batchResults) return;
    
    this.elements.batchResults.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">Processing Files</h4>
        </div>
        <div class="card-body">
          <p>Processing ${this.fileQueue.length} files...</p>
          <p>This is a real implementation. The files will be processed one by one using the current conversion settings.</p>
          
          <div id="batchProgressContainer" style="margin: var(--space-3) 0;">
            <progress id="batchProgress" value="0" max="${this.fileQueue.length}" style="width: 100%;"></progress>
            <p id="batchProgressText" style="text-align: center; margin-top: var(--space-2);">Processing file 0/${this.fileQueue.length}</p>
          </div>
          
          <div id="currentFileInfo" style="margin-bottom: var(--space-3);">
            <p>Current file: <span id="currentFileName">Preparing to start...</span></p>
          </div>
          
          <div id="processedFilesList">
            <h5>Processed Files:</h5>
            <ul id="processedFiles" style="list-style: none; padding: 0;"></ul>
          </div>
        </div>
      </div>
    `;
    
    // Cache new elements
    this.elements.batchProgress = document.getElementById('batchProgress');
    this.elements.batchProgressText = document.getElementById('batchProgressText');
    this.elements.currentFileName = document.getElementById('currentFileName');
    this.elements.processedFiles = document.getElementById('processedFiles');
  },
  
  /**
   * Update processing dialog progress
   * @param {number} currentIndex - Current processing index
   * @param {string} fileName - Current file name
   * @param {Object} result - Processing result object
   */
  updateProcessingDialog: function(currentIndex, fileName, result) {
    const { batchProgress, batchProgressText, currentFileName, processedFiles } = this.elements;
    
    if (!batchProgress || !batchProgressText || !currentFileName || !processedFiles) return;
    
    // Update progress
    batchProgress.value = currentIndex;
    batchProgressText.textContent = `Processing file ${currentIndex}/${this.fileQueue.length}`;
    currentFileName.textContent = fileName || 'Unknown';
    
    // Add to processed files list if we have a result
    if (result) {
      const li = document.createElement('li');
      li.style.padding = 'var(--space-2) 0';
      li.style.borderBottom = '1px solid var(--gray-300)';
      
      const statusColor = result.success ? 'var(--success-color)' : 'var(--danger-color)';
      const statusIcon = result.success ? '✅' : '❌';
      
      li.innerHTML = `
        <div style="display: flex; align-items: center;">
          <span style="margin-right: var(--space-2); color: ${statusColor};">${statusIcon}</span>
          <span style="flex-grow: 1;">${result.fileName}</span>
          <span style="color: ${statusColor};">${result.success ? 'Success' : 'Failed'}</span>
        </div>
      `;
      
      processedFiles.appendChild(li);
    }
  },
  
  /**
   * Process all files in the batch
   * @param {string} conversionType - Type of conversion (inchToMm, mmToInch, autoDetect)
   * @param {number} mmPrecision - Precision for mm values
   * @param {number} inchPrecision - Precision for inch values
   */
  processFiles: function(conversionType, mmPrecision, inchPrecision) {
    // Check if necessary conversion functions are available
    if (!NCConverter.Conversion || 
        typeof NCConverter.Conversion.inchToMm !== 'function' || 
        typeof NCConverter.Conversion.mmToInch !== 'function') {
      
      this.showToast('Conversion functions are not available', 'error');
      this.finishProcessing();
      return;
    }
    
    // Get tokens for conversion
    let tokens = [];
    if (NCConverter.TokenManager && typeof NCConverter.TokenManager.getTokens === 'function') {
      tokens = NCConverter.TokenManager.getTokens();
    } else if (NCConverter.state && NCConverter.state.settings && NCConverter.state.settings.tokens) {
      tokens = NCConverter.state.settings.tokens;
    } else {
      tokens = ["X", "Y", "I", "J", "R", "Radius:", "CylDia:", "GROESSE:"];
    }
    
    if (tokens.length === 0) {
      this.showToast('No tokens defined for conversion', 'error');
      this.finishProcessing();
      return;
    }
    
    // Process each file sequentially
    this.processNextFile(0, conversionType, mmPrecision, inchPrecision, tokens);
  },
  
  /**
   * Process the next file in the queue
   * @param {number} index - Current file index
   * @param {string} conversionType - Type of conversion
   * @param {number} mmPrecision - Precision for mm values
   * @param {number} inchPrecision - Precision for inch values
   * @param {Array} tokens - Tokens for conversion
   */
  processNextFile: function(index, conversionType, mmPrecision, inchPrecision, tokens) {
    // Check if we've processed all files
    if (index >= this.fileQueue.length) {
      this.finishProcessing();
      return;
    }
    
    const file = this.fileQueue[index];
    const fileName = file.name;
    
    // Update progress display
    this.updateProcessingDialog(index + 1, fileName);
    
    // Read and process the file
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        // Get file content
        const content = e.target.result;
        
        // Determine conversion direction
        let effectiveConversionType = conversionType;
        let convertedContent;
        let outputUnit;
        
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
        
        // Perform conversion
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
        if (NCConverter.state && NCConverter.state.hMapping && 
            NCConverter.state.hMapping.length > 0) {
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
        
        // Create a Blob for the result
        const blob = new Blob([convertedContent], { type: 'text/plain' });
        
        // Create a result object
        const result = {
          index: index,
          fileName: fileName,
          originalSize: file.size,
          outputUnit: outputUnit,
          success: true,
          message: `Converted to ${outputUnit}`,
          blob: blob,
          conversionType: effectiveConversionType
        };
        
        // Add to results and update UI
        this.processedResults.push(result);
        this.updateProcessingDialog(index + 1, fileName, result);
        
        // Process next file with a small delay to allow UI updates
        setTimeout(() => {
          this.processNextFile(index + 1, conversionType, mmPrecision, inchPrecision, tokens);
        }, 50);
        
      } catch (error) {
        console.error(`Error processing file ${fileName}:`, error);
        
        // Create error result
        const result = {
          index: index,
          fileName: fileName,
          originalSize: file.size,
          success: false,
          error: error.message || 'Unknown error'
        };
        
        // Add to results and update UI
        this.processedResults.push(result);
        this.updateProcessingDialog(index + 1, fileName, result);
        
        // Continue with next file
        setTimeout(() => {
          this.processNextFile(index + 1, conversionType, mmPrecision, inchPrecision, tokens);
        }, 50);
      }
    };
    
    reader.onerror = (error) => {
      console.error(`Error reading file ${fileName}:`, error);
      
      // Create error result
      const result = {
        index: index,
        fileName: fileName,
        originalSize: file.size,
        success: false,
        error: 'Failed to read file'
      };
      
      // Add to results and update UI
      this.processedResults.push(result);
      this.updateProcessingDialog(index + 1, fileName, result);
      
      // Continue with next file
      setTimeout(() => {
        this.processNextFile(index + 1, conversionType, mmPrecision, inchPrecision, tokens);
      }, 50);
    };
    
    // Read file as text
    reader.readAsText(file);
  },
  
  /**
   * Finish batch processing
   */
  finishProcessing: function() {
    // Mark as not processing
    this.isProcessing = false;
    
    // Update UI
    const processFilesBtn = this.elements.processFilesBtn;
    const clearFilesBtn = this.elements.clearFilesBtn;
    
    if (processFilesBtn) {
      processFilesBtn.disabled = false;
      processFilesBtn.textContent = 'Process Files';
    }
    
    if (clearFilesBtn) {
      clearFilesBtn.disabled = false;
    }
    
    // Show completion dialog
    this.showCompletionDialog();
    
    // Show notification
    this.showToast('Batch processing complete!', 'success');
  },
  
  /**
   * Show completion dialog
   */
  showCompletionDialog: function() {
    // Create results container
    if (!this.elements.batchResults) return;
    
    const successCount = this.processedResults.filter(r => r.success).length;
    const failCount = this.processedResults.length - successCount;
    
    this.elements.batchResults.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">Processing Complete</h4>
        </div>
        <div class="card-body">
          <p>Processed ${this.processedResults.length} files: ${successCount} successful, ${failCount} failed.</p>
          
          <div style="margin: var(--space-3) 0;">
            <h5>Results:</h5>
            <ul id="finalResults" style="list-style: none; padding: 0; margin-bottom: var(--space-3);">
              ${this.processedResults.map(result => {
                const statusColor = result.success ? 'var(--success-color)' : 'var(--danger-color)';
                const statusIcon = result.success ? '✅' : '❌';
                return `
                  <li style="padding: var(--space-2) 0; border-bottom: 1px solid var(--gray-300);">
                    <div style="display: flex; align-items: center;">
                      <span style="margin-right: var(--space-2); color: ${statusColor};">${statusIcon}</span>
                      <span style="flex-grow: 1;">${result.fileName}</span>
                      <span style="color: ${statusColor}; margin-right: var(--space-2);">
                        ${result.success ? result.message || 'Success' : result.error || 'Failed'}
                      </span>
                      ${result.success && result.blob ? 
                        `<button class="download-result-btn btn-sm" data-index="${result.index}">Download</button>` : 
                        ''}
                    </div>
                  </li>
                `;
              }).join('')}
            </ul>
            
            ${successCount > 0 ? `
              <div style="text-align: center;">
                <button id="downloadAllBtn" class="btn">Download All (ZIP)</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    // Add event listeners for download buttons
    const downloadBtns = this.elements.batchResults.querySelectorAll('.download-result-btn');
    downloadBtns.forEach(btn => {
      btn.onclick = () => {
        const index = parseInt(btn.getAttribute('data-index'));
        this.downloadResult(index);
      };
    });
    
    // Add event listener for download all button
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
      downloadAllBtn.onclick = () => {
        this.downloadAllResults();
      };
    }
  },
  
  /**
   * Download a specific result
   * @param {number} index - Index of the result to download
   */
  downloadResult: function(index) {
    const result = this.processedResults[index];
    if (!result || !result.success || !result.blob) return;
    
    const fileName = result.fileName;
    const dotIndex = fileName.lastIndexOf('.');
    const extension = dotIndex !== -1 ? fileName.substring(dotIndex) : '';
    const baseName = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
    const suffix = result.outputUnit || (result.conversionType === 'inchToMm' ? 'mm' : 'inch');
    
    const newFileName = `${baseName}_${suffix}${extension}`;
    
    // Create download link
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = newFileName;
    a.click();
    
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  },
  
  /**
   * Download all successful results as a ZIP file
   */
  downloadAllResults: function() {
    const successfulResults = this.processedResults.filter(r => r.success && r.blob);
    
    if (successfulResults.length === 0) {
      this.showToast('No successful conversions to download', 'error');
      return;
    }
    
    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
      // Try to load JSZip dynamically
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => {
        this.createAndDownloadZip(successfulResults);
      };
      script.onerror = () => {
        this.showToast('Failed to load ZIP library. Please download files individually.', 'error');
      };
      document.head.appendChild(script);
    } else {
      this.createAndDownloadZip(successfulResults);
    }
  },
  
  /**
   * Create and download a ZIP file with all successful results
   * @param {Array} results - Array of successful results
   */
  createAndDownloadZip: function(results) {
    const zip = new JSZip();
    
    // Add each file to the ZIP
    results.forEach(result => {
      const fileName = result.fileName;
      const dotIndex = fileName.lastIndexOf('.');
      const extension = dotIndex !== -1 ? fileName.substring(dotIndex) : '';
      const baseName = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
      const suffix = result.outputUnit || (result.conversionType === 'inchToMm' ? 'mm' : 'inch');
      
      const newFileName = `${baseName}_${suffix}${extension}`;
      
      zip.file(newFileName, result.blob);
    });
    
    // Generate the ZIP file
    zip.generateAsync({ type: 'blob' })
      .then(blob => {
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted_nc_files.zip';
        a.click();
        
        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 100);
        
        // Show notification
        this.showToast('All files downloaded as ZIP.', 'success');
      })
      .catch(error => {
        console.error('Error creating ZIP file:', error);
        this.showToast('Failed to create ZIP file. Please download files individually.', 'error');
      });
  },
  
  /**
   * Show an error message
   * @param {string} message - Error message to display
   */
  showToast: function(message, type) {
    if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === 'function') {
      NCConverter.UIHelpers.showToast(message, type);
    } else {
      alert(message);
    }
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
  }
};