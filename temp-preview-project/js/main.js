/**
 * NC File Converter Main Module
 * Main application entry point and initialization with improved performance
 */

// Create the global NCConverter object if it doesn't exist
window.NCConverter = window.NCConverter || {};

// Initialize NCConverter state
NCConverter.state = {
  settings: null,         // Current application settings
  hMapping: [],           // H function mappings
  fileContent: "",        // Original file content
  convertedContent: "",   // Converted file content
  selectedFile: null,     // Currently selected file object
  finalUnits: "mm",       // The units after conversion (mm or inches)
  currentlyEditingH: null, // Currently editing H function (if any)
  directoryHandle: null,  // Directory handle for modern browsers
  initialized: false      // Whether app is fully initialized
};

/**
 * Application Configuration
 */
NCConverter.config = {
  // Core modules - initialized immediately
  coreModules: [
    'ErrorHandler',    // First error handling
    'UIHelpers',       // UI utilities
    'Settings',        // Application settings
    'TabManager'       // Tab manager
  ],
  
  // Feature modules - initialized when needed or after core
  featureModules: [
    'TokenManager',     // Token management 
    'HFunctions',       // H functions
    'Conversion',       // Unit conversion
    'Preview',          // Preview display
    'Search',           // Search functionality 
    'Export',           // Export functionality
    'FileSaver',        // File saving to custom paths
    'FileHandler',      // File handling
    'VersionCheck'      // Version checking
  ],
  
  // Tab-specific modules - initialized when tab is activated
  tabModules: {
    'visualization': ['VisInitializer'],
    'batch': ['BatchInitializer']
  },
  
  // Debugging modules - only initialized if needed
  debugModules: [
    // 'DebugHelper' - removed
  ]
};

/**
 * Check if the browser is capable of running the application
 */
NCConverter.checkBrowserCapabilities = function() {
  const requiredFeatures = [
    { name: 'ES6 Support', test: () => typeof Promise !== 'undefined' && typeof Symbol !== 'undefined' },
    { name: 'Fetch API', test: () => typeof fetch !== 'undefined' },
    { name: 'LocalStorage', test: () => typeof localStorage !== 'undefined' },
    { name: 'FileReader', test: () => typeof FileReader !== 'undefined' },
    { name: 'Blob', test: () => typeof Blob !== 'undefined' }
  ];
  
  const missingFeatures = requiredFeatures.filter(feature => !feature.test());
  
  if (missingFeatures.length > 0) {
    const message = `Your browser does not support: ${missingFeatures.map(f => f.name).join(', ')}. Please use a modern browser like Chrome, Firefox, or Edge.`;
    alert(message);
    return false;
  }
  
  return true;
};

/**
 * Initialize the application in the correct order
 */
