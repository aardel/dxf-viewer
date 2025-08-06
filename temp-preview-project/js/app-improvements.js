// File: js/app-improvements.js
/**
 * NC File Converter Improvement Integrator
 * Integrates all improvements into the existing application
 */

(function() {
  // --------------------------
  // Dark mode event dispatcher
  // --------------------------
  // Create custom event when dark mode changes
  if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.setDarkMode === 'function') {
    const originalSetDarkMode = NCConverter.UIHelpers.setDarkMode;
    
    NCConverter.UIHelpers.setDarkMode = function(isDark) {
      // Call original function
      originalSetDarkMode.call(this, isDark);
      
      // Dispatch custom event
      document.dispatchEvent(new CustomEvent('dark-mode-changed', {
        detail: { darkMode: isDark }
      }));
    };
  }
  
  // --------------------------
  // Module loading tracking
  // --------------------------
  // Hook into module initialization to track loading progress
  const modules = [
    'UIHelpers',
    'ErrorHandler',
    'Settings',
    'TokenManager',
    'HFunctions',
    'Conversion',
    'FileHandler',
    'TabManager'
  ];
  
  modules.forEach(moduleName => {
    if (NCConverter[moduleName] && typeof NCConverter[moduleName].init === 'function') {
      const originalInit = NCConverter[moduleName].init;
      
      NCConverter[moduleName].init = function() {
        // Call original init
        const result = originalInit.apply(this, arguments);
        
        // Update loading progress
        if (window.incrementLoadingProgress) {
          window.incrementLoadingProgress(`Loaded ${moduleName} module`);
        }
        
        return result;
      };
    }
  });
  
  // --------------------------
  // Main initializer hook
  // --------------------------
  if (NCConverter.init) {
    const originalInit = NCConverter.init;
    
    NCConverter.init = function() {
      console.log("Enhanced initializer running");
      
      // Call original init
      const result = originalInit.apply(this, arguments);
      
      // After initialization is complete, hide loading overlay
      setTimeout(() => {
        if (window.hideLoadingOverlay) {
          window.hideLoadingOverlay();
        }
        
        // Force visualization update if visualization tab is active
        if (document.querySelector('.tab-header[data-tab="visualization"].active') && 
            NCConverter.Visualization && typeof NCConverter.Visualization.parseAndDisplayFile === 'function') {
          console.log("Updating visualization after initialization");
          NCConverter.Visualization.parseAndDisplayFile();
        }
      }, 500);
      
      return result;
    };
  }
  
  // --------------------------
  // File content change tracking
  // --------------------------
  // Dispatch custom event when file content changes
  if (NCConverter.FileHandler && typeof NCConverter.FileHandler.readFile === 'function') {
    const originalReadFile = NCConverter.FileHandler.readFile;
    
    NCConverter.FileHandler.readFile = function() {
      // Call original function
      const result = originalReadFile.apply(this, arguments);
      
      // Dispatch event after a delay to ensure all processing is complete
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('fileContentChanged'));
      }, 1000);
      
      return result;
    };
  }
  
  // --------------------------
  // Cross-tab communication
  // --------------------------
  // Make visualization aware of active tab
  document.querySelectorAll('.tab-header').forEach(header => {
    const originalClick = header.onclick;
    
    header.onclick = function(e) {
      // Call original handler if it exists
      if (originalClick) {
        originalClick.call(this, e);
      }
      
      // Special handling for visualization tab
      if (this.getAttribute('data-tab') === 'visualization') {
        if (NCConverter.VisInitializer && typeof NCConverter.VisInitializer.init === 'function') {
          // Give it time to render
          setTimeout(() => {
            NCConverter.VisInitializer.init();
          }, 100);
        }
      }
    };
  });
  
  console.log("Improvement integrator initialized");
})();
