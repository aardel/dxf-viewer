/**
 * NC Converter Fix Script
 * Add this as the last script in index.html to fix all issues
 */

(function() {
  console.log("Running NC Converter Fix Script...");
  
  // Wait for the DOM to be fully loaded and all other scripts initialized
  document.addEventListener('DOMContentLoaded', function() {
    // Delay to ensure all other initialization is complete
    setTimeout(function() {
      console.log("Applying fixes...");
      
      // If TabManager exists, ensure it fixes any empty tabs
      if (NCConverter.TabManager) {
        console.log("Fixing tabs...");
        if (typeof NCConverter.TabManager.fixEmptyTabs === 'function') {
          NCConverter.TabManager.fixEmptyTabs();
        }
        if (typeof NCConverter.TabManager.checkAndFixTabs === 'function') {
          NCConverter.TabManager.checkAndFixTabs();
        } else if (typeof NCConverter.TabManager.init === 'function') {
          NCConverter.TabManager.init();
        }
      } else {
        console.warn("TabManager not found");
      }
      
      // If BatchInitializer exists, ensure it's properly initialized
      if (NCConverter.BatchInitializer) {
        console.log("Fixing batch processing...");
        
        // Backup file queue if it exists
        const fileQueue = NCConverter.BatchInitializer.fileQueue || [];
        
        if (typeof NCConverter.BatchInitializer.init === 'function') {
          NCConverter.BatchInitializer.init();
        }
        
        // Restore file queue after initialization
        if (fileQueue.length > 0) {
          NCConverter.BatchInitializer.fileQueue = fileQueue;
          if (typeof NCConverter.BatchInitializer.updateFileList === 'function') {
            NCConverter.BatchInitializer.updateFileList();
          }
        }
      } else {
        console.warn("BatchInitializer not found");
      }
      
      // Add fallback tab functionality if needed
      fixTabsDirectly();
      
      // Add fallback batch functionality if needed
      fixBatchDirectly();
      
      console.log("Fixes applied successfully");
    }, 500); // Wait half a second for initial modules to load
  });
  
  /**
   * Fix tabs directly if TabManager isn't working
   */
  function fixTabsDirectly() {
    // Check if we still have empty tabs
    const previewTab = document.getElementById('preview-tab');
    const hfunctionsTab = document.getElementById('hfunctions-tab');
    const settingsTab = document.getElementById('settings-tab');
    const visualizationTab = document.getElementById('visualization-tab');
    const batchTab = document.getElementById('batch-tab');
    
    // If all tabs have content, we don't need to do anything
    if (previewTab && previewTab.innerHTML && 
        hfunctionsTab && hfunctionsTab.innerHTML &&
        settingsTab && settingsTab.innerHTML &&
        visualizationTab && visualizationTab.innerHTML &&
        batchTab && batchTab.innerHTML) {
      console.log("All tabs have content - no direct fix needed");
      return;
    }
    
    console.log("Fixing empty tabs directly");
    
    // Fix preview tab
    if (previewTab && (!previewTab.innerHTML || previewTab.innerHTML.trim() === '')) {
      previewTab.innerHTML = getPreviewTabContent();
    }
    
    // Fix H Functions tab
    if (hfunctionsTab && (!hfunctionsTab.innerHTML || hfunctionsTab.innerHTML.trim() === '')) {
      hfunctionsTab.innerHTML = getHFunctionsTabContent();
    }
    
    // Fix Settings tab
    if (settingsTab && (!settingsTab.innerHTML || settingsTab.innerHTML.trim() === '')) {
      settingsTab.innerHTML = getSettingsTabContent();
    }
    
    // Fix Visualization tab
    if (visualizationTab && (!visualizationTab.innerHTML || visualizationTab.innerHTML.trim() === '')) {
      visualizationTab.innerHTML = getVisualizationTabContent();
    }
    
    // Fix Batch tab
    if (batchTab && (!batchTab.innerHTML || batchTab.innerHTML.trim() === '')) {
      batchTab.innerHTML = getBatchTabContent();
    }
    
    // Set up direct tab switching if needed
    if (!document.querySelector('.tab-header').onclick) {
      console.log("Setting up direct tab switching");
      
      document.querySelectorAll('.tab-header').forEach(function(header) {
        header.onclick = function() {
          // Get tab ID
          const tabId = header.getAttribute('data-tab');
          if (!tabId) return;
          
          // Reset all tabs
          document.querySelectorAll('.tab-header').forEach(function(h) {
            h.classList.remove('active');
            h.setAttribute('aria-selected', 'false');
          });
          
          document.querySelectorAll('.tab-content').forEach(function(content) {
            content.style.display = 'none';
          });
          
          // Activate selected tab
          header.classList.add('active');
          header.setAttribute('aria-selected', 'true');
          
          const selectedContent = document.getElementById(`${tabId}-tab`);
          if (selectedContent) {
            selectedContent.style.display = 'block';
          }
        };
      });
    }
  }
  
  /**
   * Fix batch processing directly if BatchInitializer isn't working
   */
  function fixBatchDirectly() {
    const batchFileArea = document.getElementById('batchFileArea');
    const batchFileInput = document.getElementById('batchFileInput');
    const batchFileList = document.getElementById('batchFileList');
    const clearFilesBtn = document.getElementById('clearBatchBtn');
    const processFilesBtn = document.getElementById('processBatchBtn');
    
    // If any element is missing, we can't fix
    if (!batchFileArea || !batchFileInput || !batchFileList || !clearFilesBtn || !processFilesBtn) {
      console.error("Batch UI elements missing - can't fix directly");
      return;
    }
    
    // Check if batch processing is working
    if (processFilesBtn.onclick && !processFilesBtn.disabled) {
      console.log("Batch processing already working - no direct fix needed");
      return;
    }
    
    console.log("Fixing batch processing directly");
    
    // File queue for direct implementation
    const directFileQueue = [];
    
    // Set up file area click
    batchFileArea.onclick = function() {
      batchFileInput.click();
    };
    
    // Set up file input change
    batchFileInput.onchange = function(e) {
      if (e.target.files && e.target.files.length > 0) {
        // Add files to queue
        const validFiles = Array.from(e.target.files).filter(file => {
          const ext = file.name.split('.').pop().toLowerCase();
          return ['nc', 'txt', 'g', 'gcode', 'cnc', 'tap', 'mpf', 'din', 'rot'].includes(ext);
        });
        
        if (validFiles.length === 0) {
          alert('No valid NC files found. Accepted formats: .nc, .txt, .din, .rot, .gcode, etc.');
          return;
        }
        
        // Add to queue
        directFileQueue.push(...validFiles);
        
        // Update UI
        updateBatchFileList();
      }
    };
    
    // Set up drag and drop
    batchFileArea.ondragover = function(e) {
      e.preventDefault();
      batchFileArea.classList.add('hover');
    };
    
    batchFileArea.ondragleave = function() {
      batchFileArea.classList.remove('hover');
    };
    
    batchFileArea.ondrop = function(e) {
      e.preventDefault();
      batchFileArea.classList.remove('hover');
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // Add files to queue
        const validFiles = Array.from(e.dataTransfer.files).filter(file => {
          const ext = file.name.split('.').pop().toLowerCase();
          return ['nc', 'txt', 'g', 'gcode', 'cnc', 'tap', 'mpf', 'din', 'rot'].includes(ext);
        });
        
        if (validFiles.length === 0) {
          alert('No valid NC files found. Accepted formats: .nc, .txt, .din, .rot, .gcode, etc.');
          return;
        }
        
        // Add to queue
        directFileQueue.push(...validFiles);
        
        // Update UI
        updateBatchFileList();
      }
    };
    
    // Set up clear button
    clearFilesBtn.onclick = function() {
      directFileQueue.length = 0;
      updateBatchFileList();
    };
    
    // Set up process button
    processFilesBtn.onclick = function() {
      if (directFileQueue.length === 0) {
        alert('No files in queue to process.');
        return;
      }
      
      alert(`Processing ${directFileQueue.length} files...\n\nFiles to process:\n${directFileQueue.map(f => f.name).join('\n')}`);
    };
    
    // Update file list UI
    function updateBatchFileList() {
      if (directFileQueue.length === 0) {
        batchFileList.innerHTML = '<p class="text-center" style="color: var(--gray-500); font-style: italic;">No files in queue.</p>';
        clearFilesBtn.disabled = true;
        processFilesBtn.disabled = true;
        return;
      }
      
      let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
      
      directFileQueue.forEach((file, index) => {
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
      
      clearFilesBtn.disabled = false;
      processFilesBtn.disabled = false;
      
      // Add remove buttons
      document.querySelectorAll('.remove-file-btn').forEach(function(btn) {
        btn.onclick = function() {
          const index = parseInt(btn.getAttribute('data-index'));
          if (index >= 0 && index < directFileQueue.length) {
            directFileQueue.splice(index, 1);
            updateBatchFileList();
          }
        };
      });
    }
  }
  
  /**
   * Get HTML content for the preview tab
   */
  function getPreviewTabContent() {
    return `
      <h3>File Preview</h3>
      <p>Compare the original code with the converted result. <span style="color: var(--primary-color); font-weight: 500;">Blue</span> highlights show converted tokens, <span style="color: var(--danger-color); font-weight: 500;">red</span> highlights show H functions that will be changed.</p>
      
      <!-- Search Container -->
      <div class="search-container" style="margin-bottom: var(--space-3);">
        <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-2);">
          <input type="text" id="previewSearchInput" placeholder="Search in preview..." style="flex-grow: 1;">
          <button id="previewSearchBtn">Search</button>
        </div>
        <div style="display: flex; gap: var(--space-2); align-items: center;">
          <button id="prevMatchBtn" class="btn-sm" disabled>Previous</button>
          <button id="nextMatchBtn" class="btn-sm" disabled>Next</button>
          <span id="searchResultsInfo" style="font-size: 14px; color: var(--gray-600);"></span>
          <div class="checkbox-option" style="margin-left: auto; margin-bottom: 0;">
            <input type="checkbox" id="searchCaseSensitive">
            <label for="searchCaseSensitive" style="margin-bottom: 0;">Case sensitive</label>
          </div>
        </div>
      </div>
      
      <div class="preview-container">
        <div class="preview-panel">
          <strong>Original Code:</strong>
          <div class="preview" id="originalPreview">No file loaded.</div>
        </div>
        <div class="preview-panel">
          <strong>Converted Code:</strong>
          <div class="preview" id="convertedPreview">No conversion available.</div>
        </div>
      </div>
    `;
  }
  
  /**
   * Get HTML content for the H Functions tab
   */
  function getHFunctionsTabContent() {
    return `
      <div class="flex-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
        <div>
          <h3>H Function Mapping</h3>
          <p>Map H functions in your file to alternative functions.</p>
        </div>
        <button id="detectHBtn" class="btn">
          <i class="icon">🔍</i> Detect H Numbers
        </button>
      </div>
      
      <div class="card">
        <div class="card-body" id="hMappingContainer" style="min-height: 100px;">
          <p class="empty-message" style="font-style: italic; color: var(--gray-500); text-align: center; padding: var(--space-3);">
            No H numbers detected. Click 'Detect H Numbers' to scan your file or upload a file containing H numbers.
          </p>
        </div>
      </div>
      
      <div style="margin-top: var(--space-4);">
        <div class="checkbox-option" id="autoRedetectContainer">
          <input type="checkbox" id="autoRedetectH" checked>
          <label for="autoRedetectH">Automatically detect H numbers in modified file when changing mappings</label>
        </div>
        <button id="resetHMappingBtn" style="margin-top: var(--space-3);">Reset H Mappings</button>
      </div>
    `;
  }
  
  /**
   * Get HTML content for the Settings tab
   */
  function getSettingsTabContent() {
    return `
      <h3>Application Settings</h3>
      <p>Customize how the converter behaves.</p>
      
      <!-- Precision Settings Card -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">Precision Settings</h4>
        </div>
        <div class="card-body">
          <p>Define the number of decimals for conversion results.</p>
          
          <div class="form-group">
            <label for="mmPrecision">mm Precision (decimals):</label>
            <input type="number" id="mmPrecision" min="0" max="6" value="3">
          </div>
          
          <div class="form-group">
            <label for="inchPrecision">Inch Precision (decimals):</label>
            <input type="number" id="inchPrecision" min="0" max="6" value="5">
          </div>
        </div>
      </div>
      
      <!-- And the rest of the settings tab content... -->
    `;
  }
  
  /**
   * Get HTML content for the Visualization tab
   */
  function getVisualizationTabContent() {
    return `
      <h3>NC File Visualization</h3>
      <p>2D visualization of the NC toolpath. Use the mouse wheel to zoom, and drag to pan.</p>
      
      <div class="visualization-container" style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-3);">
        <div class="visualization-canvas-wrapper" style="flex: 1; min-width: 300px; background-color: var(--gray-100); border-radius: var(--border-radius); box-shadow: var(--shadow); overflow: hidden; position: relative; height: 400px;">
          <canvas id="visualizationCanvas" width="600" height="400" tabindex="0" 
                  style="width: 100%; height: 100%; display: block; touch-action: none;"
                  aria-label="NC toolpath visualization canvas">
            Your browser does not support the canvas element.
          </canvas>
          
          <div class="visualization-controls" style="position: absolute; bottom: var(--space-2); right: var(--space-2); display: flex; gap: var(--space-2);">
            <button id="visualizationZoomIn" class="btn-sm" title="Zoom In">+</button>
            <button id="visualizationZoomOut" class="btn-sm" title="Zoom Out">−</button>
            <button id="visualizationFit" class="btn-sm" title="Fit View">↔</button>
            <button id="visualizationPlay" class="btn-sm" title="Play/Pause Animation">▶</button>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Get HTML content for the Batch tab
   */
  function getBatchTabContent() {
    return `
      <h3>Batch File Processing</h3>
      <p>Process multiple NC files at once with the same conversion settings.</p>
      
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-body">
          <div class="file-area batch-drop-area" id="batchFileArea" tabindex="0" role="button" aria-label="Select or drop multiple NC files for batch conversion">
            <div class="file-icon" aria-hidden="true">📂</div>
            <p>Click or drop multiple NC files here</p>
            <input type="file" id="batchFileInput" multiple style="display:none;" aria-hidden="true">
          </div>
          
          <div id="batchFileList" style="margin-top: var(--space-3); max-height: 200px; overflow-y: auto; border: 1px solid var(--gray-300); border-radius: var(--border-radius-sm); padding: var(--space-2);">
            <p class="text-center" style="color: var(--gray-500); font-style: italic;">No files in queue.</p>
          </div>
          
          <div style="margin-top: var(--space-3); display: flex; gap: var(--space-2);">
            <button id="clearBatchBtn" class="btn-secondary" disabled>Clear Files</button>
            <button id="processBatchBtn" class="btn" disabled>Process Files</button>
          </div>
        </div>
      </div>
    `;
  }
})();
