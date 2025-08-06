/**
 * NC File Converter Tab Manager
 * Handles tab switching, content creation, and initialization for different tabs
 */

NCConverter.TabManager = {
  // Keep track of active tab
  activeTab: null,
  
  // Flag for initialization
  initialized: false,
  
  /**
   * Initialize the tab management system
   */
  init: function() {
    NCConverter.debugLog("TabManager: Initializing");
    
    try {
      // Fix empty tabs first
      this.fixEmptyTabs();
      
      // Set up tab event listeners
      this.setupTabEventListeners();
      
      // Initial tab selection (Conversion tab)
      setTimeout(() => {
        this.selectTab('conversion');
        
        // Force initialize all tabs to ensure content is present
        this.initializeAllTabs();
      }, 100);
      
      // Mark as initialized
      this.initialized = true;
      
      NCConverter.debugLog("TabManager: Initialization complete");
    } catch (error) {
      console.error("Error initializing TabManager:", error);
    }
  },
  
  /**
   * Force initialize all tabs
   */
  initializeAllTabs: function() {
    try {
      // Force all tabs to initialize content
      ['preview', 'hfunctions', 'settings', 'visualization', 'batch'].forEach(tabId => {
        this.initializeTabContent(tabId, true);
      });
      
      NCConverter.debugLog("All tabs initialized");
    } catch (error) {
      console.error("Error initializing all tabs:", error);
    }
  },
  
  /**
   * Fix empty tabs by directly populating them with content
   */
  fixEmptyTabs: function() {
    // Check and fix each tab
    const previewTab = document.getElementById('preview-tab');
    if (previewTab && (!previewTab.innerHTML || previewTab.innerHTML.trim() === '')) {
      NCConverter.debugLog("Fixing empty preview tab");
      previewTab.innerHTML = this.getPreviewTabContent();
    }
    
    const hfunctionsTab = document.getElementById('hfunctions-tab');
    if (hfunctionsTab && (!hfunctionsTab.innerHTML || hfunctionsTab.innerHTML.trim() === '')) {
      NCConverter.debugLog("Fixing empty H Functions tab");
      hfunctionsTab.innerHTML = this.getHFunctionsTabContent();
    }
    
    const settingsTab = document.getElementById('settings-tab');
    if (settingsTab && (!settingsTab.innerHTML || settingsTab.innerHTML.trim() === '')) {
      NCConverter.debugLog("Fixing empty Settings tab");
      settingsTab.innerHTML = this.getSettingsTabContent();
      // Ensure settings event listeners are attached to new DOM
      if (NCConverter.Settings) {
        NCConverter.Settings.cacheElements();
        NCConverter.Settings.setupEventListeners();
      }
    }
    
    const visualizationTab = document.getElementById('visualization-tab');
    if (visualizationTab && (!visualizationTab.innerHTML || visualizationTab.innerHTML.trim() === '')) {
      NCConverter.debugLog("Fixing empty Visualization tab");
      visualizationTab.innerHTML = this.getVisualizationTabContent();
    }
    
    const batchTab = document.getElementById('batch-tab');
    if (batchTab && (!batchTab.innerHTML || batchTab.innerHTML.trim() === '')) {
      NCConverter.debugLog("Fixing empty Batch tab");
      batchTab.innerHTML = this.getBatchTabContent();
    }
  },
  
  /**
   * Setup tab event listeners
   */
  setupTabEventListeners: function() {
    const tabHeaders = document.querySelectorAll('.tab-header');
    
    // Log the number of tab headers found
    console.log(`Found ${tabHeaders.length} tab headers to set up`);
    
    if (tabHeaders.length === 0) {
      console.error("No tab headers found");
      return;
    }
    
    // Remove all existing event listeners first
    // by cloning and replacing all tab headers
    tabHeaders.forEach(header => {
      if (!header.parentNode) {
        console.error("Tab header missing parent node:", header);
        return;
      }
      
      try {
        // Clone and replace to clear all existing listeners
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        // Add click event handler directly to the DOM element (not using addEventListener)
        // This is more reliable across browsers
        newHeader.onclick = (e) => {
          e.preventDefault();
          
          const tabId = newHeader.getAttribute('data-tab');
          if (tabId) {
            console.log(`Tab clicked: ${tabId}`);
            this.selectTab(tabId);
          } else {
            console.error("Tab clicked but no data-tab attribute found");
          }
        };
        
        // Add keyboard support
        newHeader.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            
            const tabId = newHeader.getAttribute('data-tab');
            if (tabId) {
              this.selectTab(tabId);
            }
          }
        };
      } catch (error) {
        console.error("Error setting up tab header event listeners:", error);
      }
    });
    
    console.log("Tab event listeners set up");
  },
  
  /**
   * Select and activate a specific tab
   * @param {string} tabId - ID of the tab to select
   */
  selectTab: function(tabId) {
    console.log(`TabManager: Selecting tab "${tabId}"`);
    
    try {
      const tabHeaders = document.querySelectorAll('.tab-header');
      const tabContents = document.querySelectorAll('.tab-content');
      
      // Reset all tabs
      tabHeaders.forEach(header => {
        header.classList.remove('active');
        header.setAttribute('aria-selected', 'false');
      });
      
      tabContents.forEach(content => {
        content.style.display = 'none';
      });
      
      // Find the selected tab header and content
      const selectedHeader = document.querySelector(`.tab-header[data-tab="${tabId}"]`);
      const selectedContent = document.getElementById(`${tabId}-tab`);
      
      if (!selectedHeader) {
        console.error(`Tab header for "${tabId}" not found`);
        return;
      }
      
      if (!selectedContent) {
        console.error(`Tab content for "${tabId}" not found`);
        return;
      }
      
      // Activate selected tab
      selectedHeader.classList.add('active');
      selectedHeader.setAttribute('aria-selected', 'true');
      selectedContent.style.display = 'block';
      
      // Store active tab
      this.activeTab = tabId;
      
      // Make sure tab has content
      this.ensureTabContent(tabId, selectedContent);
      
      // Initialize tab-specific functionality
      this.initializeTabContent(tabId);
      
      console.log(`Tab "${tabId}" activated successfully`);
    } catch (error) {
      console.error(`Error selecting tab "${tabId}":`, error);
    }
  },
  
  /**
   * Ensure the tab has content
   * @param {string} tabId - ID of the tab
   * @param {HTMLElement} contentElement - The tab content element
   */
  ensureTabContent: function(tabId, contentElement) {
    // If tab content is empty, populate it
    if (!contentElement.innerHTML || contentElement.innerHTML.trim() === '') {
      console.log(`Tab ${tabId} is empty, populating with default content`);
      
      switch(tabId) {
        case 'preview':
          contentElement.innerHTML = this.getPreviewTabContent();
          break;
        case 'hfunctions':
          contentElement.innerHTML = this.getHFunctionsTabContent();
          break;
        case 'settings':
          contentElement.innerHTML = this.getSettingsTabContent();
          break;
        case 'visualization':
          contentElement.innerHTML = this.getVisualizationTabContent();
          break;
        case 'batch':
          contentElement.innerHTML = this.getBatchTabContent();
          break;
      }
    }
  },
  
  /**
   * Initialize content for specific tabs when activated
   * @param {string} tabId - ID of the tab being activated
   * @param {boolean} force - Whether to force reinitialization
   */
  initializeTabContent: function(tabId, force = false) {
    try {
      console.log(`Initializing content for tab "${tabId}"`);
      
      // Get tab content element
      const tabContent = document.getElementById(`${tabId}-tab`);
      if (!tabContent) {
        console.error(`Tab content element "${tabId}-tab" not found`);
        return;
      }
      
      switch(tabId) {
        case 'visualization':
          if (NCConverter.VisInitializer && typeof NCConverter.VisInitializer.init === 'function') {
            NCConverter.VisInitializer.init();
          } else {
            console.warn("Visualization initializer not available");
          }
          break;
          
        case 'batch':
          if (NCConverter.BatchInitializer && typeof NCConverter.BatchInitializer.init === 'function') {
            NCConverter.BatchInitializer.init();
          } else if (NCConverter.BatchProcessor && typeof NCConverter.BatchProcessor.init === 'function') {
            NCConverter.BatchProcessor.init();
          } else {
            console.warn("Batch initializer not available");
          }
          break;
          
        case 'preview':
          // Only regenerate preview tab content if it doesn't have the mappings display element
          const previewTab = document.getElementById('preview-tab');
          if (previewTab) {
            const mappingsDisplay = document.getElementById('activeMappingsDisplay');
            if (!mappingsDisplay) {
              console.log('Mappings display missing, regenerating preview tab content');
              previewTab.innerHTML = this.getPreviewTabContent();
            } else {
              console.log('Preview tab content exists with mappings display, not regenerating');
            }
            
            // Ensure scroll lock checkbox exists
            const scrollLock = document.getElementById('scrollLock');
            if (!scrollLock) {
              console.log('Scroll lock checkbox missing, adding it dynamically');
              this.addScrollLockCheckbox();
            }
          }
          
          if (NCConverter.Preview && typeof NCConverter.Preview.updatePreview === 'function') {
            NCConverter.Preview.updatePreview();
          } else {
            console.warn("Preview module not available");
          }
          
          // Update active mappings display
          setTimeout(() => {
            if (NCConverter.Preview && typeof NCConverter.Preview.updateActiveMappingsDisplay === 'function') {
              NCConverter.Preview.updateActiveMappingsDisplay();
            }
          }, 100);
          
          // Initialize search module for preview tab
          if (NCConverter.Search && typeof NCConverter.Search.init === 'function') {
            NCConverter.Search.init();
          } else {
            console.warn("Search module not available");
          }
          // Scroll sync will be set up after preview content is loaded
          break;
          
        case 'hfunctions':
          if (NCConverter.HFunctions && typeof NCConverter.HFunctions.updateHMappingUI === 'function') {
            NCConverter.HFunctions.updateHMappingUI();
          } else {
            console.warn("HFunctions module not available");
            
            // Set up the Detect H button if module isn't available
            const detectHBtn = document.getElementById('detectHBtn');
            if (detectHBtn) {
              detectHBtn.onclick = function() {
                alert("H function detection not available");
              };
            }
          }
          break;
          
        case 'settings':
          // Set up token management if module isn't available
          const tokenList = document.getElementById('tokenList');
          if (tokenList && (!tokenList.innerHTML || tokenList.innerHTML.trim() === '')) {
            tokenList.innerHTML = '<div class="token-item" style="display: flex; align-items: center; padding: 8px; background-color: var(--gray-100); margin-bottom: 4px; border-radius: var(--border-radius-sm); border: 1px solid var(--gray-300);"><span class="token-name" style="flex-grow: 1; font-weight: 500; font-family: var(--font-mono);">X</span><button class="remove-token btn-sm btn-danger" style="padding: 2px 8px;">Remove</button></div><div class="token-item" style="display: flex; align-items: center; padding: 8px; background-color: var(--gray-100); margin-bottom: 4px; border-radius: var(--border-radius-sm); border: 1px solid var(--gray-300);"><span class="token-name" style="flex-grow: 1; font-weight: 500; font-family: var(--font-mono);">Y</span><button class="remove-token btn-sm btn-danger" style="padding: 2px 8px;">Remove</button></div>';
          }
          break;
      }
    } catch (error) {
      console.error(`Error initializing tab content for "${tabId}":`, error);
    }
  },
  
  /**
   * Get Preview tab content
   * @return {string} HTML content for preview tab
   */
  getPreviewTabContent: function() {
    console.log('Generating preview tab content with scroll lock checkbox...');
    const content = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
        <h3 style="margin: 0;">File Preview</h3>
        <div id="activeMappingsDisplay" style="font-size: 14px; color: var(--gray-400); font-style: italic;">
          <!-- Active H mappings will be displayed here -->
        </div>
      </div>
      <p>Compare the original code with the converted result. <span style="color: var(--primary-color); font-weight: 500;">Blue</span> highlights show converted tokens, <span style="color: var(--danger-color); font-weight: 500;">red</span> highlights show H functions that will be changed.</p>
      
      <!-- Debug refresh button -->
      <button onclick="NCConverter.TabManager.refreshPreviewTab()" style="margin-bottom: 10px; background-color: var(--warning-color); color: black; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">🔄 Refresh Preview Tab</button>
      
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
          <div class="checkbox-option" style="margin-left: var(--space-3); margin-bottom: 0; display: flex; align-items: center; background-color: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px;">
            <input type="checkbox" id="scrollLock" checked style="margin-right: 6px;">
            <label for="scrollLock" style="margin-bottom: 0; font-weight: 500; color: var(--text-color);">🔒 Scroll Lock</label>
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
    
    console.log('Preview tab content generated, includes scroll lock:', content.includes('scrollLock'));
    return content;
  },
  
  /**
   * Get H Functions tab content
   * @return {string} HTML content for H Functions tab
   */
  getHFunctionsTabContent: function() {
    return `
      <div class="flex-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
        <div>
          <h3>H Function Mapping</h3>
          <p>Map H functions in your file to alternative functions.</p>
        </div>
        <div style="display: flex; gap: var(--space-2);">
          <button id="detectHBtn" class="btn">
            <i class="icon">🔍</i> Detect H Numbers
          </button>
          <button onclick="NCConverter.HFunctions.diagnoseMappingIssues()" style="background-color: var(--warning-color); color: black; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            🔧 Diagnose Issues
          </button>
          <button onclick="NCConverter.HFunctions.forceRefreshMapping()" style="background-color: var(--success-color); color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            🔄 Force Refresh
          </button>
        </div>
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
  },
  
  /**
   * Get Settings tab content
   * @return {string} HTML content for settings tab
   */
  getSettingsTabContent: function() {
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
      
      <!-- File Formatting Card -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">File Formatting</h4>
        </div>
        <div class="card-body">
          <p>Settings affecting file output formatting.</p>
          
          <div class="checkbox-option">
            <input type="checkbox" id="preserveNewlines" checked>
            <label for="preserveNewlines">Preserve original newline format</label>
          </div>
          
          <div class="checkbox-option">
            <input type="checkbox" id="normalizeSpacing">
            <label for="normalizeSpacing">Normalize spacing between tokens and values</label>
          </div>
          <div class="checkbox-option">
            <input type="checkbox" id="autoInchHeader" checked>
            <label for="autoInchHeader">Auto convert to inch header (insert :P2027=25.4/P674 and G75 X=P2027 Y=P2027 after %1 if missing)</label>
          </div>
        </div>
      </div>
      
      <!-- Save Path Settings Card -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">Save Path Settings</h4>
        </div>
        <div class="card-body">
          <p>Choose where to save converted files. Use 'Browse' for easy folder selection on modern browsers.</p>
          
          <div class="form-group">
            <label for="customSavePath">Save Location:</label>
            <div style="display: flex; gap: var(--space-2); align-items: center; margin-bottom: var(--space-2);">
              <button id="browseSavePathBtn" class="btn" style="min-width: 120px;">📁 Browse Folder</button>
              <span style="color: var(--gray-600); font-size: 14px;">← Recommended: Click to select a folder</span>
            </div>
            <div style="display: flex; gap: var(--space-2); align-items: center;">
              <input type="text" id="customSavePath" placeholder="Or enter path manually: /Users/username/Documents/NC-Files" 
                     style="flex-grow: 1; font-family: monospace; font-size: 12px;">
              <button id="testSavePathBtn" class="btn-sm">Test</button>
            </div>
            <small style="display: block; margin-top: 4px; color: var(--text-muted);">
              <strong>Mac:</strong> /Users/username/Documents/NC-Files<br>
              <strong>Windows:</strong> C:\\Users\\username\\Documents\\NC-Files or \\\\server\\share\\folder<br>
              <strong>Linux:</strong> /home/username/Documents/NC-Files
            </small>
          </div>
          
          <div id="savePathStatus" style="margin-top: var(--space-2); padding: var(--space-2); border-radius: var(--border-radius-sm); display: none;">
            <!-- Path validation status will be shown here -->
          </div>
        </div>
      </div>
      
      <!-- H Function Settings Card -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">H Function Settings</h4>
        </div>
        <div class="card-body">
          <p>Define H function names and numbers. These will be used for function mapping and display in visualizations.</p>
          
          <!-- H Function Definitions List -->
          <div style="margin-bottom: var(--space-3);">
            <h5>Defined H Functions:</h5>
            <div style="border: 1px solid var(--gray-300); border-radius: var(--border-radius-sm); max-height: 200px; overflow-y: auto; margin-bottom: var(--space-3);">
              <div id="hFunctionsList" style="padding: var(--space-2); min-height: 80px;">
                <p style="font-style: italic; color: var(--gray-500); text-align: center; padding: var(--space-2); margin: 0;">
                  No H functions defined. Add H functions below.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Add New H Function -->
          <div style="margin-bottom: var(--space-3);">
            <h5>Add New H Function:</h5>
            <div style="display: flex; gap: var(--space-2); align-items: end; margin-bottom: var(--space-2);">
              <div style="flex: 0 0 100px;">
                <label for="newHNumber" style="display: block; font-size: 14px; margin-bottom: 4px;">H Number:</label>
                <input type="number" id="newHNumber" placeholder="1" min="1" max="999" 
                       style="width: 100%; padding: 6px; border: 1px solid var(--gray-300); border-radius: 4px;">
              </div>
              <div style="flex: 1;">
                <label for="newHName" style="display: block; font-size: 14px; margin-bottom: 4px;">Function Name:</label>
                <input type="text" id="newHName" placeholder="Enter function name (e.g., Drill, Tap, Chamfer)" 
                       style="width: 100%; padding: 6px; border: 1px solid var(--gray-300); border-radius: 4px;">
              </div>
              <button id="addHFunctionBtn" class="btn" style="margin-bottom: 0; height: 36px;">Add H Function</button>
            </div>
          </div>
          
          <!-- Edit H Function Section (hidden by default) -->
          <div id="editHFunctionSection" style="display: none; margin-bottom: var(--space-3); padding: var(--space-3); background-color: var(--gray-50); border: 1px solid var(--gray-300); border-radius: var(--border-radius-sm);">
            <h5>Edit H Function:</h5>
            <div style="display: flex; gap: var(--space-2); align-items: end; margin-bottom: var(--space-2);">
              <div style="flex: 0 0 100px;">
                <label for="editHNumber" style="display: block; font-size: 14px; margin-bottom: 4px;">H Number:</label>
                <input type="number" id="editHNumber" min="1" max="999" 
                       style="width: 100%; padding: 6px; border: 1px solid var(--gray-300); border-radius: 4px;">
              </div>
              <div style="flex: 1;">
                <label for="editHName" style="display: block; font-size: 14px; margin-bottom: 4px;">Function Name:</label>
                <input type="text" id="editHName" 
                       style="width: 100%; padding: 6px; border: 1px solid var(--gray-300); border-radius: 4px;">
              </div>
              <button id="saveHFunctionBtn" class="btn" style="margin-bottom: 0; height: 36px;">Save Changes</button>
              <button id="cancelEditHFunctionBtn" class="btn-secondary" style="margin-bottom: 0; height: 36px;">Cancel</button>
            </div>
          </div>
          
          <!-- H Function Management Actions -->
          <div style="display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-3);">
            <button id="resetHFunctionsBtn" class="btn-secondary">Reset to Default H Functions</button>
            <button onclick="NCConverter.TabManager.selectTab('hfunctions'); return false;" class="btn" style="background-color: var(--primary-color); color: white;">View H Function Mapping →</button>
          </div>
          
          <!-- Template for H Function Definition Items (hidden) -->
          <template id="hFunctionDefItemTemplate">
            <div class="h-function-item" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2); border-bottom: 1px solid var(--gray-200);">
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <strong style="color: var(--primary-color); font-family: monospace;">H<span class="h-number"></span></strong>
                <span class="h-name"></span>
              </div>
              <div style="display: flex; gap: var(--space-1);">
                <button class="edit-h-btn btn-sm" title="Edit this H function">✏️ Edit</button>
                <button class="delete-h-btn btn-sm btn-danger" title="Delete this H function">🗑️ Delete</button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Token Management Card -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">Conversion Tokens</h4>
        </div>
        <div class="card-body">
          <p>Define which tokens should be converted (coordinates, dimensions, etc.)</p>
          
          <!-- Token List with scrollable container -->
          <div style="border: 1px solid var(--gray-300); border-radius: var(--border-radius-sm); max-height: 200px; overflow-y: auto; margin-bottom: var(--space-3);">
            <div id="tokenList" style="padding: var(--space-2); min-height: 50px;"></div>
          </div>
          
          <!-- Add Token Form -->
          <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-3);">
            <input type="text" id="customToken" placeholder="Add custom token (e.g. X, Y, Z, I, J, R)" 
                   style="flex-grow: 1;">
            <button id="addTokenBtn">Add Token</button>
          </div>
          
          <!-- Predefined Common Tokens -->
          <div style="margin-bottom: var(--space-3);">
            <h5>Common Tokens:</h5>
            <div style="display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2);">
              <button class="quick-token-btn btn-sm" data-token="X">X</button>
              <button class="quick-token-btn btn-sm" data-token="Y">Y</button>
              <button class="quick-token-btn btn-sm" data-token="Z">Z</button>
              <button class="quick-token-btn btn-sm" data-token="I">I</button>
              <button class="quick-token-btn btn-sm" data-token="J">J</button>
              <button class="quick-token-btn btn-sm" data-token="K">K</button>
              <button class="quick-token-btn btn-sm" data-token="R">R</button>
              <button class="quick-token-btn btn-sm" data-token="Radius:">Radius:</button>
              <button class="quick-token-btn btn-sm" data-token="CylDia:">CylDia:</button>
              <button class="quick-token-btn btn-sm" data-token="GROESSE:">GROESSE:</button>
              <button class="quick-token-btn btn-sm" data-token="SIZE:">SIZE:</button>
            </div>
          </div>
          
          <!-- Reset Tokens Button -->
          <button id="resetTokensBtn" class="btn-secondary">Reset to Default Tokens</button>
        </div>
      </div>
      
      <!-- Appearance Settings Card -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">Appearance Settings</h4>
        </div>
        <div class="card-body">
          <div class="checkbox-option">
            <input type="checkbox" id="darkModeToggle">
            <label for="darkModeToggle">Dark Mode</label>
          </div>
        </div>
      </div>
      
      <!-- Developer Settings Card -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">Developer Settings</h4>
        </div>
        <div class="card-body">
          <p>Settings for development and debugging purposes.</p>
          <div class="checkbox-option">
            <input type="checkbox" id="debugModeToggle">
            <label for="debugModeToggle">Enable Browser Debug Console Logging</label>
            <small style="display: block; margin-top: 4px; color: var(--text-muted);">
              When enabled, detailed debug messages will be shown in the browser console (F12 → Console tab). 
              You can also use <code>NCConverter.enableDebugMode()</code> or <code>NCConverter.disableDebugMode()</code> 
              in the console to toggle this setting programmatically.
            </small>
          </div>
        </div>
      </div>
      
      <!-- Updates Card -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">Updates</h4>
        </div>
        <div class="card-body">
          <p>Current Version: <span id="currentVersion"></span></p>
          <p>Last checked: <span id="lastUpdateCheck">Never</span></p>
          <button id="checkUpdateBtn" class="btn">Check for Updates</button>
          <div id="updateStatus" style="margin-top: var(--space-2);"></div>
        </div>
      </div>
      
      <!-- Reset Settings Card -->
      <div class="card">
        <div class="card-header">
          <h4 style="margin-bottom: 0;">Reset Settings</h4>
        </div>
        <div class="card-body">
          <p>Click below to reset all settings (except H mappings) to default values.</p>
          <button id="resetSettingsBtn" class="btn-danger">Reset to Default Settings</button>
        </div>
      </div>
    `;
  },
  
  /**
   * Get placeholder content for Visualization tab
   * @return {string} HTML content for visualization tab
   */
  getVisualizationTabContent: function() {
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
  },
  
  /**
   * Get placeholder content for Batch Processing tab
   * @return {string} HTML content for batch processing tab
   */
  getBatchTabContent: function() {
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
  },
  
  /**
   * Check if tabs are working properly and reinitialize if needed
   */
  checkAndFixTabs: function() {
    console.log("Checking and fixing tabs...");
    
    // Fix empty tabs first
    this.fixEmptyTabs();
    
    // Get current tabs
    const tabHeaders = document.querySelectorAll('.tab-header');
    let workingTabs = 0;
    
    // Check if any tabs have click events
    tabHeaders.forEach(header => {
      const hasClickEvent = header.onclick || header._hasEventListener;
      if (hasClickEvent) {
        workingTabs++;
      }
    });
    
    // If no tabs are working, reinitialize
    if (workingTabs === 0) {
      console.log("Tab Manager: No working tabs found, reinitializing...");
      this.setupTabEventListeners();
      
      // Force re-select current tab or default to conversion
      if (this.activeTab) {
        this.selectTab(this.activeTab);
      } else {
        this.selectTab('conversion');
      }
    }
    
    // Force initialize all tabs
    this.initializeAllTabs();
    
    console.log("Tab check and fix complete");
  },

  /**
   * Setup scroll synchronization between preview panels (one-time only)
   */
  setupScrollSyncOnce: function() {
    const originalPreview = document.getElementById('originalPreview');
    const convertedPreview = document.getElementById('convertedPreview');
    const scrollLock = document.getElementById('scrollLock');
    
    console.log('Setting up scroll sync (one-time)...');
    
    if (!originalPreview || !convertedPreview || !scrollLock) {
      console.log('Preview elements not available for scroll sync');
      return;
    }
    
    // Check if content is actually loaded
    const originalHTML = originalPreview.innerHTML;
    const convertedHTML = convertedPreview.innerHTML;
    const hasOriginalContent = originalHTML && originalHTML.length > 50 && !originalHTML.includes('No file loaded');
    const hasConvertedContent = convertedHTML && convertedHTML.length > 50 && !convertedHTML.includes('No conversion available');
    
    console.log('Original content loaded:', hasOriginalContent, '(length:', originalHTML.length, ')');
    console.log('Converted content loaded:', hasConvertedContent, '(length:', convertedHTML.length, ')');
    console.log('Original HTML preview:', originalHTML.substring(0, 100));
    console.log('Converted HTML preview:', convertedHTML.substring(0, 100));
    
    if (!hasOriginalContent && !hasConvertedContent) {
      console.log('No content loaded yet, scroll sync will be available when content is loaded');
      return;
    }
    
    // Remove existing listeners to prevent duplicates
    if (this.syncScrollHandler) {
      originalPreview.removeEventListener('scroll', this.syncScrollHandler.fromOriginal);
      convertedPreview.removeEventListener('scroll', this.syncScrollHandler.fromConverted);
    }
    
    // Create sync function
    let isScrolling = false;
    const syncScroll = (source, target) => {
      if (!scrollLock.checked || isScrolling) return;
      
      isScrolling = true;
      
      if (source.scrollHeight > source.clientHeight) {
        const percent = source.scrollTop / (source.scrollHeight - source.clientHeight);
        target.scrollTop = percent * (target.scrollHeight - target.clientHeight);
      }
      
      setTimeout(() => { isScrolling = false; }, 50);
    };
    
    // Store handlers for removal later
    this.syncScrollHandler = {
      fromOriginal: () => syncScroll(originalPreview, convertedPreview),
      fromConverted: () => syncScroll(convertedPreview, originalPreview)
    };
    
    // Add event listeners
    originalPreview.addEventListener('scroll', this.syncScrollHandler.fromOriginal);
    convertedPreview.addEventListener('scroll', this.syncScrollHandler.fromConverted);
    
    console.log('Scroll synchronization setup complete');
  },

  /**
   * Manually refresh the preview tab content
   */
  refreshPreviewTab: function() {
    console.log('Manually refreshing preview tab content...');
    const previewTab = document.getElementById('preview-tab');
    if (previewTab) {
      previewTab.innerHTML = this.getPreviewTabContent();
      console.log('Preview tab content forcefully regenerated');
      
      // Update preview and mappings display
      if (NCConverter.Preview && typeof NCConverter.Preview.updatePreview === 'function') {
        NCConverter.Preview.updatePreview();
      }
      
      // Force update mappings display
      setTimeout(() => {
        if (NCConverter.Preview && typeof NCConverter.Preview.updateActiveMappingsDisplay === 'function') {
          NCConverter.Preview.updateActiveMappingsDisplay();
        }
      }, 200);
      
    } else {
      console.error('Preview tab element not found for manual refresh.');
    }
  },

  /**
   * Add scroll lock checkbox dynamically to existing preview tab
   */
  addScrollLockCheckbox: function() {
    const searchContainer = document.querySelector('.search-container');
    if (!searchContainer) {
      console.warn('Search container not found, cannot add scroll lock checkbox');
      return;
    }
    
    // Find the search controls div
    const searchControls = searchContainer.querySelector('div[style*="display: flex"]');
    if (!searchControls) {
      console.warn('Search controls not found, cannot add scroll lock checkbox');
      return;
    }
    
    // Check if scroll lock already exists
    if (document.getElementById('scrollLock')) {
      console.log('Scroll lock checkbox already exists');
      return;
    }
    
    // Create scroll lock checkbox div
    const scrollLockDiv = document.createElement('div');
    scrollLockDiv.className = 'checkbox-option';
    scrollLockDiv.style.marginLeft = 'var(--space-3)';
    scrollLockDiv.style.marginBottom = '0';
    scrollLockDiv.style.display = 'flex';
    scrollLockDiv.style.alignItems = 'center';
    scrollLockDiv.style.backgroundColor = 'rgba(255,255,255,0.1)';
    scrollLockDiv.style.padding = '4px 8px';
    scrollLockDiv.style.borderRadius = '4px';
    
    // Create checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'scrollLock';
    checkbox.checked = true;
    checkbox.style.marginRight = '6px';
    
    // Create label
    const label = document.createElement('label');
    label.htmlFor = 'scrollLock';
    label.style.marginBottom = '0';
    label.style.fontWeight = '500';
    label.style.color = 'var(--text-color)';
    label.textContent = '🔒 Scroll Lock';
    
    // Append elements
    scrollLockDiv.appendChild(checkbox);
    scrollLockDiv.appendChild(label);
    searchControls.appendChild(scrollLockDiv);
    
    console.log('Scroll lock checkbox added dynamically');
  }
};
