/**
 * NC File Converter Preview Module
 * Handles file preview with syntax highlighting
 */

NCConverter.Preview = {
  /**
   * DOM element cache
   */
  elements: {},
  
  /**
   * Cached RegExp patterns
   */
  patterns: {},
  
  /**
   * Initialization flag
   */
  initialized: false,
  
  /**
   * Initialize the preview module
   */
  init: function() {
    // Cache DOM references for better performance
    this.elements = {
      originalPreview: document.getElementById("originalPreview"),
      convertedPreview: document.getElementById("convertedPreview")
    };
    
    // Initialize patterns cache
    this.initializePatternCache();
    
    this.initialized = true;
    NCConverter.debugLog("Preview module initialized");
  },
  
  /**
   * Initialize RegExp pattern cache for better performance
   */
  initializePatternCache: function() {
    // Pre-compile some common patterns
    this.patterns = {
      hFunction: null, // Will be created dynamically based on mappings
      spaceNormalize: /\s+/g
    };
  },
  
  /**
   * Get a pattern for H functions
   * @param {Array} mappings - Array of H function mappings
   * @return {RegExp|null} Compiled pattern or null if no mappings
   */
  getHFunctionPattern: function(mappings) {
    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return null;
    }
    
    // Create a key for the pattern based on mappings
    const mappingKey = mappings.map(m => m.from + m.to).join('|');
    
    // Create and cache the pattern if it doesn't exist
    if (!this.patterns['hFunction_' + mappingKey]) {
      // Get only mappings where from != to (changed mappings)
      const changedMappings = mappings.filter(m => m && m.from && m.to && m.from !== m.to);
      
      if (changedMappings.length === 0) {
        return null;
      }
      
      const patternStr = changedMappings.map(mapping => {
        return '\\b' + this.escapeRegExp(mapping.from) + '\\b';
      }).join('|');
      
      this.patterns['hFunction_' + mappingKey] = new RegExp(patternStr, 'g');
    }
    
    return this.patterns['hFunction_' + mappingKey];
  },
  
  /**
   * Get a pattern for highlighting tokens
   * @param {Array} tokens - Array of tokens to highlight
   * @return {RegExp|null} Compiled pattern or null if no tokens
   */
  getTokenPattern: function(tokens) {
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return null;
    }
    
    // Create a key for the pattern based on tokens
    const tokenKey = tokens.join('|');
    
    // Create and cache the pattern if it doesn't exist
    if (!this.patterns['token_' + tokenKey]) {
      const patternStr = "(" + tokens.map(t => this.escapeRegExp(t)).join("|") +
        ")(\\s*)(-?\\d+(?:\\.\\d+)?)";
      
      this.patterns['token_' + tokenKey] = new RegExp(patternStr, 'gi');
    }
    
    return this.patterns['token_' + tokenKey];
  },
  
  /**
   * Update the preview panels with original and converted content
   */
  updatePreview: function() {
    // Get fresh DOM references in case tab content was regenerated
    const originalPreview = document.getElementById("originalPreview");
    const convertedPreview = document.getElementById("convertedPreview");
    
    if (!originalPreview || !convertedPreview) {
      console.error("Preview elements not found in DOM");
      return;
    }
    
    console.log("=== PREVIEW UPDATE DEBUG ===");
    console.log("NCConverter.state:", NCConverter.state);
    console.log("fileContent length:", NCConverter.state.fileContent ? NCConverter.state.fileContent.length : 0);
    console.log("convertedContent length:", NCConverter.state.convertedContent ? NCConverter.state.convertedContent.length : 0);
    
    // Update cached elements with fresh references
    this.elements.originalPreview = originalPreview;
    this.elements.convertedPreview = convertedPreview;
    
    console.log("Preview elements found:", {
      originalPreview: originalPreview,
      convertedPreview: convertedPreview
    });
    
    // Clear any search results when preview content changes
    if (NCConverter.Search && typeof NCConverter.Search.clearSearchHighlights === "function") {
      NCConverter.Search.clearSearchHighlights();
    }
    
    // Update active mappings display
    this.updateActiveMappingsDisplay();
    
    if (!NCConverter.state || !NCConverter.state.fileContent) {
      console.log("No file content available, setting default messages");
      originalPreview.innerHTML = "No file loaded.";
      convertedPreview.innerHTML = "No conversion available.";
      return;
    }
    
    // Start timing for performance measurement
    const startTime = performance.now();
    
    try {
      // Get tokens for highlighting
      let tokens = [];
      if (NCConverter.TokenManager && typeof NCConverter.TokenManager.getTokens === "function") {
        tokens = NCConverter.TokenManager.getTokens();
      } else if (NCConverter.state.settings && NCConverter.state.settings.tokens) {
        tokens = NCConverter.state.settings.tokens;
      }
      
      // Only create document fragments if the file is not too large
      const useDocumentFragments = NCConverter.state.fileContent.length < 500000;
      
      // ---- ORIGINAL CODE PREVIEW ----
      // Use worker for very large files (over 1MB)
      if (NCConverter.state.fileContent.length > 1000000) {
        // For extremely large files, just show without highlighting
        originalPreview.textContent = NCConverter.state.fileContent;
        originalPreview.classList.add('large-file');
        
        // Add a notice
        const notice = document.createElement('div');
        notice.className = 'large-file-notice';
        notice.textContent = 'Large file: syntax highlighting disabled for performance reasons';
        originalPreview.parentNode.insertBefore(notice, originalPreview);
      } else {
        // Normal highlighting for reasonable file sizes
        this.highlightOriginalContent(tokens, useDocumentFragments);
      }
      
      // ---- CONVERTED CODE PREVIEW ----
      if (!NCConverter.state.convertedContent) {
        convertedPreview.innerHTML = "Not converted yet.";
      } else if (NCConverter.state.convertedContent.length > 1000000) {
        // For extremely large files, just show without highlighting
        convertedPreview.textContent = NCConverter.state.convertedContent;
        convertedPreview.classList.add('large-file');
        
        // Add a notice if not already added
        if (!convertedPreview.parentNode.querySelector('.large-file-notice')) {
          const notice = document.createElement('div');
          notice.className = 'large-file-notice';
          notice.textContent = 'Large file: syntax highlighting disabled for performance reasons';
          convertedPreview.parentNode.insertBefore(notice, convertedPreview);
        }
      } else {
        // Normal highlighting for reasonable file sizes
        this.highlightConvertedContent(tokens, useDocumentFragments);
      }
      
      // Log performance
      const endTime = performance.now();
      console.log(`Preview updated in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Trigger scroll sync setup after preview is updated
      if (NCConverter.TabManager && NCConverter.TabManager.setupScrollSyncOnce) {
        setTimeout(() => {
          NCConverter.TabManager.setupScrollSyncOnce();
        }, 100);
      }

    } catch (error) {
      console.error("Error updating preview:", error);
      
      // Fallback to simple text display if highlighting fails
      originalPreview.textContent = NCConverter.state.fileContent;
      
      if (NCConverter.state.convertedContent) {
        convertedPreview.textContent = NCConverter.state.convertedContent;
      } else {
        convertedPreview.textContent = "Not converted yet.";
      }
    }
  },
  
  /**
   * Highlight original content with optimized performance
   * @param {Array} tokens - Tokens to highlight
   * @param {boolean} useDocumentFragments - Whether to use document fragments
   */
  highlightOriginalContent: function(tokens, useDocumentFragments) {
    const { originalPreview } = this.elements;
    
    if (!originalPreview) {
      console.error("originalPreview element not found!");
      return;
    }
    
    // Escape HTML in original content
    let originalText = this.escapeHtml(NCConverter.state.fileContent);
    
    // First highlight H functions that will be changed (in red)
    const hPattern = this.getHFunctionPattern(NCConverter.state.hMapping);
    if (hPattern) {
      originalText = originalText.replace(hPattern, match => {
        return '<span class="highlight-h-function">' + match + '</span>';
      });
    }
    
    // Then highlight tokens (in blue)
    const tokenPattern = this.getTokenPattern(tokens);
    if (tokenPattern) {
      originalText = originalText.replace(tokenPattern, match => {
        return '<span class="highlight-token">' + match + '</span>';
      });
    }
    
    // Update original preview
    if (useDocumentFragments) {
      // Use document fragment for better performance
      const fragment = document.createDocumentFragment();
      const div = document.createElement('div');
      div.innerHTML = originalText;
      
      while (div.firstChild) {
        fragment.appendChild(div.firstChild);
      }
      
      originalPreview.innerHTML = '';
      originalPreview.appendChild(fragment);
    } else {
      // For larger files, just set innerHTML directly
      originalPreview.innerHTML = originalText;
    }
  },
  
  /**
   * Highlight converted content with optimized performance
   * @param {Array} tokens - Tokens to highlight
   * @param {boolean} useDocumentFragments - Whether to use document fragments
   */
  highlightConvertedContent: function(tokens, useDocumentFragments) {
    const { convertedPreview } = this.elements;
    
    if (!convertedPreview) {
      console.error("convertedPreview element not found!");
      return;
    }
    
    // Escape HTML
    let convertedText = this.escapeHtml(NCConverter.state.convertedContent);
    
    // First highlight mapped H functions in converted text
    if (NCConverter.state.hMapping && NCConverter.state.hMapping.length > 0) {
      // Get mappings where from != to (i.e., H functions that were changed)
      const changedMappings = NCConverter.state.hMapping.filter(m => 
        m && m.from && m.to && m.from !== m.to
      );
      
      // For each mapping, highlight all occurrences of the destination H function
      changedMappings.forEach(mapping => {
        const pattern = new RegExp('\\b' + this.escapeRegExp(mapping.to) + '\\b', 'g');
        convertedText = convertedText.replace(pattern, match => {
          return '<span class="highlight-h-function">' + match + '</span>';
        });
      });
    }
    
    // Then highlight converted tokens (in blue)
    const tokenPattern = this.getTokenPattern(tokens);
    if (tokenPattern) {
      convertedText = convertedText.replace(tokenPattern, match => {
        return '<span class="highlight-token">' + match + '</span>';
      });
    }
    
    // Update converted preview
    if (useDocumentFragments) {
      // Use document fragment for better performance
      const fragment = document.createDocumentFragment();
      const div = document.createElement('div');
      div.innerHTML = convertedText;
      
      while (div.firstChild) {
        fragment.appendChild(div.firstChild);
      }
      
      convertedPreview.innerHTML = '';
      convertedPreview.appendChild(fragment);
    } else {
      // For larger files, just set innerHTML directly
      convertedPreview.innerHTML = convertedText;
    }
  },
  
  /**
   * Update the active H mappings display
   */
  updateActiveMappingsDisplay: function() {
    const displayElement = document.getElementById('activeMappingsDisplay');
    
    if (!displayElement) {
      return; // Element doesn't exist yet
    }
    
    // Check if we have any active mappings
    if (!NCConverter.state || !NCConverter.state.hMapping || !Array.isArray(NCConverter.state.hMapping)) {
      displayElement.textContent = '';
      return;
    }
    
    // Filter to only active mappings (where from ≠ to)
    const activeMappings = NCConverter.state.hMapping.filter(mapping => 
      mapping && mapping.from && mapping.to && mapping.from !== mapping.to
    );
    
    if (activeMappings.length === 0) {
      displayElement.textContent = '';
      return;
    }
    
    // Create simple mapping display: "H2→H5, H6→H10"
    const mappingStrings = activeMappings.map(mapping => 
      `${mapping.from}→${mapping.to}`
    );
    
    const displayText = `Active mappings: ${mappingStrings.join(', ')}`;
    
    displayElement.textContent = displayText;
    displayElement.style.color = 'var(--primary-color)';
    displayElement.style.fontWeight = '500';
  },
  
  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @return {string} Escaped HTML
   */
  escapeHtml: function(text) {
    if (!text) return "";
    
    // Use our UIHelpers if available
    if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.escapeHtml === 'function') {
      return NCConverter.UIHelpers.escapeHtml(text);
    }
    
    // Otherwise do it ourselves
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
   * @return {string} Escaped string
   */
  escapeRegExp: function(string) {
    if (!string) return "";
    
    // Use our UIHelpers if available
    if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.escapeRegExp === 'function') {
      return NCConverter.UIHelpers.escapeRegExp(string);
    }
    
    // Otherwise do it ourselves
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
};