/**
 * NC File Converter Constants
 * Contains application-wide constants and default values
 */

// Global namespace
const NCConverter = {};

// Storage keys
NCConverter.SETTINGS_KEY = "ncConverterSettings";
NCConverter.HMAPPING_KEY = "ncHMapping";

// Default settings
NCConverter.DEFAULT_TOKENS = ["X", "Y", "I", "J", "R", "Radius:", "CylDia:", "GROESSE:", "SIZE:"];

// Default H functions
NCConverter.DEFAULT_H_FUNCTIONS = {
  "1": "1 point",
  "2": "2 points", 
  "3": "3 points",
  "4": "4 points",
  "5": "1.5 points",
  "11": "1 point/pulse",
  "12": "2 points/pulse",
  "13": "3 points/pulse",
  "14": "4 points/pulse",
  "15": "1.5 points/pulse",
  "20": "Fast Engrave",
  "21": "Fine cut pulse",
  "22": "Fine cut CW",
  "25": "2 points bridge",
  "26": "3 points bridge",
  "27": "4 points bridge",
  "33": "Nozzle Engrave",
  "40": "Groove",
  "41": "Cut CW",
  "42": "Pulse_1",
  "43": "Pulse_2",
  "44": "Engrave",
  "100": "Milling Height 1",
  "101": "Milling Height 2"
};

// Version information
NCConverter.APP_VERSION = "2.1.3";
NCConverter.GITHUB_USER = "aardel";
NCConverter.GITHUB_REPO = "nc-file-converter";
NCConverter.VERSION_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Check once per day (in ms)

// Application state
NCConverter.state = {
  settings: null,         // Current application settings
  hMapping: [],           // H function mappings
  fileContent: "",        // Original file content
  convertedContent: "",   // Converted file content
  selectedFile: null,     // Currently selected file object
  finalUnits: "mm",       // The units after conversion (mm or inches)
  currentlyEditingH: null // Currently editing H function (if any)
};

// Debug logging utility
NCConverter.debugLog = function(message, ...args) {
  // Check if debug mode is enabled in settings
  // If settings aren't loaded yet, don't log (avoids startup spam)
  if (NCConverter.state && 
      NCConverter.state.settings && 
      NCConverter.state.settings.debugMode === true) {
    console.log(message, ...args);
  }
};

// Additional debug utilities
NCConverter.debugWarn = function(message, ...args) {
  if (NCConverter.state && 
      NCConverter.state.settings && 
      NCConverter.state.settings.debugMode === true) {
    console.warn(message, ...args);
  }
};

NCConverter.debugError = function(message, ...args) {
  if (NCConverter.state && 
      NCConverter.state.settings && 
      NCConverter.state.settings.debugMode === true) {
    console.error(message, ...args);
  }
};

// Force debug mode utility (for development/troubleshooting)
NCConverter.enableDebugMode = function() {
  if (NCConverter.state && NCConverter.state.settings) {
    NCConverter.state.settings.debugMode = true;
    
    // Update UI toggle if it exists
    const debugToggle = document.getElementById('debugModeToggle');
    if (debugToggle) debugToggle.checked = true;
    
    // Save to localStorage
    if (NCConverter.Settings && NCConverter.Settings.saveSettings) {
      NCConverter.Settings.saveSettings(NCConverter.state.settings);
    }
    
    console.log("🔧 Debug mode enabled - console messages will now be shown");
  }
};

NCConverter.disableDebugMode = function() {
  if (NCConverter.state && NCConverter.state.settings) {
    NCConverter.state.settings.debugMode = false;
    
    // Update UI toggle if it exists
    const debugToggle = document.getElementById('debugModeToggle');
    if (debugToggle) debugToggle.checked = false;
    
    // Save to localStorage
    if (NCConverter.Settings && NCConverter.Settings.saveSettings) {
      NCConverter.Settings.saveSettings(NCConverter.state.settings);
    }
    
    console.log("🔇 Debug mode disabled - console messages will be hidden");
  }
};
