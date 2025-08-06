/**
 * NC File Converter Token Manager Module
 * Manages conversion tokens (X, Y, Z, I, J, etc.)
 */

NCConverter.TokenManager = {
  /**
   * DOM element cache
   */
  elements: {},
  
  /**
   * Token cache for quick lookups
   */
  tokenCache: null,
  
  /**
   * Initialized state
   */
  initialized: false,
  
  /**
   * Initialize the token manager module
   */
  init: function() {
    console.log("TokenManager initializing");
    
    // Cache DOM references
    this.elements = {
      tokenList: document.getElementById("tokenList"),
      customToken: document.getElementById("customToken"),
      addTokenBtn: document.getElementById("addTokenBtn"),
      resetTokensBtn: document.getElementById("resetTokensBtn"),
      tokenItemTemplate: document.getElementById("tokenItemTemplate"),
      quickTokenBtns: document.querySelectorAll('.quick-token-btn')
    };
    
    // Initialize the token list
    this.initializeTokenList();
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.initialized = true;
    console.log("TokenManager initialized");
  },
  
  /**
   * Set up event listeners for token manager
   */
  setupEventListeners: function() {
    const { addTokenBtn, customToken, resetTokensBtn, quickTokenBtns } = this.elements;
    
    // Add token button
    if (addTokenBtn && customToken) {
      addTokenBtn.addEventListener("click", this.addCustomToken.bind(this));
      
      // Allow pressing Enter to add token
      customToken.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.addCustomToken();
        }
      });
    }
    
    // Token reset button
    if (resetTokensBtn) {
      resetTokensBtn.addEventListener("click", this.resetTokens.bind(this));
    }
    
    // Quick token buttons - use event delegation for better performance
    if (this.elements.tokenList && this.elements.tokenList.parentNode) {
      const container = this.elements.tokenList.parentNode.parentNode;
      
      container.addEventListener('click', (e) => {
        const target = e.target;
        
        // Check if it's a quick token button
        if (target.classList.contains('quick-token-btn')) {
          const token = target.getAttribute('data-token');
          if (!token) return;
          
          this.addQuickToken(token, target);
        }
        
        // Check if it's a remove token button
        if (target.classList.contains('remove-token')) {
          const tokenItem = target.closest('.token-item');
          if (tokenItem) {
            const tokenName = tokenItem.querySelector('.token-name');
            if (tokenName) {
              this.removeToken(tokenName.textContent);
            }
          }
        }
      });
    }
  },
  
  /**
   * Initialize the token list from settings
   */
  initializeTokenList: function() {
    const { tokenList } = this.elements;
    if (!tokenList) return;
    
    // Clear the token list
    tokenList.innerHTML = "";
    
    // Make sure tokens array exists in settings
    if (!NCConverter.state || !NCConverter.state.settings) {
      console.warn("Settings not initialized");
      return;
    }
    
    if (!Array.isArray(NCConverter.state.settings.tokens) || NCConverter.state.settings.tokens.length === 0) {
      NCConverter.state.settings.tokens = [...NCConverter.DEFAULT_TOKENS];
    }
    
    // Reset token cache
    this.tokenCache = new Set(NCConverter.state.settings.tokens);
    
    // Use a document fragment for better performance when adding many tokens
    const fragment = document.createDocumentFragment();
    
    // Add each token to the list
    NCConverter.state.settings.tokens.forEach(token => {
      const tokenItem = this.createTokenElement(token);
      if (tokenItem) {
        fragment.appendChild(tokenItem);
      }
    });
    
    // Add all tokens at once to the DOM
    tokenList.appendChild(fragment);
    
    // Update quick token buttons status
    this.updateQuickTokenButtons();
  },
  
  /**
   * Create a token element from the template
   * @param {string} token - Token to add
   * @return {Node} Created token element
   */
  createTokenElement: function(token) {
    const { tokenItemTemplate } = this.elements;
    if (!tokenItemTemplate) return null;
    
    // Clone the template
    const tokenItem = document.importNode(tokenItemTemplate.content, true);
    
    // Set token name
    const tokenName = tokenItem.querySelector(".token-name");
    if (tokenName) {
      tokenName.textContent = token;
    }
    
    return tokenItem;
  },
  
  /**
   * Add a token to the UI list
   * @param {string} token - Token to add to the list
   */
  addTokenToList: function(token) {
    const { tokenList } = this.elements;
    if (!tokenList || !token) return;
    
    // Create token element
    const tokenItem = this.createTokenElement(token);
    if (!tokenItem) return;
    
    // Add to the list
    tokenList.appendChild(tokenItem);
    
    // Update quick token buttons state
    this.updateQuickTokenButtons();
  },
  
  /**
   * Add a "quick token" when clicking a quick token button
   * @param {string} token - Token to add
   * @param {Element} btn - Button element clicked
   */
  addQuickToken: function(token, btn) {
    // Skip if already in the list
    if (this.tokenCache.has(token)) {
      this.showToast(`Token "${token}" already exists`, "warning");
      return;
    }
    
    // Add the token
    NCConverter.state.settings.tokens.push(token);
    NCConverter.Settings.saveSettings(NCConverter.state.settings);
    
    // Update cache
    this.tokenCache.add(token);
    
    // Add to UI
    this.addTokenToList(token);
    
    // Update conversion if available
    if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === "function") {
      NCConverter.Conversion.updateConversion();
    }
    
    this.showToast(`Token "${token}" added`, "success");
    
    // Disable the button
    if (btn) {
      btn.classList.add('disabled');
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    }
  },
  
  /**
   * Add a custom token from the input field
   */
  addCustomToken: function() {
    const { customToken } = this.elements;
    if (!customToken) return;
    
    const token = customToken.value.trim();
    if (!token) {
      this.showToast("Please enter a token", "error");
      return;
    }
    
    // Check if token already exists
    if (this.tokenCache.has(token)) {
      this.showToast(`Token "${token}" already exists`, "warning");
      return;
    }
    
    // Add token
    NCConverter.state.settings.tokens.push(token);
    NCConverter.Settings.saveSettings(NCConverter.state.settings);
    
    // Update cache
    this.tokenCache.add(token);
    
    // Add to UI
    this.addTokenToList(token);
    
    // Clear input
    customToken.value = "";
    
    // Update conversion if available
    if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === "function") {
      NCConverter.Conversion.updateConversion();
    }
    
    this.showToast(`Token "${token}" added`, "success");
    
    // Focus back on input for easy addition of multiple tokens
    customToken.focus();
  },
  
  /**
   * Remove a token from the list
   * @param {string} token - Token to remove
   */
  removeToken: function(token) {
    const { tokenList } = this.elements;
    if (!tokenList || !token) return;
    
    // Remove from the DOM efficiently
    const tokenItems = tokenList.querySelectorAll('.token-item');
    let found = false;
    
    tokenItems.forEach(item => {
      const tokenName = item.querySelector('.token-name');
      if (tokenName && tokenName.textContent === token) {
        item.remove();
        found = true;
      }
    });
    
    if (!found) return;
    
    // Remove from settings
    NCConverter.state.settings.tokens = NCConverter.state.settings.tokens.filter(t => t !== token);
    
    // Remove from cache
    this.tokenCache.delete(token);
    
    // Save and update
    NCConverter.Settings.saveSettings(NCConverter.state.settings);
    this.updateQuickTokenButtons();
    
    // Update conversion if available
    if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === "function") {
      NCConverter.Conversion.updateConversion();
    }
    
    this.showToast(`Token "${token}" removed`, "success");
  },
  
  /**
   * Update quick token buttons state (disable those already in use)
   */
  updateQuickTokenButtons: function() {
    const { quickTokenBtns } = this.elements;
    if (!quickTokenBtns) return;
    
    quickTokenBtns.forEach(btn => {
      const token = btn.getAttribute('data-token');
      
      if (this.tokenCache.has(token)) {
        btn.classList.add('disabled');
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
      } else {
        btn.classList.remove('disabled');
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    });
  },
  
  /**
   * Get the current list of tokens
   * @return {Array} Array of tokens
   */
  getTokens: function() { 
    // Always return a valid array of tokens
    if (this.tokenCache) {
      return Array.from(this.tokenCache);
    }
    
    return Array.isArray(NCConverter.state.settings.tokens) && NCConverter.state.settings.tokens.length > 0 
      ? NCConverter.state.settings.tokens 
      : [...NCConverter.DEFAULT_TOKENS]; 
  },
  
  /**
   * Reset tokens to default values
   */
  resetTokens: function() {
    if (!NCConverter.state || !NCConverter.state.settings) {
      console.warn("Settings not initialized");
      return;
    }
    
    NCConverter.state.settings.tokens = [...NCConverter.DEFAULT_TOKENS];
    NCConverter.Settings.saveSettings(NCConverter.state.settings);
    
    // Reset token cache
    this.tokenCache = new Set(NCConverter.state.settings.tokens);
    
    // Refresh the list
    this.initializeTokenList();
    
    // Update conversion if available
    if (NCConverter.Conversion && typeof NCConverter.Conversion.updateConversion === "function") {
      NCConverter.Conversion.updateConversion();
    }
    
    this.showToast("Tokens reset to defaults", "success");
  },
  
  /**
   * Show a toast notification using UIHelpers
   * @param {string} message - Message to display
   * @param {string} type - Notification type
   */
  showToast: function(message, type) {
    if (NCConverter.UIHelpers && typeof NCConverter.UIHelpers.showToast === "function") {
      NCConverter.UIHelpers.showToast(message, type);
    } else {
      console.log(message);
    }
  }
};