/**
 * NC File Converter Conversion Module
 * Handles unit conversion between mm and inches
 */

NCConverter.Conversion = {
  /**
   * Cached RegExp patterns for better performance
   */
  tokenPatterns: {},
  
  /**
   * Initialized flag
   */
  initialized: false,
  
  /**
   * Initialize the conversion module
   */
  init: function() {
    NCConverter.debugLog("Conversion module initializing");
    
    // Cache UI elements
    this.elements = {
      mmPrecision: document.getElementById("mmPrecision"),
      inchPrecision: document.getElementById("inchPrecision"),
      preserveNewlines: document.getElementById("preserveNewlines"),
      normalizeSpacing: document.getElementById("normalizeSpacing"),
      conversionTypes: document.querySelectorAll('input[name="conversionType"]')
    };
    
    // Only set up event listeners if elements exist
    if (this.elements.mmPrecision) {
      this.elements.mmPrecision.addEventListener("change", this.handleSettingChange.bind(this));
    }
    
    if (this.elements.inchPrecision) {
      this.elements.inchPrecision.addEventListener("change", this.handleSettingChange.bind(this));
    }
    
    if (this.elements.preserveNewlines) {
      this.elements.preserveNewlines.addEventListener("change", this.handleSettingChange.bind(this));
    }
    
    if (this.elements.normalizeSpacing) {
      this.elements.normalizeSpacing.addEventListener("change", this.handleSettingChange.bind(this));
    }
    
    // Radio button listeners
    if (this.elements.conversionTypes) {
      this.elements.conversionTypes.forEach(el => {
        el.addEventListener("change", this.handleSettingChange.bind(this));
      });
    }
    
    this.initialized = true;
    NCConverter.debugLog("Conversion module initialized");
  },
  
  /**
   * Handle setting change events
   */
  handleSettingChange: function() {
    NCConverter.debugLog("Conversion settings changed");
    
    // If we have file content, run conversion again
    if (NCConverter.state && NCConverter.state.fileContent) {
      this.updateConversion();
    }
  },
  
  /**
   * Get a cached RegExp pattern or create a new one
   * @param {Array} tokens - Array of tokens to match
   * @param {string} operation - Operation identifier for caching
   * @return {RegExp} Compiled regular expression
   */
  getTokenPattern: function(tokens, operation) {
    // Create a unique key based on tokens and operation
    const patternKey = tokens.join('_') + '_' + operation;
    
    // Return cached pattern if available
    if (this.tokenPatterns[patternKey]) {
      return this.tokenPatterns[patternKey];
    }
    
    // Create a new pattern - Updated to handle decimal numbers starting with dot
    const pattern = new RegExp(
      "(" + tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
      ")(\\s*)(-?(?:\\d*\\.\\d+|\\d+))", "gi"
    );
    
    // Cache for future use
    this.tokenPatterns[patternKey] = pattern;
    
    return pattern;
  },
  
  /**
   * Convert inches to millimeters
   * @param {string} content - File content to convert
   * @param {Array} tokens - Array of tokens to look for
   * @param {number} precision - Decimal precision for results
   * @return {string} Converted content
   */
  inchToMm: function(content, tokens, precision) {
    if (!content || !tokens || tokens.length === 0) {
      console.warn("No content or tokens provided for conversion");
      return content; // No conversion if no tokens
    }
    
    try {
      // Get or create pattern
      const pattern = this.getTokenPattern(tokens, 'inchToMm');
      
      let result = content.replace(pattern, (match, token, space, num) => {
        let val = parseFloat(num);
        return token + space + (val * 25.4).toFixed(precision);
      });
      
      if (this.elements.normalizeSpacing && this.elements.normalizeSpacing.checked) {
        result = this.normalizeSpacing(result);
      }
      
      return result;
    } catch (error) {
      console.error("Error in inchToMm conversion:", error);
      this.showErrorMessage("Error in inchToMm conversion: " + error.message);
      return content; // Return original content on error
    }
  },
  
  /**
   * Convert millimeters to inches
   * @param {string} content - File content to convert
   * @param {Array} tokens - Array of tokens to look for
   * @param {number} precision - Decimal precision for results
   * @return {string} Converted content
   */
  mmToInch: function(content, tokens, precision) {
    if (!content || !tokens || tokens.length === 0) {
      console.warn("No content or tokens provided for conversion");
      return content; // No conversion if no tokens
    }
    
    try {
      // Get or create pattern
      const pattern = this.getTokenPattern(tokens, 'mmToInch');
      
      let result = content.replace(pattern, (match, token, space, num) => {
        let val = parseFloat(num);
        return token + space + (val / 25.4).toFixed(precision);
      });
      
      if (this.elements.normalizeSpacing && this.elements.normalizeSpacing.checked) {
        result = this.normalizeSpacing(result);
      }
      
      return result;
    } catch (error) {
      console.error("Error in mmToInch conversion:", error);
      this.showErrorMessage("Error in mmToInch conversion: " + error.message);
      return content; // Return original content on error
    }
  },
  
  /**
   * Normalize spacing between tokens and values
   * @param {string} content - Content to normalize
   * @return {string} Normalized content
   */
  normalizeSpacing: function(content) {
    // Remove extra spaces between token and value
    return content.replace(/([A-Z])\s+(-?\d+(?:\.\d+)?)/gi, "$1$2");
  },
  
  /**
   * Apply H function mappings to content (temp file approach)
   * @param {string} content - Content to apply mappings to
   * @return {string} Content with H mappings applied
   *
   * This implementation:
   * 1. Creates a temp file (copy of original)
   * 2. Searches in the ORIGINAL file (never modified) for line numbers
   * 3. Applies changes to the TEMP file at those exact line numbers
   * 4. Returns the temp file as the final result
   */
  applyHMapping: function(content) {
    if (!content || !NCConverter.state || !NCConverter.state.hMapping || 
        !Array.isArray(NCConverter.state.hMapping) || NCConverter.state.hMapping.length === 0) {
      console.log("No H mappings to apply:", {
        hasContent: !!content,
        hasState: !!NCConverter.state,
        hasMapping: !!(NCConverter.state && NCConverter.state.hMapping),
        mappingLength: NCConverter.state?.hMapping?.length || 0
      });
      return content;
    }
    
    try {
      console.log("=== H MAPPING APPLICATION DEBUG ===");
      console.log("Original mappings:", NCConverter.state.hMapping);
      console.log("Content length:", content.length);
      console.log("Content preview (first 200 chars):", content.substring(0, 200));
      
      // Filter to only mappings that actually change something
      const activeMappings = NCConverter.state.hMapping.filter(map => 
        map && map.from && map.to && map.from !== map.to
      );
      
      console.log("Active mappings (from ≠ to):", activeMappings);
      
      if (activeMappings.length === 0) {
        console.log("No active mappings found, returning content unchanged");
        return content;
      }
      
      // Split original content into lines (this is our reference, never modified)
      const originalLines = content.split('\n');
      // Create temp file (this is what we modify)
      const tempLines = [...originalLines];
      
      console.log("Total lines in file:", originalLines.length);
      
      let totalReplacements = 0;
      
      // Process each mapping
      activeMappings.forEach((map, mapIndex) => {
        console.log(`\n--- Processing mapping ${mapIndex + 1}: ${map.from} → ${map.to} ---`);
        
        const fromPattern = new RegExp('\\b' + this.escapeRegExp(map.from) + '\\b', 'gi');
        
        // Search in ORIGINAL file for line numbers (never modified)
        const targetLineNumbers = [];
        originalLines.forEach((line, lineIndex) => {
          if (fromPattern.test(line)) {
            targetLineNumbers.push(lineIndex);
            console.log(`Found ${map.from} on line ${lineIndex + 1}: "${line.trim()}"`);
          }
        });
        
        console.log(`Found ${targetLineNumbers.length} occurrences of ${map.from}`);
        
        // Apply changes to TEMP file at those exact line numbers
        let replacementsThisMapping = 0;
        targetLineNumbers.forEach(lineIndex => {
          if (tempLines[lineIndex]) {
            const before = tempLines[lineIndex];
            // Reset the regex for each line
            const replacePattern = new RegExp('\\b' + this.escapeRegExp(map.from) + '\\b', 'gi');
            tempLines[lineIndex] = tempLines[lineIndex].replace(replacePattern, map.to);
            const after = tempLines[lineIndex];
            
            if (before !== after) {
              replacementsThisMapping++;
              console.log(`Line ${lineIndex + 1}: "${before.trim()}" → "${after.trim()}"`);
            }
          }
        });
        
        totalReplacements += replacementsThisMapping;
        console.log(`Mapping ${map.from} → ${map.to}: ${replacementsThisMapping} replacements made`);
      });
      
      console.log(`\n=== MAPPING SUMMARY ===`);
      console.log(`Total replacements made: ${totalReplacements}`);
      
      const result = tempLines.join('\n');
      console.log("Final content preview (first 200 chars):", result.substring(0, 200));
      console.log("=== H MAPPING APPLICATION COMPLETE ===");
      
      return result;
    } catch (error) {
      console.error("Error applying H mappings:", error);
      console.error("Stack trace:", error.stack);
      this.showErrorMessage("Error applying H mappings: " + error.message);
      return content; // Return original on error
    }
  },
  
  /**
   * Escape special characters in a regular expression
   * @param {string} string - String to escape
   * @return {string} Escaped string
   */
  escapeRegExp: function(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  
  /**
   * Get tokens from the token manager or fall back to defaults
   * @return {Array} Array of tokens
   */
  getTokens: function() {
    // Get tokens from the TokenManager if available
    if (NCConverter.TokenManager && typeof NCConverter.TokenManager.getTokens === "function") {
      return NCConverter.TokenManager.getTokens();
    } else if (NCConverter.state && NCConverter.state.settings && NCConverter.state.settings.tokens) {
      return NCConverter.state.settings.tokens;
    } else {
      console.warn("Using default tokens for conversion");
      return ["X", "Y", "I", "J", "R", "Radius:", "CylDia:", "GROESSE:"];
    }
  },
  
  /**
   * Get the current conversion type from UI
   * @return {string} Conversion type
   */
  getConversionType: function() {
    const conversionTypeElement = document.querySelector('input[name="conversionType"]:checked');
    if (conversionTypeElement) {
      return conversionTypeElement.value;
    }
    return "autoDetect"; // Default
  },
  
  /**
   * Detect units from file content
   * @param {string} content - File content
   * @return {string} Unit type ('inch' or 'mm')
   */
  detectUnits: function(content) {
    if (!content) return "unknown";
    
    // Look for explicit G-codes
    const lower = content.toLowerCase();
    
    if (/g20\b/.test(lower)) {
      return "inch"; // G20 = Inch
    }
    
    if (/g21\b/.test(lower)) {
      return "mm"; // G21 = mm
    }
    
    // Analyze coordinate values to guess
    const matches = content.match(/[XY]\s*-?\d+\.?\d*/g) || [];
    if (matches.length === 0) return "unknown";
    
    const values = matches.map(m => parseFloat(m.replace(/[XY]\s*/, "")));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Values below 30 are likely inches, above are likely mm
    return avg < 30 ? "inch" : "mm";
  },
  
  /**
   * Insert inch header if missing and setting is enabled
   * @param {string} content - File content
   * @returns {string} Modified content with header if needed
   */
  insertInchHeaderIfNeeded: function(content) {
    const settings = NCConverter.state.settings || {};
    if (!settings.autoInchHeader) return content;
    // Normalize line endings
    let fileContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = fileContent.split('\n');
    // Trim all lines for matching
    const trimmedLines = lines.map(line => line.trim());
    const hasHeader1 = trimmedLines.includes(':P2027=25.4/P674');
    const hasHeader2 = trimmedLines.includes('G75 X=P2027 Y=P2027');
    const percentIdx = trimmedLines.findIndex(line => line === '%1');
    console.log('Header check (batch/single):', { hasHeader1, hasHeader2, percentIdx, lines: trimmedLines.slice(0, 10) });
    if ((!hasHeader1 || !hasHeader2) && percentIdx !== -1) {
      let insertIdx = percentIdx + 1;
      if (!hasHeader1) {
        lines.splice(insertIdx, 0, ':P2027=25.4/P674');
        insertIdx++;
      }
      if (!hasHeader2) {
        lines.splice(insertIdx, 0, 'G75 X=P2027 Y=P2027');
      }
      fileContent = lines.join('\n');
      console.log('Inserted inch header after %1 (batch/single):', fileContent.substring(0, 300));
    }
    return fileContent;
  },
  
  /**
   * Update the conversion based on current settings
   * @param {boolean} redetectH - Whether to redetect H functions after conversion
   */
  updateConversion: function(redetectH = false) {
    console.log("=== CONVERSION DEBUG ===");
    console.log("Running updateConversion, redetectH:", redetectH);
    
    if (!NCConverter.state) {
      console.error("NCConverter.state is not defined");
      return;
    }
    
    if (!NCConverter.state.fileContent) {
      console.log("No file content to convert");
      console.log("NCConverter.state.fileContent:", NCConverter.state.fileContent);
      return;
    }
    
    console.log("File content available, length:", NCConverter.state.fileContent.length);
    
    // Auto insert inch header if setting is enabled
    let fileContent = this.insertInchHeaderIfNeeded(NCConverter.state.fileContent);
    
    // Get tokens
    const tokens = this.getTokens();
    console.log("Tokens:", tokens);
    
    if (tokens.length === 0) {
      this.showErrorMessage("No tokens defined. Please add tokens in the Settings tab.");
      NCConverter.state.convertedContent = NCConverter.state.fileContent; // Just copy original content
      if (NCConverter.Preview && typeof NCConverter.Preview.updatePreview === "function") {
        NCConverter.Preview.updatePreview();
      }
      return;
    }
    
    // Get selected conversion type
    const conversionType = this.getConversionType();
    console.log("Selected conversion type:", conversionType);

    // Get precision settings
    const mmPrecisionElement = document.getElementById("mmPrecision");
    const inchPrecisionElement = document.getElementById("inchPrecision");

    if (!mmPrecisionElement || !inchPrecisionElement) {
      console.error("Precision elements not found");
      return;
    }

    const mmPrec = parseInt(mmPrecisionElement.value) || 3;
    const inchPrec = parseInt(inchPrecisionElement.value) || 4;

    try {
      // Start timing for performance measurement
      const startTime = performance.now();

      // Determine conversion direction based on setting or auto-detection
      if (conversionType === "autoDetect") {
        const detectedUnitElement = document.getElementById("detectedUnit");
        
        if (!detectedUnitElement) {
          console.error("detectedUnit element not found");
          return;
        }
        
        const detected = detectedUnitElement.textContent;
        
        if (detected.includes("Inch")) {
          NCConverter.state.convertedContent = this.inchToMm(fileContent, tokens, mmPrec);
          NCConverter.state.finalUnits = "mm";
          if (NCConverter.Export && typeof NCConverter.Export.createDownloadLink === "function") {
            NCConverter.Export.createDownloadLink("inchToMm");
          }
        } else if (detected.includes("Millimeter")) {
          NCConverter.state.convertedContent = this.mmToInch(fileContent, tokens, inchPrec);
          NCConverter.state.finalUnits = "inches";
          if (NCConverter.Export && typeof NCConverter.Export.createDownloadLink === "function") {
            NCConverter.Export.createDownloadLink("mmToInch");
          }
        } else {
          this.showErrorMessage("Cannot auto-detect units. Please select a conversion direction.");
          return;
        }
      } else if (conversionType === "inchToMm") {
        NCConverter.state.convertedContent = this.inchToMm(fileContent, tokens, mmPrec);
        NCConverter.state.finalUnits = "mm";
        if (NCConverter.Export && typeof NCConverter.Export.createDownloadLink === "function") {
          NCConverter.Export.createDownloadLink("inchToMm");
        }
      } else if (conversionType === "mmToInch") {
        NCConverter.state.convertedContent = this.mmToInch(fileContent, tokens, inchPrec);
        NCConverter.state.finalUnits = "inches";
        if (NCConverter.Export && typeof NCConverter.Export.createDownloadLink === "function") {
          NCConverter.Export.createDownloadLink("mmToInch");
        }
      } else if (conversionType === "keepUnits") {
        // No unit conversion, just process other options
        let result = fileContent;
        if (this.elements.normalizeSpacing && this.elements.normalizeSpacing.checked) {
          result = this.normalizeSpacing(result);
        }
        NCConverter.state.convertedContent = result;
        // Set finalUnits to detected or original units
        const detectedUnitElement = document.getElementById("detectedUnit");
        if (detectedUnitElement && detectedUnitElement.textContent) {
          NCConverter.state.finalUnits = detectedUnitElement.textContent;
        } else {
          NCConverter.state.finalUnits = "unknown";
        }
        if (NCConverter.Export && typeof NCConverter.Export.createDownloadLink === "function") {
          NCConverter.Export.createDownloadLink("keepUnits");
        }
      }
      
      // Ensure we have content
      if (!NCConverter.state.convertedContent) { 
        NCConverter.state.convertedContent = NCConverter.state.fileContent; 
      }
      
      // Apply H function mappings to ORIGINAL content, then do unit conversion
      let contentForConversion = fileContent;
      if (NCConverter.state.hMapping && NCConverter.state.hMapping.length > 0) {
        console.log("Applying H mappings to ORIGINAL content before conversion");
        contentForConversion = this.applyHMapping(fileContent);
      }
      
      // Now re-do the conversion with H-mapped content
      if (conversionType === "autoDetect") {
        const detectedUnitElement = document.getElementById("detectedUnit");
        if (!detectedUnitElement) {
          console.error("detectedUnit element not found");
          return;
        }
        
        const detected = detectedUnitElement.textContent;
        
        if (detected.includes("Inch")) {
          NCConverter.state.convertedContent = this.inchToMm(contentForConversion, tokens, mmPrec);
        } else if (detected.includes("Millimeter")) {
          NCConverter.state.convertedContent = this.mmToInch(contentForConversion, tokens, inchPrec);
        }
      } else if (conversionType === "inchToMm") {
        NCConverter.state.convertedContent = this.inchToMm(contentForConversion, tokens, mmPrec);
      } else if (conversionType === "mmToInch") {
        NCConverter.state.convertedContent = this.mmToInch(contentForConversion, tokens, inchPrec);
      } else if (conversionType === "keepUnits") {
        // No unit conversion, just process other options
        let result = contentForConversion;
        if (this.elements.normalizeSpacing && this.elements.normalizeSpacing.checked) {
          result = this.normalizeSpacing(result);
        }
        NCConverter.state.convertedContent = result;
      }
      
      // End timing and log performance
      const endTime = performance.now();
      console.log(`Conversion completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Check if we should re-detect H numbers
      const autoRedetectElement = document.getElementById("autoRedetectH");
      const autoRedetectEnabled = autoRedetectElement ? 
                               autoRedetectElement.checked : 
                               (NCConverter.state.settings && NCConverter.state.settings.autoRedetectH !== false);
                                  
      if (redetectH && autoRedetectEnabled && NCConverter.HFunctions) {
        if (typeof NCConverter.HFunctions.updateHMappingFromFile === "function") {
          NCConverter.HFunctions.updateHMappingFromFile(true); // true = use convertedContent
        }
        if (typeof NCConverter.HFunctions.updateHMappingUI === "function") {
          NCConverter.HFunctions.updateHMappingUI();
        }
      }
      
      // Update Settings
      if (NCConverter.Settings && typeof NCConverter.Settings.updateStoredSettings === "function") {
        NCConverter.Settings.updateStoredSettings();
      }
      
      // Update preview if available
      if (NCConverter.Preview && typeof NCConverter.Preview.updatePreview === "function") {
        NCConverter.Preview.updatePreview();
      }
      
      // Update export button if available
      if (NCConverter.Export && typeof NCConverter.Export.updateExportButton === "function") {
        NCConverter.Export.updateExportButton();
      }
      
      // Clear any search results when content changes
      if (NCConverter.Search && typeof NCConverter.Search.clearSearchHighlights === "function") {
        NCConverter.Search.clearSearchHighlights();
      }
      
      // Enable download button
      const downloadConvertedBtn = document.getElementById("downloadConvertedBtn");
      if (downloadConvertedBtn) {
        downloadConvertedBtn.disabled = false;
      }
      
      // Update save button state
      if (NCConverter.FileSaver && typeof NCConverter.FileSaver.updateSaveButton === "function") {
        NCConverter.FileSaver.updateSaveButton();
      }
      
      // Show success notification
      if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === "function") {
        NCConverter.UIHelpers.showToast("Conversion complete!", "success");
      }
      
      // Debug: Log the first 500 characters of the converted content
      console.log('[DEBUG] Final convertedContent preview:', (NCConverter.state.convertedContent || '').substring(0, 500));
      
      console.log("Conversion completed successfully");
    } catch (error) {
      console.error("Conversion error:", error);
      this.showErrorMessage("Conversion error: " + error.message);
    }
  }
};