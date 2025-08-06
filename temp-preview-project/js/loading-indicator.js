/**
 * Loading Indicator Module
 * Shows loading progress during application initialization
 */
(function() {
  'use strict';
  
  // Wait for DOM to be ready
  function initLoadingIndicator() {
    if (!document.body) {
      // DOM not ready yet, wait a bit
      setTimeout(initLoadingIndicator, 10);
      return;
    }
    
  // Create loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loadingOverlay';
  loadingOverlay.style.position = 'fixed';
  loadingOverlay.style.top = '0';
  loadingOverlay.style.left = '0';
  loadingOverlay.style.width = '100%';
  loadingOverlay.style.height = '100%';
  loadingOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  loadingOverlay.style.display = 'flex';
  loadingOverlay.style.flexDirection = 'column';
  loadingOverlay.style.alignItems = 'center';
  loadingOverlay.style.justifyContent = 'center';
  loadingOverlay.style.zIndex = '9999';
  loadingOverlay.style.transition = 'opacity 0.5s ease-out';
  
  // Add content to loading overlay
  loadingOverlay.innerHTML = `
    <div style="text-align: center;">
      <h2 style="color: var(--primary-color); margin-bottom: 20px;">NC File Converter</h2>
      <div class="loading-spinner" style="margin-bottom: 20px;"></div>
      <p id="loadingStatus">Loading application...</p>
      <div class="loading-progress-container" style="width: 300px; height: 8px; background-color: var(--gray-300); border-radius: 4px; overflow: hidden; margin-top: 10px;">
        <div id="loadingProgressBar" style="width: 0%; height: 100%; background-color: var(--primary-color); transition: width 0.3s ease-in-out;"></div>
      </div>
    </div>
  `;
  
  // Add CSS for spinner
  const spinnerStyle = document.createElement('style');
  spinnerStyle.textContent = `
    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 5px solid var(--gray-300);
      border-radius: 50%;
      border-top: 5px solid var(--primary-color);
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Dark mode support */
    .dark-mode #loadingOverlay {
      background-color: rgba(33, 37, 41, 0.9);
    }
    
    .dark-mode #loadingStatus,
    .dark-mode #loadingOverlay h2 {
      color: var(--gray-100);
    }
  `;
  
  // Add spinner style to document
  document.head.appendChild(spinnerStyle);
  
  // Track modules loaded
  let modulesLoaded = 0;
  const totalModules = 8; // Adjust based on your modules
  
  // Add to document
  if (document.body) {
    document.body.appendChild(loadingOverlay);
  }
  
  // Function to update loading progress
  window.updateLoadingProgress = function(message, progress) {
    const statusElement = document.getElementById('loadingStatus');
    const progressBar = document.getElementById('loadingProgressBar');
    
    if (statusElement && message) {
      statusElement.textContent = message;
    }
    
    if (progressBar && progress !== undefined) {
      progressBar.style.width = `${progress}%`;
    }
  };
  
  // Function to increment loading progress
  window.incrementLoadingProgress = function(message) {
    modulesLoaded++;
    const progress = Math.min(Math.round((modulesLoaded / totalModules) * 100), 95);
    window.updateLoadingProgress(message || `Loading module ${modulesLoaded}/${totalModules}...`, progress);
  };
  
  // Function to hide loading overlay
  window.hideLoadingOverlay = function() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      // Ensure progress is at 100%
      window.updateLoadingProgress('Application ready!', 100);
      
      // Fade out
      setTimeout(() => {
        overlay.style.opacity = '0';
        
        // Remove after transition
        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }, 500);
      }, 300);
    }
  };
  
  // Set initial progress
  window.updateLoadingProgress('Initializing application...', 5);
  
  // Hide overlay if initialization takes too long
  setTimeout(() => {
    window.hideLoadingOverlay();
  }, 30000); // 30 seconds timeout
  }
  
  // Initialize when DOM is ready
  initLoadingIndicator();
})();
