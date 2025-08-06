/**
 * NC File Converter H Functions Module
 * Handles H function definitions and mappings
 */

NCConverter.HFunctions = {
  /**
   * DOM element cache
   */
  elements: {},
  
  /**
   * Initialization flag
   */
  initialized: false,
  
  /**
   * Initialize the H functions module
   */
  init: function() {
    NCConverter.debugLog("HFunctions initializing");
    
    // Initialize state
    if (!NCConverter.state) {
      console.error("State not initialized");
      return;
    }
    
    NCConverter.state.hMapping = this.loadHMapping();
    
    // Cache DOM references
    this.elements = {
      detectHBtn: document.getElementById("detectHBtn"),
      hMappingContainer: document.getElementById("hMappingContainer"),
      resetHMappingBtn: document.getElementById("resetHMappingBtn"),
      hMappingItemTemplate: document.getElementById("hMappingItemTemplate"),
      hFunctionsList: document.getElementById("hFunctionsList"),
      newHNumber: document.getElementById("newHNumber"),
      newHName: document.getElementById("newHName"),
      addHFunctionBtn: document.getElementById("addHFunctionBtn"),
      editHFunctionSection: document.getElementById("editHFunctionSection"),
      editHNumber: document.getElementById("editHNumber"),
      editHName: document.getElementById("editHName"),
      saveHFunctionBtn: document.getElementById("saveHFunctionBtn"),
      cancelEditHFunctionBtn: document.getElementById("cancelEditHFunctionBtn"),
      resetHFunctionsBtn: document.getElementById("resetHFunctionsBtn"),
      hFunctionDefItemTemplate: document.getElementById("hFunctionDefItemTemplate"),
      autoRedetectContainer: document.getElementById("autoRedetectContainer")
    };
    
    // Initialize H functions list
    this.initializeHFunctionsList();
    
    // Update H mapping UI
    this.updateHMappingUI();
    
    // Add the auto-redetect option - only if it doesn't exist
    if (!this.elements.autoRedetectContainer) {
      this.addAutoRedetectOption();
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.initialized = true;
    NCConverter.debugLog("HFunctions initialized");
  },
  
  /**
   * Set up event listeners for H functions
   */
  setupEventListeners: function() {
    const { detectHBtn, resetHMappingBtn, addHFunctionBtn, saveHFunctionBtn, 
           cancelEditHFunctionBtn, resetHFunctionsBtn, newHName } = this.elements;
    
    // H number detection button
    if (detectHBtn) {
      detectHBtn.addEventListener("click", () => {
        // Always detect from converted file if available
        this.updateHMappingFromFile(NCConverter.state.convertedContent ? true : false);
        this.updateHMappingUI();
        this.showToast("H numbers detected and mappings updated", "success");
      });
    }
    
    // Reset H mappings button
    if (resetHMappingBtn) {
      resetHMappingBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to reset all H function mappings?")) {
          NCConverter.state.hMapping = [];
          this.saveHMapping(NCConverter.state.hMapping);
          this.updateHMappingUI();
          
          // Update conversion if available
          if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === "function") {
            NCConverter.Conversion.updateConversion();
          }
          
          // Update active mappings display in preview
          if (NCConverter.Preview && typeof NCConverter.Preview.updateActiveMappingsDisplay === "function") {
            NCConverter.Preview.updateActiveMappingsDisplay();
          }
          
          this.showToast("H mappings have been reset", "success");
        }
      });
    }
    
    // H function definition management
    if (addHFunctionBtn) {
      addHFunctionBtn.addEventListener("click", this.addNewHFunction.bind(this));
      
      // Allow pressing Enter to add H function
      if (newHName) {
        newHName.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.addNewHFunction();
          }
        });
      }
    }
    
    if (saveHFunctionBtn) {
      saveHFunctionBtn.addEventListener("click", this.saveHFunctionEdit.bind(this));
    }
    
    if (cancelEditHFunctionBtn) {
      cancelEditHFunctionBtn.addEventListener("click", this.exitHFunctionEditMode.bind(this));
    }
    
    if (resetHFunctionsBtn) {
      resetHFunctionsBtn.addEventListener("click", this.resetHFunctions.bind(this));
    }
  },
  
  /**
   * Load H function mappings from localStorage
   * @return {Array} Array of H function mappings
   */
  loadHMapping: function() {
    const stored = localStorage.getItem(NCConverter.HMAPPING_KEY);
    if (stored) {
      try { 
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { 
        console.error("Error parsing H mappings:", e);
        return []; 
      }
    }
    return [];
  },
  
  /**
   * Save H function mappings to localStorage
   * @param {Array} mapping - Array of H function mappings
   */
  saveHMapping: function(mapping) {
    try {
      localStorage.setItem(NCConverter.HMAPPING_KEY, JSON.stringify(mapping));
    } catch (e) {
      console.error("Error saving H mappings:", e);
      this.showToast("Failed to save H mappings", "error");
    }
  },
  
  /**
   * Initialize the H functions list from settings
   */
  initializeHFunctionsList: function() {
    const { hFunctionsList } = this.elements;
    if (!hFunctionsList) return;
    
    // Clear the list
    hFunctionsList.innerHTML = "";
    
    if (!NCConverter.state || !NCConverter.state.settings) {
      console.warn("Settings not initialized");
      return;
    }
    
    // Make sure H functions object exists in settings
    if (!NCConverter.state.settings.hFunctions || typeof NCConverter.state.settings.hFunctions !== 'object') {
      NCConverter.state.settings.hFunctions = {...NCConverter.DEFAULT_H_FUNCTIONS};
      NCConverter.Settings.saveSettings(NCConverter.state.settings);
    }
    
    // Get all H functions and sort them numerically
    const hFunctionEntries = Object.entries(NCConverter.state.settings.hFunctions)
      .sort((a, b) => {
        const numA = parseInt(a[0].replace('H', ''));
        const numB = parseInt(b[0].replace('H', ''));
        return numA - numB;
      });
    
    // Use a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Add each H function to the list
    hFunctionEntries.forEach(([key, value]) => {
      const hFunctionItem = this.createHFunctionElement(key, value);
      if (hFunctionItem) {
        fragment.appendChild(hFunctionItem);
      }
    });
    
    // Add all items at once
    hFunctionsList.appendChild(fragment);
    
    // Reset edit section
    this.exitHFunctionEditMode();
  },
  
  /**
   * Create an H function element from the template
   * @param {string} hKey - H function key (e.g., "H1")
   * @param {string} hName - H function name/description
   * @return {Node} Created H function element
   */
  createHFunctionElement: function(hKey, hName) {
    const { hFunctionDefItemTemplate } = this.elements;
    if (!hFunctionDefItemTemplate) return null;
    
    // Clone the template
    const hFunctionItem = document.importNode(hFunctionDefItemTemplate.content, true);
    
    // Set H number and name
    const hNumberElem = hFunctionItem.querySelector(".h-number");
    const hNameElem = hFunctionItem.querySelector(".h-name");
    
    if (hNumberElem) hNumberElem.textContent = hKey;
    if (hNameElem) hNameElem.textContent = hName;
    
    // Set up edit button
    const editBtn = hFunctionItem.querySelector(".edit-h-function");
    if (editBtn) {
      editBtn.addEventListener("click", () => this.enterHFunctionEditMode(hKey, hName));
    }
    
    // Set up remove button
    const removeBtn = hFunctionItem.querySelector(".remove-h-function");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => this.removeHFunction(hKey));
    }
    
    return hFunctionItem;
  },
  
  /**
   * Add a new H function definition
   */
  addNewHFunction: function() {
    const { newHNumber, newHName } = this.elements;
    if (!newHNumber || !newHName) return;
    
    const hNum = newHNumber.value.trim();
    const hName = newHName.value.trim();
    
    // Validate inputs
    if (!hNum || !hName) {
      this.showToast("Please enter both H number and name", "error");
      return;
    }
    
    // Format H number
    const hKey = `H${hNum}`;
    
    // Check if H function already exists
    if (NCConverter.state.settings.hFunctions[hKey]) {
      this.showToast(`H${hNum} already exists. Use edit function instead.`, "warning");
      return;
    }
    
    // Add to settings
    NCConverter.state.settings.hFunctions[hKey] = hName;
    NCConverter.Settings.saveSettings(NCConverter.state.settings);
    
    // Add to list
    const hFunctionItem = this.createHFunctionElement(hKey, hName);
    if (hFunctionItem && this.elements.hFunctionsList) {
      this.elements.hFunctionsList.appendChild(hFunctionItem);
    }
    
    // Clear inputs
    newHNumber.value = "";
    newHName.value = "";
    
    // Update UI
    this.refreshHFunctionData();
    this.showToast(`H${hNum} added successfully`, "success");
    
    // Focus for easy addition of multiple entries
    newHNumber.focus();
  },
  
  /**
   * Enter edit mode for an H function
   * @param {string} hKey - H function key (e.g., "H1")
   * @param {string} hName - H function name/description
   */
  enterHFunctionEditMode: function(hKey, hName) {
    const { editHFunctionSection, editHNumber, editHName } = this.elements;
    if (!editHFunctionSection || !editHNumber || !editHName) return;
    
    // Set the form values
    editHNumber.value = hKey.replace('H', '');
    editHName.value = hName;
    
    // Show edit section
    editHFunctionSection.style.display = "block";
    
    // Track the H function being edited
    NCConverter.state.currentlyEditingH = hKey;
    
    // Scroll to edit section
    editHFunctionSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
  
  /**
   * Save edited H function
   */
  saveHFunctionEdit: function() {
    if (!NCConverter.state.currentlyEditingH || !this.elements.editHName) return;
    
    const hName = this.elements.editHName.value.trim();
    
    // Validate input
    if (!hName) {
      this.showToast("Please enter a name for the H function", "error");
      return;
    }
    
    // Update in settings
    NCConverter.state.settings.hFunctions[NCConverter.state.currentlyEditingH] = hName;
    NCConverter.Settings.saveSettings(NCConverter.state.settings);
    
    // Exit edit mode
    this.exitHFunctionEditMode();
    
    // Refresh UI
    this.initializeHFunctionsList();
    this.refreshHFunctionData();
    
    this.showToast(`${NCConverter.state.currentlyEditingH} updated successfully`, "success");
  },
  
  /**
   * Exit H function edit mode
   */
  exitHFunctionEditMode: function() {
    const { editHFunctionSection, editHNumber, editHName } = this.elements;
    if (!editHFunctionSection) return;
    
    // Hide edit section
    editHFunctionSection.style.display = "none";
    
    // Clear tracking
    NCConverter.state.currentlyEditingH = null;
    
    // Clear form values
    if (editHNumber) editHNumber.value = "";
    if (editHName) editHName.value = "";
  },
  
  /**
   * Remove an H function
   * @param {string} hKey - H function key to remove (e.g., "H1")
   */
  removeHFunction: function(hKey) {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete ${hKey}?`)) {
      return;
    }
    
    // Remove from settings
    delete NCConverter.state.settings.hFunctions[hKey];
    NCConverter.Settings.saveSettings(NCConverter.state.settings);
    
    // Exit edit mode if deleting the currently edited item
    if (NCConverter.state.currentlyEditingH === hKey) {
      this.exitHFunctionEditMode();
    }
    
    // Refresh UI
    this.initializeHFunctionsList();
    this.refreshHFunctionData();
    
    this.showToast(`${hKey} removed successfully`, "success");
  },
  
  /**
   * Reset H functions to defaults
   */
  resetHFunctions: function() {
    // Confirm reset
    if (!confirm("Are you sure you want to reset all H functions to defaults?")) {
      return;
    }
    
    // Reset to defaults
    NCConverter.state.settings.hFunctions = {...NCConverter.DEFAULT_H_FUNCTIONS};
    NCConverter.Settings.saveSettings(NCConverter.state.settings);
    
    // Exit edit mode
    this.exitHFunctionEditMode();
    
    // Refresh UI
    this.initializeHFunctionsList();
    this.refreshHFunctionData();
    
    this.showToast("H functions reset to defaults", "success");
  },
  
  /**
   * Refresh H function data throughout the app
   */
  refreshHFunctionData: function() {
    // Update H mappings tab if it's currently visible
    const hFunctionsTab = document.getElementById("hfunctions-tab");
    if (hFunctionsTab && hFunctionsTab.style.display !== 'none') {
      this.updateHMappingUI();
    }
  },
  
  /**
   * Update H function mappings from file content
   * Always uses the original file content to avoid mapping list corruption.
   */
  updateHMappingFromFile: function() {
    console.log("=== H MAPPING UPDATE DEBUG ===");
    
    // Always use the original file content for H detection
    const contentToAnalyze = NCConverter.state.fileContent;
    if (!contentToAnalyze) {
      console.log("No content to analyze for H functions");
      return;
    }
    
    console.log("Content length:", contentToAnalyze.length);
    console.log("Content preview:", contentToAnalyze.substring(0, 200));
    
    // Use word boundaries to capture H numbers
    let matches = contentToAnalyze.match(/\bH\d+\b/gi) || [];
    console.log("Raw H function matches:", matches);
    
    const distinct = [...new Set(matches.map(h => h.toUpperCase()))];
    console.log("Distinct H functions found:", distinct);
    
    // Ensure hMapping is an array and filter out invalid entries
    if (!Array.isArray(NCConverter.state.hMapping)) { 
      NCConverter.state.hMapping = []; 
    }
    
    console.log("Current hMapping before update:", NCConverter.state.hMapping);
    
    // Keep track of existing mappings
    const existingMappings = {};
    NCConverter.state.hMapping.forEach(m => {
      if (m && m.from) {
        existingMappings[m.from.toUpperCase()] = m.to;
      }
    });
    
    console.log("Existing mappings preserved:", existingMappings);
    
    // Create a new hMapping array
    let newMapping = [];
    
    // Add all distinct H numbers found in the content
    distinct.forEach(hnum => {
      if (existingMappings[hnum]) {
        // If we already have a mapping for this H number, preserve it
        newMapping.push({ from: hnum, to: existingMappings[hnum] });
        console.log(`Preserved mapping: ${hnum} → ${existingMappings[hnum]}`);
      } else {
        // Otherwise create a new mapping (from = to)
        newMapping.push({ from: hnum, to: hnum });
        console.log(`New mapping: ${hnum} → ${hnum}`);
      }
    });
    
    // Assign the new mapping and save it
    NCConverter.state.hMapping = newMapping;
    console.log("Final hMapping:", NCConverter.state.hMapping);
    
    this.saveHMapping(NCConverter.state.hMapping);
    
    // Force UI update
    this.updateHMappingUI();
    
    console.log("=== H MAPPING UPDATE COMPLETE ===");
  },
  
  /**
   * Update the H mapping UI with current mappings
   */
  updateHMappingUI: function() {
    const { hMappingContainer, hMappingItemTemplate } = this.elements;
    if (!hMappingContainer || !hMappingItemTemplate) return;
    
    // Clear the container
    hMappingContainer.innerHTML = "";
    
    // Add empty state message if no H numbers found
    if (!NCConverter.state.hMapping || NCConverter.state.hMapping.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "empty-message";
      emptyMessage.style.fontStyle = "italic";
      emptyMessage.style.color = "var(--gray-500)";
      emptyMessage.style.textAlign = "center";
      emptyMessage.style.padding = "var(--space-3)";
      emptyMessage.textContent = "No H numbers detected. Click 'Detect H Numbers' to scan your file or upload a file containing H numbers.";
      hMappingContainer.appendChild(emptyMessage);
      return;
    }
    
    // Use a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Create rows for each H number mapping
    NCConverter.state.hMapping.forEach((map, index) => {
      if (!map || !map.from) return;
      
      // Clone the template
      const row = document.importNode(hMappingItemTemplate.content, true);
      
      // Original H function with friendly name
      const origValue = map.from;
      const friendly = this.getHFunctionName(origValue);
      
      // Set original H function text
      const origDisplay = row.querySelector(".h-original");
      if (origDisplay) {
        origDisplay.textContent = origValue + " (" + friendly + ")";
      }
      
      // Set up mapping select
      const newSelect = row.querySelector(".h-mapping");
      if (newSelect) {
        newSelect.innerHTML = this.getHFunctionOptionsHTML();
        newSelect.value = map.to || origValue;
        newSelect.addEventListener("change", () => {
          // Store the original value to check if it changed
          const oldTo = map.to;
          
          // Update the mapping
          map.to = newSelect.value;
          this.saveHMapping(NCConverter.state.hMapping);
          
          // Only run full conversion if mapping actually changed
          if (oldTo !== map.to) {
            // Always run full conversion to ensure H mappings are applied to ORIGINAL content
            if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === "function") {
              console.log(`H mapping changed: ${map.from} → ${map.to}, running full conversion`);
              NCConverter.Conversion.updateConversion(true); // true = redetect H
            }
            
            // Update active mappings display in preview
            if (NCConverter.Preview && typeof NCConverter.Preview.updateActiveMappingsDisplay === "function") {
              NCConverter.Preview.updateActiveMappingsDisplay();
            }
            
            this.showToast(`${map.from} mapped to ${map.to}`, "success");
          }
        });
      }
      
      // Set up remove button
      const removeBtn = row.querySelector(".remove-mapping");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          NCConverter.state.hMapping.splice(index, 1);
          this.saveHMapping(NCConverter.state.hMapping);
          
          // Force conversion update
          if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === "function") {
            NCConverter.Conversion.updateConversion(true); // true = redetect H
          }
          
          // Update active mappings display in preview
          if (NCConverter.Preview && typeof NCConverter.Preview.updateActiveMappingsDisplay === "function") {
            NCConverter.Preview.updateActiveMappingsDisplay();
          }
        });
      }
      
      // Add to fragment
      fragment.appendChild(row);
    });
    
    // Add all rows at once
    hMappingContainer.appendChild(fragment);
  },
  
  /**
   * Get the friendly name for an H function
   * @param {string} hKey - H function key (e.g., "H1")
   * @return {string} H function friendly name
   */
  getHFunctionName: function(hKey) {
    // Get the friendly name from settings or return "Unknown"
    return NCConverter.state.settings.hFunctions && NCConverter.state.settings.hFunctions[hKey] 
      ? NCConverter.state.settings.hFunctions[hKey] 
      : "Unknown";
  },
  
  /**
   * Generate H function options HTML for select dropdowns
   * @return {string} HTML options string
   */
  getHFunctionOptionsHTML: function() {
    // Generate options from the current hFunctions settings
    let optionsHTML = '';
    
    // Group H functions by category
    const woodCutting = [];
    const steelCutting = [];
    const milling = [];
    const other = [];
    
    // Get all H functions from settings
    const hFunctionEntries = Object.entries(NCConverter.state.settings.hFunctions)
      .sort((a, b) => {
        const numA = parseInt(a[0].replace('H', ''));
        const numB = parseInt(b[0].replace('H', ''));
        return numA - numB;
      });
    
    // Categorize based on number ranges
    hFunctionEntries.forEach(([key, value]) => {
      const hNum = parseInt(key.replace('H', ''));
      
      if (hNum >= 1 && hNum < 40) {
        woodCutting.push([key, value]);
      } else if (hNum >= 40 && hNum < 100) {
        steelCutting.push([key, value]);
      } else if (hNum >= 100) {
        milling.push([key, value]);
      } else {
        other.push([key, value]);
      }
    });
    
    // Build the options HTML
    
    // Wood Cutting
    if (woodCutting.length > 0) {
      optionsHTML += '<optgroup label="Wood Cutting">';
      woodCutting.forEach(([key, value]) => {
        optionsHTML += `<option value="${key}">${value} (${key})</option>`;
      });
      optionsHTML += '</optgroup>';
    }
    
    // Steel Cutting
    if (steelCutting.length > 0) {
      optionsHTML += '<optgroup label="Steel Cutting">';
      steelCutting.forEach(([key, value]) => {
        optionsHTML += `<option value="${key}">${value} (${key})</option>`;
      });
      optionsHTML += '</optgroup>';
    }
    
    // Milling
    if (milling.length > 0) {
      optionsHTML += '<optgroup label="Milling">';
      milling.forEach(([key, value]) => {
        optionsHTML += `<option value="${key}">${value} (${key})</option>`;
      });
      optionsHTML += '</optgroup>';
    }
    
    // Other
    if (other.length > 0) {
      optionsHTML += '<optgroup label="Other">';
      other.forEach(([key, value]) => {
        optionsHTML += `<option value="${key}">${value} (${key})</option>`;
      });
      optionsHTML += '</optgroup>';
    }
    
    return optionsHTML;
  },
  
  /**
   * Add auto-redetect option to the UI
   */
  addAutoRedetectOption: function() {
    const hfunctionsTab = document.getElementById("hfunctions-tab");
    if (!hfunctionsTab) return;
    
    // Check if auto-redetect container already exists
    const existingContainer = document.getElementById("autoRedetectContainer");
    if (existingContainer) {
      // Remove existing container to avoid duplicates
      existingContainer.parentNode.removeChild(existingContainer);
    }
    
    // Create a settings option for auto re-detection
    const settingDiv = document.createElement("div");
    settingDiv.className = "checkbox-option";
    settingDiv.id = "autoRedetectContainer";
    settingDiv.style.marginTop = "var(--space-4)";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "autoRedetectH";
    checkbox.checked = NCConverter.state.settings.autoRedetectH !== false; // Default to true
    
    const label = document.createElement("label");
    label.htmlFor = "autoRedetectH";
    label.textContent = "Automatically detect H numbers in modified file when changing mappings";
    
    settingDiv.appendChild(checkbox);
    settingDiv.appendChild(label);
    
    // Insert before the reset button
    const resetBtn = document.getElementById("resetHMappingBtn");
    if (resetBtn && resetBtn.parentNode) {
      resetBtn.parentNode.insertBefore(settingDiv, resetBtn);
    } else {
      hfunctionsTab.appendChild(settingDiv);
    }
    
    // Cache the element
    this.elements.autoRedetectContainer = settingDiv;
    this.elements.autoRedetectH = checkbox;
    
    // Add event listener to save setting
    checkbox.addEventListener("change", () => {
      if (!NCConverter.state || !NCConverter.state.settings) return;
      
      NCConverter.state.settings.autoRedetectH = checkbox.checked;
      
      if (NCConverter.Settings && typeof NCConverter.Settings.saveSettings === "function") {
        NCConverter.Settings.saveSettings(NCConverter.state.settings);
      }
    });
  },
  
  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Type of notification
   */
  showToast: function(message, type) {
    if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === "function") {
      NCConverter.UIHelpers.showToast(message, type);
    } else {
      console.log(message);
      if (type === 'error') {
        alert(message);
      }
    }
  },
  
  /**
   * Diagnostic function to help identify mapping issues
   */
  diagnoseMappingIssues: function() {
    console.log("=== H FUNCTION MAPPING DIAGNOSTICS ===");
    
    // Check state
    console.log("1. State Check:");
    console.log("   NCConverter.state exists:", !!NCConverter.state);
    console.log("   fileContent exists:", !!(NCConverter.state && NCConverter.state.fileContent));
    console.log("   convertedContent exists:", !!(NCConverter.state && NCConverter.state.convertedContent));
    console.log("   hMapping exists:", !!(NCConverter.state && NCConverter.state.hMapping));
    
    if (NCConverter.state && NCConverter.state.fileContent) {
      console.log("   fileContent length:", NCConverter.state.fileContent.length);
      
      // Check for H functions in original content
      const hMatches = NCConverter.state.fileContent.match(/\bH\d+\b/gi) || [];
      console.log("   H functions in original:", [...new Set(hMatches.map(h => h.toUpperCase()))]);
    }
    
    if (NCConverter.state && NCConverter.state.convertedContent) {
      console.log("   convertedContent length:", NCConverter.state.convertedContent.length);
      
      // Check for H functions in converted content
      const hMatches = NCConverter.state.convertedContent.match(/\bH\d+\b/gi) || [];
      console.log("   H functions in converted:", [...new Set(hMatches.map(h => h.toUpperCase()))]);
    }
    
    // Check mappings
    console.log("\n2. Mapping Check:");
    if (NCConverter.state && NCConverter.state.hMapping) {
      console.log("   hMapping is array:", Array.isArray(NCConverter.state.hMapping));
      console.log("   hMapping length:", NCConverter.state.hMapping.length);
      console.log("   hMapping contents:", NCConverter.state.hMapping);
      
      const activeMappings = NCConverter.state.hMapping.filter(m => 
        m && m.from && m.to && m.from !== m.to
      );
      console.log("   Active mappings (from ≠ to):", activeMappings);
    }
    
    // Check UI elements
    console.log("\n3. UI Element Check:");
    const hMappingContainer = document.getElementById('hMappingContainer');
    console.log("   hMappingContainer exists:", !!hMappingContainer);
    if (hMappingContainer) {
      console.log("   hMappingContainer innerHTML length:", hMappingContainer.innerHTML.length);
    }
    
    // Check preview elements
    const originalPreview = document.getElementById('originalPreview');
    const convertedPreview = document.getElementById('convertedPreview');
    console.log("   originalPreview exists:", !!originalPreview);
    console.log("   convertedPreview exists:", !!convertedPreview);
    
    // Check if modules are loaded
    console.log("\n4. Module Check:");
    console.log("   NCConverter.Conversion exists:", !!(NCConverter.Conversion));
    console.log("   NCConverter.Preview exists:", !!(NCConverter.Preview));
    console.log("   NCConverter.HFunctions exists:", !!(NCConverter.HFunctions));
    
    console.log("=== DIAGNOSTICS COMPLETE ===");
    
    // Return diagnostic data for further analysis
    return {
      hasState: !!(NCConverter.state),
      hasFileContent: !!(NCConverter.state && NCConverter.state.fileContent),
      hasConvertedContent: !!(NCConverter.state && NCConverter.state.convertedContent),
      hasMapping: !!(NCConverter.state && NCConverter.state.hMapping),
      mappingCount: (NCConverter.state && NCConverter.state.hMapping) ? NCConverter.state.hMapping.length : 0,
      activeMappingCount: (NCConverter.state && NCConverter.state.hMapping) ? 
        NCConverter.state.hMapping.filter(m => m && m.from && m.to && m.from !== m.to).length : 0,
      hasUIElements: !!(document.getElementById('hMappingContainer')),
      hasPreviewElements: !!(document.getElementById('originalPreview') && document.getElementById('convertedPreview'))
    };
  },
  
  /**
   * Force refresh all mapping-related functionality
   */
  forceRefreshMapping: function() {
    console.log("=== FORCE REFRESH MAPPING ===");
    
    try {
      // 1. Re-detect H functions
      this.updateHMappingFromFile();
      
      // 2. Update UI
      this.updateHMappingUI();
      
      // 3. Re-run full conversion to apply mappings to ORIGINAL content
      if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === 'function') {
        NCConverter.Conversion.updateConversion(false); // false = don't redetect H
      }
      
      // 4. Update preview
      if (NCConverter.Preview && typeof NCConverter.Preview.updatePreview === 'function') {
        NCConverter.Preview.updatePreview();
      }
      
      // 5. Update export button
      if (NCConverter.Export && typeof NCConverter.Export.updateExportButton === 'function') {
        NCConverter.Export.updateExportButton();
      }
      
      console.log("Force refresh mapping complete");
      
      // Show success message
      if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === 'function') {
        NCConverter.UIHelpers.showToast("H function mappings refreshed successfully", "success");
      }
      
    } catch (error) {
      console.error("Error during force refresh mapping:", error);
      
      if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === 'function') {
        NCConverter.UIHelpers.showToast("Error refreshing mappings: " + error.message, "error");
      }
    }
  }
};