NCConverter.init = function() {
      NCConverter.debugLog("NC Converter initializing...");
  
  // Check browser compatibility
  if (!this.checkBrowserCapabilities()) {
    return;
  }
  
  // Helper function to safely initialize a module
  const initModule = (moduleName) => {
    if (NCConverter[moduleName] && typeof NCConverter[moduleName].init === 'function') {
      try {
        NCConverter.debugLog(`Initializing ${moduleName}...`);
        NCConverter[moduleName].init();
        return true;
      } catch (error) {
        console.error(`Error initializing ${moduleName}:`, error);
        return false;
      }
    } else {
      console.warn(`Module ${moduleName} is not available or has no init method`);
      return false;
    }
  };

  // First ensure UIHelpers is available for other modules
  if (!NCConverter.UIHelpers) {
    NCConverter.UIHelpers = {
      showToast: function(msg, type) { 
        console.log(`[${type || 'info'}] ${msg}`);
        if (type === 'error') alert(msg);
      },
      escapeHtml: function(text) { 
        if (!text) return '';
        return text.toString()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      },
      escapeRegExp: function(text) { 
        if (!text) return '';
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    };
  }
  
  // Create queues for initialization
  const initQueue = [];
  
  // Stage 1: Initialize core modules sequentially
  const coreInitializationPromise = new Promise((resolve) => {
    let coreModulesInitialized = 0;
    
    const initNextCoreModule = (index) => {
      if (index >= this.config.coreModules.length) {
        NCConverter.debugLog(`Core modules initialization complete (${coreModulesInitialized}/${this.config.coreModules.length} succeeded)`);
        resolve();
        return;
      }
      
      const moduleName = this.config.coreModules[index];
      const success = initModule(moduleName);
      
      if (success) {
        coreModulesInitialized++;
      }
      
      // Process next module after a small delay to keep UI responsive
      setTimeout(() => {
        initNextCoreModule(index + 1);
      }, 10);
    };
    
    // Start initializing core modules
    initNextCoreModule(0);
  });
  
  // Stage 2: Initialize feature modules in parallel for better performance
  coreInitializationPromise.then(() => {
    NCConverter.debugLog("Starting feature modules initialization");
    
    // Create a queue of feature modules to initialize
    const featureInitPromises = this.config.featureModules.map(moduleName => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const success = initModule(moduleName);
          resolve({ moduleName, success });
        }, 0);
      });
    });
    
    // Wait for all feature modules to initialize
    Promise.all(featureInitPromises).then(results => {
      const successful = results.filter(r => r.success).length;
      NCConverter.debugLog(`Feature modules initialization complete (${successful}/${this.config.featureModules.length} succeeded)`);
      
      // Mark as fully initialized
      NCConverter.state.initialized = true;
      
      // Show the initial tab
      if (NCConverter.TabManager && typeof NCConverter.TabManager.selectTab === 'function') {
        NCConverter.TabManager.selectTab('conversion');
      }
      
      // Show toast to indicate application is ready
      if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === 'function') {
        NCConverter.UIHelpers.showToast("NC Converter ready", "info");
      }
    });
  });
};

/**
 * Initialize a tab and its associated modules
 * @param {string} tabId - ID of the tab being activated
 */
NCConverter.initializeTabModules = function(tabId) {
  if (this.config.tabModules[tabId]) {
    const modules = this.config.tabModules[tabId];
    
    modules.forEach(moduleName => {
      if (NCConverter[moduleName] && typeof NCConverter[moduleName].init === 'function' && 
          (!NCConverter[moduleName].initialized)) {
        try {
          console.log(`Initializing tab module: ${moduleName}...`);
          NCConverter[moduleName].init();
        } catch (error) {
          console.error(`Error initializing tab module ${moduleName}:`, error);
        }
      }
    });
  }
};

/**
 * Detect when something goes wrong and enable fallback functionality
 */
NCConverter.enableFallbackMode = function() {
  console.log("Enabling fallback mode...");
  
  // Setup fallback tab handling if TabManager fails
  if (!NCConverter.TabManager || !NCConverter.TabManager.initialized) {
    setupFallbackTabHandling();
  }
  
  // Setup fallback file handlers if FileHandler fails
  if (!NCConverter.FileHandler || !NCConverter.FileHandler.initialized) {
    setupFileHandlers();
  }
};

/**
 * Set up fallback tab handling if TabManager fails to initialize
 */
function setupFallbackTabHandling() {
  console.log("Setting up fallback tab handling");
  
  const tabHeaders = document.querySelectorAll('.tab-header');
  const tabContents = document.querySelectorAll('.tab-content');
  
  if (tabHeaders.length === 0 || tabContents.length === 0) {
    console.error("Tab elements not found");
    return;
  }
  
  tabHeaders.forEach(header => {
    header.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      if (!tabId) return;
      
      // Reset all tabs
      tabHeaders.forEach(h => {
        h.classList.remove('active');
        h.setAttribute('aria-selected', 'false');
      });
      
      tabContents.forEach(content => {
        content.style.display = 'none';
      });
      
      // Activate selected tab
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');
      
      const selectedContent = document.getElementById(`${tabId}-tab`);
      if (selectedContent) {
        selectedContent.style.display = 'block';
        
        // Initialize tab-specific content if needed
        NCConverter.initializeTabModules(tabId);
      }
    });
  });
  
  // Activate default tab
  const defaultTab = document.querySelector('.tab-header');
  if (defaultTab) {
    defaultTab.click();
  }
}

/**
 * Set up file handlers if FileHandler failed to initialize
 */
