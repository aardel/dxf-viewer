/**
 * NC File Converter File Handler Module
 * Handles file selection, reading, and unit detection
 */

NCConverter.FileHandler = {
  /**
   * Initialize the file handler module
   */
  init: function() {
    // Get DOM elements
    this.fileArea = document.getElementById("fileArea");
    this.fileInput = document.getElementById("fileInput");
    this.fileInfo = document.getElementById("fileInfo");
    this.fileName = document.getElementById("fileName");
    this.fileSize = document.getElementById("fileSize");
    this.detectedUnit = document.getElementById("detectedUnit");
    
    // Check if all required elements exist
    if (!this.fileArea || !this.fileInput) {
      console.error("File area or input not found");
      return;
    }
    
    // Clear existing listeners and set up event listeners
    this.setupEventListeners();
    
    // Mark as initialized
    this.initialized = true;
  },
  
  /**
   * Set up event listeners for file area and input
   */
  setupEventListeners: function() {
    try {
      // Clone elements to clear existing event listeners
      const newFileArea = this.fileArea.cloneNode(true);
      if (this.fileArea.parentNode) {
        this.fileArea.parentNode.replaceChild(newFileArea, this.fileArea);
        this.fileArea = newFileArea;
      }
      
      // Get the new file input (since we cloned the parent)
      this.fileInput = document.getElementById("fileInput");
      if (!this.fileInput) {
        console.error("File input not found after cloning");
        return;
      }
      
      // Click on file area opens file dialog
      this.fileArea.addEventListener("click", () => {
        this.fileInput.click();
      });
      
      // Drag and drop support
      this.fileArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.fileArea.classList.add("hover");
        e.dataTransfer.dropEffect = "copy";
      });
      
      this.fileArea.addEventListener("dragleave", (e) => {
        e.preventDefault();
        this.fileArea.classList.remove("hover");
      });
      
      this.fileArea.addEventListener("drop", (e) => {
        e.preventDefault();
        this.fileArea.classList.remove("hover");
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          // Check if file is a valid NC file
          const file = e.dataTransfer.files[0];
          const ext = file.name.split('.').pop().toLowerCase();
          
          // Add .din and .rot to accepted file types
          if (!['nc', 'txt', 'g', 'gcode', 'cnc', 'tap', 'mpf', 'din', 'rot'].includes(ext)) {
            this.showError(`File type .${ext} is not supported. Please use .nc, .txt, .din, .rot, etc.`);
            return;
          }
          
          NCConverter.state.selectedFile = file;
          this.handleFileSelection();
          
          // Log success to console for debugging
          console.log("File drop successful:", NCConverter.state.selectedFile.name);
        }
      });
      
      // File input change event
      this.fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          // Check if file is a valid NC file
          const file = e.target.files[0];
          const ext = file.name.split('.').pop().toLowerCase();
          
          // Add .din and .rot to accepted file types
          if (!['nc', 'txt', 'g', 'gcode', 'cnc', 'tap', 'mpf', 'din', 'rot'].includes(ext)) {
            this.showError(`File type .${ext} is not supported. Please use .nc, .txt, .din, .rot, etc.`);
            return;
          }
          
          NCConverter.state.selectedFile = file;
          this.handleFileSelection();
          
          // Log success to console for debugging
          console.log("File selection successful:", NCConverter.state.selectedFile.name);
        }
      });
      
      console.log("File handler event listeners set up successfully");
    } catch (error) {
      console.error("Error setting up file handler event listeners:", error);
    }
  },
  
  /**
   * Handle file selection and update UI
   */
  handleFileSelection: function() {
    const selectedFile = NCConverter.state.selectedFile;
    if (!selectedFile) {
      console.error("No file selected");
      return;
    }
    
    // Update UI with file info
    this.updateFileInfo(selectedFile);
    
    // Read file content
    this.readFile();
  },
  
  /**
   * Update UI with file information
   * @param {File} file - The selected file
   */
  updateFileInfo: function(file) {
    if (!this.fileName || !this.fileSize || !this.fileInfo) {
      console.error("File info elements not found");
      return;
    }
    
    this.fileName.textContent = file.name;
    
    // Format file size
    let size = file.size;
    let unit = "bytes";
    if (size > 1024) { size = (size / 1024).toFixed(1); unit = "KB"; }
    if (size > 1024) { size = (size / 1024).toFixed(1); unit = "MB"; }
    this.fileSize.textContent = `${size} ${unit}`;
    
    // Show file info panel
    this.fileInfo.style.display = "block";
  },
  
  /**
   * Read the selected file and process its content
   */
  readFile: function() {
    const selectedFile = NCConverter.state.selectedFile;
    if (!selectedFile) {
      console.error("No file to read");
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      // Store file content and info
      NCConverter.state.fileContent = e.target.result;
      NCConverter.state.selectedFile = selectedFile;
      
      console.log("File loaded successfully:");
      console.log("- File name:", selectedFile.name);
      console.log("- File size:", selectedFile.size, "bytes");
      console.log("- Content length:", NCConverter.state.fileContent.length, "characters");
      console.log("- Content preview:", NCConverter.state.fileContent.substring(0, 200));
      
      // Update file info display
      this.updateFileInfo(selectedFile);
      
      // Show success message
      if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === "function") {
        NCConverter.UIHelpers.showToast("File loaded successfully", "success");
      }
      
      // Detect units and update UI
      if (this.detectedUnit) {
        this.detectedUnit.textContent = this.detectUnits(NCConverter.state.fileContent);
      }
      
      try {
        // Run conversion based on detected units
        if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === "function") {
          NCConverter.Conversion.updateConversion();
          console.log("Conversion triggered successfully");
        } else {
          console.error("Conversion module not available");
          this.showError("Conversion module not available");
        }
        
        // Update H mapping UI if available
        if (NCConverter.HFunctions && typeof NCConverter.HFunctions.updateHMappingUI === "function") {
          NCConverter.HFunctions.updateHMappingUI();
        }
        
        // Force tab-specific content to update
        if (NCConverter.TabManager && typeof NCConverter.TabManager.initializeTabContent === "function") {
          const activeTab = document.querySelector('.tab-header.active');
          if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab');
            if (tabId) {
              NCConverter.TabManager.initializeTabContent(tabId);
            }
          }
        }
      } catch (error) {
        console.error("Conversion error:", error);
        this.showError("Conversion error: " + error.message);
      }
    };
    
    reader.onerror = (error) => {
      console.error("File reading error:", error);
      this.showError("Error reading file");
    };
    
    reader.readAsText(selectedFile);
  },
  
  /**
   * Show an error message
   * @param {string} message - Error message to display
   */
  showError: function(message) {
    if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === "function") {
      NCConverter.UIHelpers.showToast(message, "error");
    } else {
      alert(message);
    }
  },
  
  /**
   * Detect units (mm or inches) from file content
   * @param {string} content - File content
   * @return {string} Detected units description
   */
  detectUnits: function(content) {
    if (!content) {
      return "Unknown (No content)";
    }
    
    // Check for explicit G-code unit indicators
    const lower = content.toLowerCase();
    
    if (/g20\b/.test(lower)) {
      const radioBtn = document.getElementById("inchToMm");
      if (radioBtn) radioBtn.checked = true;
      return "Inches (G20 found)";
    }
    
    if (/g21\b/.test(lower)) {
      const radioBtn = document.getElementById("mmToInch");
      if (radioBtn) radioBtn.checked = true;
      return "Millimeters (G21 found)";
    }
    
    // Fall back to analyzing coordinate values
    const matches = content.match(/[XY]\s*-?\d+\.?\d*/g) || [];
    const vals = matches.map(m => parseFloat(m.replace(/[XY]\s*/, "")));
    
    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      
      if (avg < 30) {
        const radioBtn = document.getElementById("inchToMm");
        if (radioBtn) radioBtn.checked = true;
        return "Likely Inches (based on values)";
      } else {
        const radioBtn = document.getElementById("mmToInch");
        if (radioBtn) radioBtn.checked = true;
        return "Likely Millimeters (based on values)";
      }
    }
    
    return "Unknown (No coordinates found)";
  }
};
