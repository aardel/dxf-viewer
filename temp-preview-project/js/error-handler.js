/**
 * NC File Converter Error Handler Module
 * Centralized error handling for better user experience and debugging
 */

NCConverter.ErrorHandler = {
  /**
   * Initialize the error handler
   */
  init: function() {
    // Set up global error handler
    window.addEventListener('error', this.handleGlobalError.bind(this));
    
    // Override console.error to capture and handle errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Call original console.error
      originalConsoleError.apply(console, args);
      
      // Process the error
      this.logError(args.join(' '));
    };
  },
  
  /**
   * Handle global JavaScript errors
   * @param {ErrorEvent} event - Error event object
   */
  handleGlobalError: function(event) {
    const errorMessage = `Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
    this.showError(errorMessage);
    this.logError(errorMessage);
    
    // Don't prevent the default error handling
    return false;
  },
  
  /**
   * Try to execute a function and handle any errors
   * @param {Function} fn - Function to execute
   * @param {string} errorContext - Context description for error messages
   * @param {boolean} showToast - Whether to show a toast notification on error
   * @return {*} Result of the function or null if error occurred
   */
  try: function(fn, errorContext, showToast = true) {
    try {
      return fn();
    } catch (error) {
      const errorMessage = `${errorContext}: ${error.message}`;
      this.logError(errorMessage);
      
      if (showToast) {
        this.showError(errorMessage);
      }
      
      return null;
    }
  },
  
  /**
   * Show error message to the user
   * @param {string} message - Error message
   */
  showError: function(message) {
    // Use the UI helper to show toast if available
    if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === 'function') {
      NCConverter.UIHelpers.showToast(message, 'error');
    } else {
      // Fallback if UI helpers not available
      console.error(message);
    }
  },
  
  /**
   * Log error for debugging
   * @param {string} message - Error message
   */
  logError: function(message) {
    // In a real app, you might send this to a logging service
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    // Store in session storage for debugging
    const logs = this.getErrorLogs();
    logs.push(logEntry);
    
    // Limit the size of the log
    if (logs.length > 50) {
      logs.shift(); // Remove oldest log
    }
    
    // Save back to session storage
    sessionStorage.setItem('ncConverterErrorLogs', JSON.stringify(logs));
  },
  
  /**
   * Get all error logs
   * @return {Array} Array of error log messages
   */
  getErrorLogs: function() {
    try {
      const logs = sessionStorage.getItem('ncConverterErrorLogs');
      return logs ? JSON.parse(logs) : [];
    } catch (e) {
      return [];
    }
  },
  
  /**
   * Clear all error logs
   */
  clearErrorLogs: function() {
    sessionStorage.removeItem('ncConverterErrorLogs');
  }
};
