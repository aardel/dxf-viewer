/**
 * NC File Converter Version Check Module
 * Handles checking for updates and showing update notifications
 */

NCConverter.VersionCheck = {
  /**
   * Initialize the version check module
   */
  init: function() {
    // DOM references
    this.currentVersionElem = document.getElementById('currentVersion');
    this.lastUpdateCheckElem = document.getElementById('lastUpdateCheck');
    this.checkUpdateBtn = document.getElementById('checkUpdateBtn');
    this.updateStatusElem = document.getElementById('updateStatus');
    
    // Initialize version display
    if (this.currentVersionElem) {
      this.currentVersionElem.textContent = NCConverter.APP_VERSION;
    }
    
    // Initialize last check display
    const lastCheck = localStorage.getItem('lastUpdateCheck');
    if (lastCheck && this.lastUpdateCheckElem) {
      this.lastUpdateCheckElem.textContent = new Date(parseInt(lastCheck)).toLocaleString();
    }
    
    // Set up check update button handler
    if (this.checkUpdateBtn) {
      this.checkUpdateBtn.addEventListener('click', () => {
        this.checkUpdateBtn.disabled = true;
        this.checkUpdateBtn.textContent = 'Checking...';
        
        this.checkForUpdates(true) // true = manual check
          .finally(() => {
            this.checkUpdateBtn.disabled = false;
            this.checkUpdateBtn.textContent = 'Check for Updates';
            
            // Update last check time
            const lastCheckElem = document.getElementById('lastUpdateCheck');
            if (lastCheckElem) {
              lastCheckElem.textContent = new Date().toLocaleString();
            }
          });
      });
    }
    
    // Initial check for updates
    this.checkForUpdates();
  },
  
  /**
   * Check for updates from the GitHub repository
   * @param {boolean} manual - Whether this is a manual check
   * @return {Promise} Promise resolving when check is complete
   */
  checkForUpdates: function(manual = false) {
    // Don't check too frequently unless it's a manual check
    const lastCheck = localStorage.getItem('lastUpdateCheck');
    const now = Date.now();
    
    if (!manual && lastCheck && (now - parseInt(lastCheck)) < NCConverter.VERSION_CHECK_INTERVAL) {
      console.log("Skipping update check - checked recently");
      return Promise.resolve();
    }
    
    // Record this check time
    localStorage.setItem('lastUpdateCheck', now.toString());
    
    // Update the last check display
    if (this.lastUpdateCheckElem) {
      this.lastUpdateCheckElem.textContent = new Date().toLocaleString();
    }
    
    return fetch(`https://raw.githubusercontent.com/${NCConverter.GITHUB_USER}/${NCConverter.GITHUB_REPO}/main/version.json?nocache=${now}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch version info: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data && data.version) {
          const latestVersion = data.version;
          
          if (this.compareVersions(latestVersion, NCConverter.APP_VERSION) > 0) {
            // Show update notification
            this.showUpdateNotification(latestVersion, data.releaseNotes || "Bug fixes and improvements");
            
            if (this.updateStatusElem) {
              this.updateStatusElem.innerHTML = `<span style="color: var(--warning-color);">New version ${latestVersion} available!</span>`;
            }
          } else if (manual) {
            if (this.updateStatusElem) {
              this.updateStatusElem.innerHTML = `<span style="color: var(--success-color);">You have the latest version!</span>`;
            }
          }
        }
      })
      .catch(error => {
        console.error("Error checking for updates:", error);
        
        if (this.updateStatusElem) {
          this.updateStatusElem.innerHTML = `<span style="color: var(--danger-color);">Error checking for updates: ${error.message}</span>`;
        }
        
        if (manual) {
          throw error; // Re-throw for manual checks
        }
      });
  },
  
  /**
   * Compare semantic versions
   * @param {string} v1 - Version 1 (e.g., "1.0.1")
   * @param {string} v2 - Version 2 (e.g., "1.0.0")
   * @return {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions: function(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = i < parts1.length ? parts1[i] : 0;
      const p2 = i < parts2.length ? parts2[i] : 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  },
  
  /**
   * Show update notification to the user
   * @param {string} newVersion - Latest version available
   * @param {string} releaseNotes - Release notes text
   */
  showUpdateNotification: function(newVersion, releaseNotes) {
    // Create update notification element
    const updateNotification = document.createElement('div');
    updateNotification.className = 'update-notification';
    updateNotification.innerHTML = `
      <div class="update-card">
        <div class="update-header">
          <h3>New Version Available</h3>
          <button class="close-update">&times;</button>
        </div>
        <div class="update-content">
          <p>A new version of NC File Converter (${newVersion}) is available!</p>
          <p><strong>What's new:</strong> ${releaseNotes}</p>
        </div>
        <div class="update-footer">
          <a href="https://github.com/${NCConverter.GITHUB_USER}/${NCConverter.GITHUB_REPO}/releases/latest" 
             target="_blank" class="update-button">Download Update</a>
          <button class="update-remind">Remind Me Later</button>
        </div>
      </div>
    `;
    
    // Add to document
    document.body.appendChild(updateNotification);
    
    // Add event listeners
    const closeBtn = updateNotification.querySelector('.close-update');
    const remindBtn = updateNotification.querySelector('.update-remind');
    
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(updateNotification);
    });
    
    remindBtn.addEventListener('click', () => {
      document.body.removeChild(updateNotification);
      // Reset the last check time to a few days ago to remind later
      const remindTime = Date.now() - NCConverter.VERSION_CHECK_INTERVAL + (24 * 60 * 60 * 1000); // Check again in 1 day
      localStorage.setItem('lastUpdateCheck', remindTime.toString());
    });
  }
};