function setupFileHandlers() {
  console.log("Setting up fallback file handlers");
  
  // Main file area
  const fileArea = document.getElementById('fileArea');
  const fileInput = document.getElementById('fileInput');
  
  if (fileArea && fileInput) {
    // Clear existing listeners
    const newFileArea = fileArea.cloneNode(true);
    if (fileArea.parentNode) {
      fileArea.parentNode.replaceChild(newFileArea, fileArea);
    }
    
    // Get new input after the clone
    const newFileInput = document.getElementById('fileInput');
    
    newFileArea.addEventListener('click', () => {
      if (newFileInput) newFileInput.click();
    });
    
    newFileArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      newFileArea.classList.add('hover');
    });
    
    newFileArea.addEventListener('dragleave', () => {
      newFileArea.classList.remove('hover');
    });
    
    newFileArea.addEventListener('drop', (e) => {
      e.preventDefault();
      newFileArea.classList.remove('hover');
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });
    
    if (newFileInput) {
      newFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFileSelection(e.target.files[0]);
        }
      });
    }
  } else {
    console.error("File elements not found");
  }
}

/**
 * Handle file selection and trigger conversion (fallback function)
 * @param {File} file - Selected file
 */
function handleFileSelection(file) {
  if (!file) return;
  
  // Store file in state
  NCConverter.state.selectedFile = file;
  
  // Update UI with file info
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const fileInfo = document.getElementById('fileInfo');
  
  if (fileName && fileSize && fileInfo) {
    fileName.textContent = file.name;
    
    // Format file size
    let size = file.size;
    let unit = "bytes";
    if (size > 1024) { size = (size / 1024).toFixed(1); unit = "KB"; }
    if (size > 1024) { size = (size / 1024).toFixed(1); unit = "MB"; }
    fileSize.textContent = `${size} ${unit}`;
    
    // Show file info
    fileInfo.style.display = "block";
  }
  
  // Read file
  const reader = new FileReader();
  
  reader.onload = (e) => {
    NCConverter.state.fileContent = e.target.result;
    
    // Detect units and update UI
    const detectedUnit = document.getElementById('detectedUnit');
    if (detectedUnit) {
      detectedUnit.textContent = detectUnits(NCConverter.state.fileContent);
    }
    
    // Trigger conversion
    if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === 'function') {
      NCConverter.Conversion.updateConversion();
    } else {
      alert('Conversion module not available');
    }
  };
  
  reader.onerror = () => {
    alert('Error reading file');
  };
  
  reader.readAsText(file);
}

/**
 * Detect units from file content (fallback function)
 * @param {string} content - File content
 * @return {string} Detected units description
 */
function detectUnits(content) {
  if (!content) return "Unknown";
  
  // Check for explicit G-code unit indicators
  const lower = content.toLowerCase();
  
  if (/g20\b/.test(lower)) {
    const radio = document.getElementById("inchToMm");
    if (radio) radio.checked = true;
    return "Inches (G20 found)";
  }
  
  if (/g21\b/.test(lower)) {
    const radio = document.getElementById("mmToInch");
    if (radio) radio.checked = true;
    return "Millimeters (G21 found)";
  }
  
  // Fall back to analyzing coordinate values
  const matches = content.match(/[XY]\s*-?\d+\.?\d*/g) || [];
  const vals = matches.map(m => parseFloat(m.replace(/[XY]\s*/, "")));
  
  if (vals.length > 0) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    
    if (avg < 30) {
      const radio = document.getElementById("inchToMm");
      if (radio) radio.checked = true;
      return "Likely Inches (based on values)";
    } else {
      const radio = document.getElementById("mmToInch");
      if (radio) radio.checked = true;
      return "Likely Millimeters (based on values)";
    }
  }
  
  return "Unknown (No coordinates found)";
}

// Initialize on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  // First try normal initialization
  NCConverter.init();
  
  // Add a delayed check for fallback mode in case something goes wrong
  setTimeout(() => {
    // If app isn't fully initialized after 2 seconds, enable fallback
    if (!NCConverter.state.initialized) {
      NCConverter.enableFallbackMode();
    }
  }, 2000);
});