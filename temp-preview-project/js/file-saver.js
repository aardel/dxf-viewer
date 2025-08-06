/**
 * NC File Converter File Saver Module
 * Handles saving files to custom paths
 */

NCConverter.FileSaver = {
  /**
   * Initialize the file saver module
   */
  init: function() {
    this.saveConvertedBtn = document.getElementById("saveConvertedBtn");
    
    // Initial state
    if (this.saveConvertedBtn) {
      this.saveConvertedBtn.disabled = true;
      this.saveConvertedBtn.addEventListener("click", this.handleSaveClick.bind(this));
    }
  },
  
  /**
   * Handle save button click
   */
  handleSaveClick: function() {
    if (!NCConverter.state.convertedContent || !NCConverter.state.selectedFile) {
      NCConverter.UIHelpers.showToast("No converted file available to save", "error");
      return;
    }
    
    // Check if we have a directory handle (modern browser with directory picker)
    if (NCConverter.state.directoryHandle) {
      this.saveToSelectedDirectory();
      return;
    }
    
    // Get custom save path from settings (manual path)
    const customPath = NCConverter.state.settings?.customSavePath?.trim();
    
    if (!customPath || customPath.startsWith('[Selected Directory:')) {
      NCConverter.UIHelpers.showToast("Please select a directory using 'Browse' in Settings, or enter a manual path.", "warning");
      return;
    }
    
    // Validate manual path format
    if (!this.isValidPathFormat(customPath)) {
      NCConverter.UIHelpers.showToast("Invalid save path format. Please check your settings.", "error");
      return;
    }
    
    this.saveToCustomPath(customPath);
  },
  
  /**
   * Save file to custom path
   * @param {string} customPath - The custom path to save to
   */
  saveToCustomPath: function(customPath) {
    try {
      // Generate filename
      const filename = this.generateFilename();
      
      // Check if browser supports File System Access API (Chrome/Edge)
      if ('showSaveFilePicker' in window) {
        this.saveWithFileSystemAccess(filename, customPath);
      } else {
        // Fallback for browsers that don't support File System Access API
        this.saveWithFallback(filename, customPath);
      }
    } catch (error) {
      console.error("Error saving file:", error);
      NCConverter.UIHelpers.showToast("Failed to save file: " + error.message, "error");
    }
  },
  
  /**
   * Save file to the selected directory using the directory handle
   */
  saveToSelectedDirectory: async function() {
    try {
      const filename = this.generateFilename();
      const directoryHandle = NCConverter.state.directoryHandle;
      
      if (!directoryHandle) {
        NCConverter.UIHelpers.showToast("No directory selected. Please browse for a directory first.", "error");
        return;
      }
      
      // Create a file in the selected directory
      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
      
      // Create writable stream
      const writable = await fileHandle.createWritable();
      
      // Write content
      await writable.write(NCConverter.state.convertedContent);
      
      // Close the file
      await writable.close();
      
      NCConverter.UIHelpers.showToast(`File saved successfully as ${filename}!`, "success");
      
    } catch (error) {
      console.error("Error saving to selected directory:", error);
      
      // If we get a permission error, try the file picker instead
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        NCConverter.UIHelpers.showToast("Permission denied. Opening save dialog instead...", "warning");
        this.saveToCustomPath("");
      } else {
        NCConverter.UIHelpers.showToast("Failed to save file: " + error.message, "error");
      }
    }
  },
  
  /**
   * Save using File System Access API (Chrome/Edge)
   * @param {string} filename - Name of the file
   * @param {string} customPath - Custom path (used as suggestion)
   */
  saveWithFileSystemAccess: async function(filename, customPath) {
    try {
      const options = {
        suggestedName: filename,
        types: [{
          description: 'NC Files',
          accept: { 
            'text/plain': ['.nc', '.txt', '.din'],
            'application/octet-stream': ['.nc', '.din']
          }
        }]
      };
      
      // If we have a custom path, try to use it as startIn directory (if supported)
      if (customPath && customPath !== "" && !customPath.startsWith('[Selected Directory:')) {
        try {
          // Extract directory from path for startIn hint
          const pathParts = this.parseCustomPath(customPath, filename);
          if (pathParts.directory) {
            // Note: startIn is experimental and may not work on all systems
            options.startIn = 'documents'; // Fallback to documents folder
          }
        } catch (e) {
          // Ignore errors with startIn, it's just a hint
          console.log("Could not set startIn directory, using default");
        }
      }
      
      // Show save dialog
      const fileHandle = await window.showSaveFilePicker(options);
      
      // Create writable stream
      const writable = await fileHandle.createWritable();
      
      // Write content
      await writable.write(NCConverter.state.convertedContent);
      
      // Close the file
      await writable.close();
      
      NCConverter.UIHelpers.showToast(`File saved successfully as ${filename}!`, "success");
      
    } catch (error) {
      if (error.name === 'AbortError') {
        // User cancelled the dialog
        return;
      }
      console.error("File System Access API error:", error);
      NCConverter.UIHelpers.showToast("Failed to save file: " + error.message, "error");
    }
  },
  
  /**
   * Fallback save method for browsers without File System Access API
   * @param {string} filename - Name of the file
   * @param {string} customPath - Custom path (shown in message)
   */
  saveWithFallback: function(filename, customPath) {
    // Create blob and download link
    const blob = new Blob([NCConverter.state.convertedContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    
    // Trigger download
    a.click();
    
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
    
    // Show message about custom path limitation
    const isNetworkPath = this.isNetworkPath(customPath);
    const pathType = isNetworkPath ? "network location" : "folder";
    
    NCConverter.UIHelpers.showToast(
      `File downloaded to your default Downloads folder. Please manually move it to your configured ${pathType}: ${customPath}`, 
      "info"
    );
  },
  
  /**
   * Generate filename for the converted file
   * @returns {string} Generated filename
   */
  generateFilename: function() {
    if (!NCConverter.state.selectedFile) {
      return "converted_file.nc";
    }
    
    const orig = NCConverter.state.selectedFile.name;
    const dotIndex = orig.lastIndexOf(".");
    
    // Determine suffix based on conversion type
    const conversionType = NCConverter.state.settings?.conversionType || "inchToMm";
    let suffix;
    if (conversionType === "keepUnits") {
      suffix = "mod";
    } else {
      suffix = conversionType === "inchToMm" ? "mm" : "inch";
    }
    
    // Append version number
    const version = NCConverter.APP_VERSION ? `_v${NCConverter.APP_VERSION}` : '';
    
    return dotIndex !== -1
      ? orig.substring(0, dotIndex) + "_" + suffix + version + orig.substring(dotIndex)
      : orig + "_" + suffix + version;
  },
  
  /**
   * Parse custom path to extract directory and filename suggestions
   * @param {string} customPath - Custom path from settings
   * @param {string} defaultFilename - Default filename to use
   * @returns {Object} Object with directory and filename
   */
  parseCustomPath: function(customPath, defaultFilename) {
    const isWindows = /^[A-Za-z]:\\/.test(customPath) || /^\\\\/.test(customPath);
    const separator = isWindows ? '\\' : '/';
    
    // If path ends with separator, it's a directory
    if (customPath.endsWith(separator) || customPath.endsWith('/') || customPath.endsWith('\\')) {
      return {
        directory: customPath,
        filename: defaultFilename
      };
    }
    
    // If path contains a file extension, split directory and filename
    const lastSeparatorIndex = Math.max(
      customPath.lastIndexOf('/'),
      customPath.lastIndexOf('\\')
    );
    
    if (lastSeparatorIndex > -1) {
      const directory = customPath.substring(0, lastSeparatorIndex + 1);
      const filename = customPath.substring(lastSeparatorIndex + 1);
      
      // If the filename part has an extension, use it; otherwise use default
      if (filename.includes('.')) {
        return { directory, filename };
      } else {
        return { directory: customPath + separator, filename: defaultFilename };
      }
    }
    
    // Path doesn't contain separators, treat as directory
    return {
      directory: customPath + separator,
      filename: defaultFilename
    };
  },
  
  /**
   * Update save button state
   */
  updateSaveButton: function() {
    if (!this.saveConvertedBtn) return;
    
    const hasContent = NCConverter.state.convertedContent && NCConverter.state.convertedContent.length > 0;
    const hasDirectoryHandle = NCConverter.state.directoryHandle;
    const hasManualPath = NCConverter.state.settings?.customSavePath?.trim() && 
                          !NCConverter.state.settings.customSavePath.startsWith('[Selected Directory:');
    
    // Enable button if we have content AND (directory handle OR manual path)
    const canSave = hasContent && (hasDirectoryHandle || hasManualPath);
    this.saveConvertedBtn.disabled = !canSave;
    
    // Update tooltip/title based on state
    if (!hasContent) {
      this.saveConvertedBtn.title = "No converted content available";
    } else if (hasDirectoryHandle) {
      this.saveConvertedBtn.title = "Save to selected directory";
    } else if (hasManualPath) {
      this.saveConvertedBtn.title = `Save to: ${NCConverter.state.settings.customSavePath}`;
    } else {
      this.saveConvertedBtn.title = "Select a directory in Settings first";
    }
  },
  
  /**
   * Check if path format is valid
   * @param {string} path - Path to validate
   * @returns {boolean} True if format is valid
   */
  isValidPathFormat: function(path) {
    if (!path || typeof path !== "string") return false;
    
    // Windows absolute path (C:\folder or \\server\share)
    if (/^[A-Za-z]:\\/.test(path) || /^\\\\/.test(path)) return true;
    
    // Unix/macOS absolute path (/folder)
    if (/^\//.test(path)) return true;
    
    // Relative paths are also valid
    if (/^\./.test(path)) return true;
    
    return false;
  },
  
  /**
   * Check if path is a network path
   * @param {string} path - Path to check
   * @returns {boolean} True if it's a network path
   */
  isNetworkPath: function(path) {
    if (!path) return false;
    
    // Windows UNC path (\\server\share)
    if (/^\\\\/.test(path)) return true;
    
    // Could also check for mapped drives, but that's harder to detect
    return false;
  }
};
