/**
 * NC File Converter UI Helpers
 * Utility functions for UI interactions and notifications
 */

// Initialize UI helpers module
NCConverter.UIHelpers = {
  /**
   * Initialize UI helpers
   */
  init: function() {
    console.log("UIHelpers initializing");
    
    // Create toast element if it doesn't exist
    if (!document.getElementById('toast')) {
      const toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    
    // Create global dark mode toggle
    this.createDarkModeToggle();
    
    // Apply current dark mode setting if available
    if (NCConverter.state && NCConverter.state.settings && typeof NCConverter.state.settings.darkMode === 'boolean') {
      this.setDarkMode(NCConverter.state.settings.darkMode);
      
      // Update toggle to match current setting
      const toggle = document.getElementById('darkModeToggleGlobal');
      if (toggle) {
        toggle.checked = NCConverter.state.settings.darkMode;
      }
    }
    
    console.log("UIHelpers initialized");
  },
  
  /**
   * Create a global dark mode toggle in the header
   */
  createDarkModeToggle: function() {
    // Check if toggle already exists
    if (document.getElementById('darkModeToggleContainer')) {
      return;
    }
    
    // Find the header where we'll add the toggle
    const header = document.querySelector('.header .container');
    if (!header) {
      console.warn("Header not found, can't add dark mode toggle");
      return;
    }
    
    // Create toggle container
    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'darkModeToggleContainer';
    toggleContainer.className = 'dark-mode-toggle-container';
    toggleContainer.style.position = 'absolute';
    toggleContainer.style.right = '20px';
    toggleContainer.style.top = '50%';
    toggleContainer.style.transform = 'translateY(-50%)';
    toggleContainer.style.display = 'flex';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.gap = '8px';
    
    // Create toggle switch HTML
    toggleContainer.innerHTML = `
      <span style="font-size: 14px;">☀️</span>
      <label class="switch" style="position: relative; display: inline-block; width: 40px; height: 20px;">
        <input type="checkbox" id="darkModeToggleGlobal">
        <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px;"></span>
      </label>
      <span style="font-size: 14px;">🌙</span>
    `;
    
    // Make header relatively positioned to contain the absolute positioned toggle
    header.style.position = 'relative';
    
    // Add toggle to header
    header.appendChild(toggleContainer);
    
    // Add event listener to toggle
    const toggle = document.getElementById('darkModeToggleGlobal');
    if (toggle) {
      toggle.addEventListener('change', () => {
        // Update dark mode
        this.setDarkMode(toggle.checked);
        
        // Save setting
        if (NCConverter.state && NCConverter.state.settings) {
          NCConverter.state.settings.darkMode = toggle.checked;
          
          // Save settings if Settings module is available
          if (NCConverter.Settings && typeof NCConverter.Settings.saveSettings === 'function') {
            NCConverter.Settings.saveSettings(NCConverter.state.settings);
          }
          
          // Update toggle in settings tab if it exists
          const settingsToggle = document.getElementById('darkModeToggle');
          if (settingsToggle) {
            settingsToggle.checked = toggle.checked;
          }
        }
      });
    }
    
    // Add CSS for the toggle switch
    const style = document.createElement('style');
    style.textContent = `
      /* Dark mode toggle styling */
      .switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
      }
      
      input:checked + .slider {
        background-color: var(--primary-color);
      }
      
      input:focus + .slider {
        box-shadow: 0 0 1px var(--primary-color);
      }
      
      input:checked + .slider:before {
        transform: translateX(20px);
      }
      
      /* Make dark mode toggle responsive */
      @media (max-width: 600px) {
        #darkModeToggleContainer {
          position: static;
          margin-top: 10px;
          transform: none;
          justify-content: center;
        }
      }
    `;
    
    document.head.appendChild(style);
  },
  
  /**
   * Set dark mode on/off
   * @param {boolean} isDark - Whether to enable dark mode
   */
  setDarkMode: function(isDark) {
    if (isDark) { 
      document.body.classList.add("dark-mode"); 
    } else { 
      document.body.classList.remove("dark-mode"); 
    }
    
    // Update both toggles to stay in sync
    const globalToggle = document.getElementById('darkModeToggleGlobal');
    const settingsToggle = document.getElementById('darkModeToggle');
    
    if (globalToggle) globalToggle.checked = isDark;
    if (settingsToggle) settingsToggle.checked = isDark;
  },
  
  /**
   * Show a toast notification
   * @param {string} msg - Message to display
   * @param {string} type - Notification type: "info", "error", "warning", "success"
   */
  showToast: function(msg, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) {
      console.warn("Toast element not found");
      return;
    }
    
    // Clear any existing timeout to prevent hiding a previously shown toast
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    
    toast.textContent = msg;
    toast.className = "toast";
    
    if (type === "error") toast.classList.add("error");
    if (type === "warning") toast.classList.add("warning");
    if (type === "success") toast.classList.add("success");
    
    toast.classList.add("show");
    
    // Hide toast after delay
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  },
  
  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} text - Text to escape
   * @return {string} Escaped text
   */
  escapeHtml: function(text) {
    if (!text) return "";
    return text.toString()
               .replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
  },
  
  /**
   * Escape special characters in a regular expression
   * @param {string} string - String to escape
   * @return {string} Escaped string for use in RegExp
   */
  escapeRegExp: function(string) {
    if (!string) return "";
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  
  /**
   * Format file size in human-readable format
   * @param {number} bytes - Size in bytes
   * @return {string} Formatted file size (e.g., "2.1 MB")
   */
  formatFileSize: function(bytes) {
    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
};