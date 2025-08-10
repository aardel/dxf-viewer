// Output Manager Window JavaScript
// Handles all machine-specific configuration and output settings

let currentProfile = null;
let availableProfiles = [];
let currentTools = [];
let currentMappings = [];
let currentPriorityOrder = [];

// Initialize the Output Manager when the window loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Output Manager window loaded');
    await initializeOutputManager();
});

async function initializeOutputManager() {
    try {
        // Load available profiles
        await loadAvailableProfiles();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load current profile if available
        await loadCurrentProfile();
        
        // Load all configuration data
        await loadAllConfiguration();
        
    } catch (error) {
        console.error('Error initializing Output Manager:', error);
        showError('Failed to initialize Output Manager');
    }
}

async function loadAllConfiguration() {
    try {
        // Load tools
        await loadTools();
        
        // Load line type mappings
        await loadLineTypeMappings();
        
        // Load cutting priority
        await loadCuttingPriority();
        
        // Load header/footer configuration
        await loadHeaderFooterConfig();
        
        // Load output settings
        await loadOutputSettings();
        
    } catch (error) {
        console.error('Error loading configuration:', error);
        showError('Failed to load configuration');
    }
}

async function loadAvailableProfiles() {
    try {
        const profiles = await window.electronAPI.loadXmlProfiles();
        availableProfiles = profiles || [];
        
        const profileSelect = document.getElementById('profileSelect');
        if (profileSelect) {
            profileSelect.innerHTML = '';
            
            if (availableProfiles.length === 0) {
                profileSelect.innerHTML = '<option value="">No profiles available</option>';
            } else {
                availableProfiles.forEach(profile => {
                    const option = document.createElement('option');
                    option.value = profile.id || profile.name;
                    option.textContent = profile.name || profile.id;
                    profileSelect.appendChild(option);
                });
            }
        }
        
        console.log('Loaded profiles:', availableProfiles);
        
    } catch (error) {
        console.error('Error loading profiles:', error);
        showError('Failed to load profiles');
    }
}

async function loadCurrentProfile() {
    try {
        // Try to get the current profile from the main application's dropdown first
        const mainProfileSelect = document.querySelector('#postprocessorProfile');
        let currentProfileName = null;
        
        if (mainProfileSelect && mainProfileSelect.value && mainProfileSelect.value !== 'custom') {
            currentProfileName = mainProfileSelect.value.trim(); // Remove whitespace
        } else {
            // Fallback: try to get from main window via IPC
            try {
                currentProfileName = await window.electronAPI.getMainWindowCurrentProfile();
                if (currentProfileName) {
                    currentProfileName = currentProfileName.trim(); // Remove whitespace
                }
            } catch (ipcError) {
                console.log('IPC getMainWindowCurrentProfile failed, trying alternative method');
                // Try the old method as last resort
                try {
                    const profile = await window.electronAPI.getCurrentProfile();
                    if (profile) {
                        currentProfileName = (profile.id || profile.name).trim(); // Remove whitespace
                    }
                } catch (oldIpcError) {
                    console.log('All IPC methods failed');
                }
            }
        }
        
        // If still no profile name, try to get from localStorage or use first available
        if (!currentProfileName && availableProfiles.length > 0) {
            // Use the first available profile as fallback
            currentProfileName = (availableProfiles[0].filename || availableProfiles[0].name).trim();
            console.log('Using first available profile as fallback:', currentProfileName);
        }
        
        if (currentProfileName) {
            // Find the profile in available profiles
            const profile = availableProfiles.find(p => 
                (p.id || p.name || p.filename) === currentProfileName ||
                p.filename === currentProfileName
            );
            
            if (profile) {
                currentProfile = profile;
                
                // Select the current profile in dropdown
                const profileSelect = document.getElementById('profileSelect');
                if (profileSelect) {
                    profileSelect.value = profile.filename || profile.id || profile.name;
                }
                
                // Load profile configuration immediately
                await loadProfileConfiguration(profile);
            } else {
                console.warn('Current profile not found in available profiles:', currentProfileName);
                // Use first available profile as fallback
                if (availableProfiles.length > 0) {
                    currentProfile = availableProfiles[0];
                    const profileSelect = document.getElementById('profileSelect');
                    if (profileSelect) {
                        profileSelect.value = currentProfile.filename || currentProfile.id || currentProfile.name;
                    }
                    await loadProfileConfiguration(currentProfile);
                }
            }
        }
        
    } catch (error) {
        console.error('Error loading current profile:', error);
        showError('Failed to load current profile');
    }
}

async function saveOutputUnitsToProfile(units) {
    try {
        if (!currentProfile) return;
        
        // Save the units setting to the profile
        await window.electronAPI.savePostprocessorConfig(currentProfile.id || currentProfile.name, {
            units: units
        });
        
        showSuccess(`Output units set to ${units}`);
        
    } catch (error) {
        console.error('Error saving output units:', error);
        showError('Failed to save output units');
    }
}

async function loadProfileConfiguration(profile) {
    try {
        const config = await window.electronAPI.loadPostprocessorConfig(profile.id || profile.name);
        
        if (config) {
            populateConfigurationFields(config);
        } else {
            // Use default values if no config exists
            populateConfigurationFields({
                units: 'mm',
                includeLineNumbers: true
            });
        }
        
    } catch (error) {
        console.error('Error loading profile configuration:', error);
        // Use default values if config file doesn't exist
        console.log('Using default configuration values');
        populateConfigurationFields({
            units: 'mm',
            includeLineNumbers: true
        });
    }
}

function populateConfigurationFields(config) {
    // Profile settings
    const unitsSelect = document.getElementById('outputUnits');
    if (unitsSelect && config.units) {
        unitsSelect.value = config.units;
    }
    
    // Scale command is now in header/footer tab
    const scaleCommandInput = document.getElementById('scaleCommand');
    if (scaleCommandInput && config.scaleCommand) {
        scaleCommandInput.value = config.scaleCommand;
    }
    
    // Line numbers are now in output settings tab
    const lineNumbersCheckbox = document.getElementById('enableLineNumbers');
    if (lineNumbersCheckbox) {
        lineNumbersCheckbox.checked = config.includeLineNumbers !== false;
    }
}

async function loadTools() {
    try {
        if (!currentProfile) return;
        
        const tools = await window.electronAPI.getToolsFromProfile(currentProfile.id || currentProfile.name);
        
        // Ensure tools is an array
        if (Array.isArray(tools)) {
            currentTools = tools;
        } else if (tools && typeof tools === 'object') {
            // If tools is an object, convert to array
            currentTools = Object.values(tools);
        } else {
            currentTools = [];
        }
        
        displayTools();
        
    } catch (error) {
        console.error('Error loading tools:', error);
        currentTools = []; // Set empty array on error
        displayTools(); // Still try to display
        showError('Failed to load tools');
    }
}

function displayTools() {
    const toolGrid = document.getElementById('toolGrid');
    if (!toolGrid) return;
    
    toolGrid.innerHTML = '';
    
    if (!Array.isArray(currentTools) || currentTools.length === 0) {
        toolGrid.innerHTML = '<div class="no-data">No tools found in profile</div>';
        return;
    }
    
    currentTools.forEach(tool => {
        const toolCard = document.createElement('div');
        toolCard.className = 'tool-card';
        toolCard.innerHTML = `
            <h6>${tool.id || 'Unknown'}</h6>
            <div><strong>${tool.name || 'Unnamed Tool'}</strong></div>
            <div>${tool.description || 'No description'}</div>
            <div>Width: ${tool.width || 0}mm</div>
            <div>H-Code: ${tool.hCode || 'N/A'}</div>
        `;
        toolGrid.appendChild(toolCard);
    });
}

async function loadLineTypeMappings() {
    try {
        if (!currentProfile) return;
        
        const mappings = await window.electronAPI.getLineTypeMappingsFromProfile(currentProfile.id || currentProfile.name);
        
        // Ensure mappings is an array
        if (Array.isArray(mappings)) {
            currentMappings = mappings;
        } else if (mappings && typeof mappings === 'object') {
            // If mappings is an object, convert to array
            currentMappings = Object.values(mappings);
        } else {
            currentMappings = [];
        }
        
        displayLineTypeMappings();
        
    } catch (error) {
        console.error('Error loading line type mappings:', error);
        currentMappings = []; // Set empty array on error
        displayLineTypeMappings(); // Still try to display
        showError('Failed to load line type mappings');
    }
}

function displayLineTypeMappings() {
    const mappingGrid = document.getElementById('mappingGrid');
    if (!mappingGrid) return;
    
    mappingGrid.innerHTML = '';
    
    if (!Array.isArray(currentMappings) || currentMappings.length === 0) {
        mappingGrid.innerHTML = '<div class="no-data">No line type mappings found in profile</div>';
        return;
    }
    
    currentMappings.forEach(mapping => {
        const mappingCard = document.createElement('div');
        mappingCard.className = 'mapping-card';
        
        // Ensure currentTools is available for tool selection
        const toolOptions = Array.isArray(currentTools) ? currentTools.map(tool => 
            `<option value="${tool.id}" ${mapping.toolId === tool.id ? 'selected' : ''}>
                ${tool.id} (${tool.width || 0}mm - ${tool.description || 'No description'})
            </option>`
        ).join('') : '<option value="">No tools available</option>';
        
        mappingCard.innerHTML = `
            <h6>
                <span class="color-indicator" style="background: #ff0000;"></span>
                ${mapping.lineTypeName || 'Unknown'}
            </h6>
            <div><strong>Operation:</strong> ${mapping.lineTypeName || 'Unknown'}</div>
            <div><strong>Current Tool:</strong> ${mapping.toolId || 'None assigned'}</div>
            <div class="form-group">
                <label>Select Machine Tool:</label>
                <select class="form-select tool-select" data-line-type="${mapping.lineTypeId || ''}">
                    <option value="">Choose tool...</option>
                    ${toolOptions}
                </select>
            </div>
            <div><strong>Line Width:</strong> ${mapping.lineTypeName && mapping.lineTypeName.includes('pt') ? mapping.lineTypeName.split('pt')[0] + 'mm' : '1mm'}</div>
            <div><strong>Tool Width:</strong> ${mapping.toolId && Array.isArray(currentTools) ? (currentTools.find(t => t.id === mapping.toolId)?.width || 0) + 'mm' : 'N/A'}</div>
        `;
        mappingGrid.appendChild(mappingCard);
    });
}

async function loadCuttingPriority() {
    try {
        if (!currentProfile) return;
        
        const priorityConfig = await window.electronAPI.loadPriorityConfiguration(currentProfile.id || currentProfile.name);
        
        // Ensure priority items is an array
        if (priorityConfig && Array.isArray(priorityConfig.items)) {
            currentPriorityOrder = priorityConfig.items;
        } else if (priorityConfig && typeof priorityConfig === 'object') {
            // If priorityConfig is an object, try to extract items
            currentPriorityOrder = priorityConfig.items || Object.values(priorityConfig) || [];
        } else {
            currentPriorityOrder = [];
        }
        
        displayCuttingPriority();
        
    } catch (error) {
        console.error('Error loading cutting priority:', error);
        currentPriorityOrder = []; // Set empty array on error
        displayCuttingPriority(); // Still try to display
        showError('Failed to load cutting priority');
    }
}

function displayCuttingPriority() {
    const availableItems = document.getElementById('availableItems');
    const priorityOrder = document.getElementById('priorityOrder');
    
    if (!availableItems || !priorityOrder) return;
    
    availableItems.innerHTML = '';
    priorityOrder.innerHTML = '';
    
    // Display available tools (from currentTools)
    if (Array.isArray(currentTools) && currentTools.length > 0) {
        currentTools.forEach(tool => {
            const item = document.createElement('div');
            item.className = 'priority-item';
            item.innerHTML = `
                <span>${tool.id} - ${tool.name}</span>
                <span class="tool-width">${tool.width || 0}mm</span>
            `;
            availableItems.appendChild(item);
        });
    } else {
        availableItems.innerHTML = '<div class="no-data">No tools available</div>';
    }
    
    // Display priority order
    if (Array.isArray(currentPriorityOrder) && currentPriorityOrder.length > 0) {
        currentPriorityOrder.forEach((item, index) => {
            const priorityItem = document.createElement('div');
            priorityItem.className = 'priority-item';
            priorityItem.innerHTML = `
                <span class="priority-number">${index + 1}.</span>
                <span>${item.name || item.id || 'Unknown Item'}</span>
                <span class="tool-width">${item.width || 0}mm</span>
            `;
            priorityOrder.appendChild(priorityItem);
        });
    } else {
        priorityOrder.innerHTML = '<div class="no-data">No priority order set</div>';
    }
}

async function loadHeaderFooterConfig() {
    try {
        if (!currentProfile) return;
        
        const config = await window.electronAPI.loadPostprocessorConfig(currentProfile.id || currentProfile.name);
        
        if (config) {
            // Populate header settings
            const machineType = document.getElementById('machineType');
            if (machineType && config.machineType) {
                machineType.value = config.machineType;
            }
            
            const headerTemplate = document.getElementById('headerTemplate');
            if (headerTemplate && config.headerTemplate) {
                headerTemplate.value = config.headerTemplate;
            }
            
            const initialCommands = document.getElementById('initialCommands');
            if (initialCommands && config.initialCommands) {
                initialCommands.value = config.initialCommands;
            }
            
            // Update preview
            updateHeaderPreview();
        }
        
    } catch (error) {
        console.error('Error loading header/footer config:', error);
        showError('Failed to load header/footer configuration');
    }
}

function updateHeaderPreview() {
    const headerPreview = document.getElementById('headerPreview');
    const footerPreview = document.getElementById('footerPreview');
    
    if (headerPreview) {
        headerPreview.textContent = `%1
(Generated by DXF2Laser)
(File: example.dxf)
(Size: 100.0 x 50.0 mm)
(Timestamp: ${new Date().toISOString()})
G90
G60 X0`;
    }
    
    if (footerPreview) {
        footerPreview.textContent = `M30
(End of Program)`;
    }
}

async function loadOutputSettings() {
    try {
        // Load file output settings
        const defaultSavePath = document.getElementById('defaultSavePath');
        if (defaultSavePath) {
            // This would come from user preferences
            defaultSavePath.value = '/Volumes/Public/Lasercomb';
        }
        
        const filenameTemplate = document.getElementById('filenameTemplate');
        if (filenameTemplate) {
            filenameTemplate.value = '{original_name}.din';
        }
        
        // Load line numbers settings
        const startNumber = document.getElementById('startNumber');
        if (startNumber) {
            startNumber.value = '10';
        }
        
        const increment = document.getElementById('increment');
        if (increment) {
            increment.value = '1';
        }
        
        const formatTemplate = document.getElementById('formatTemplate');
        if (formatTemplate) {
            formatTemplate.value = 'N{number}';
        }
        
        // Load G-code commands
        const homeCommand = document.getElementById('homeCommand');
        if (homeCommand) {
            homeCommand.value = 'G0 X0 Y0';
        }
        
        const programEndCommand = document.getElementById('programEndCommand');
        if (programEndCommand) {
            programEndCommand.value = 'M30';
        }
        
    } catch (error) {
        console.error('Error loading output settings:', error);
        showError('Failed to load output settings');
    }
}

function setupEventListeners() {
    // Profile selection change
    const profileSelect = document.getElementById('profileSelect');
    if (profileSelect) {
        profileSelect.addEventListener('change', async (e) => {
            const selectedProfileId = e.target.value;
            if (selectedProfileId) {
                const profile = availableProfiles.find(p => (p.id || p.name) === selectedProfileId);
                if (profile) {
                    currentProfile = profile;
                    await loadAllConfiguration();
                }
            }
        });
    }
    
    // Output units change
    const outputUnits = document.getElementById('outputUnits');
    if (outputUnits) {
        outputUnits.addEventListener('change', (e) => {
            // Save the units selection to the current profile
            if (currentProfile) {
                saveOutputUnitsToProfile(e.target.value);
            }
        });
    }
    
    // Profile management buttons
    const newProfileBtn = document.getElementById('newProfileBtn');
    if (newProfileBtn) {
        newProfileBtn.addEventListener('click', () => {
            showInfo('New profile functionality coming soon');
        });
    }
    
    const copyProfileBtn = document.getElementById('copyProfileBtn');
    if (copyProfileBtn) {
        copyProfileBtn.addEventListener('click', () => {
            showInfo('Copy profile functionality coming soon');
        });
    }
    
    const deleteProfileBtn = document.getElementById('deleteProfileBtn');
    if (deleteProfileBtn) {
        deleteProfileBtn.addEventListener('click', () => {
            if (currentProfile && confirm(`Are you sure you want to delete profile "${currentProfile.name}"?`)) {
                showInfo('Delete profile functionality coming soon');
            }
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadAvailableProfiles();
            await loadCurrentProfile();
            await loadAllConfiguration();
            showSuccess('Configuration refreshed');
        });
    }
    
    // Tool refresh button
    const refreshToolsBtn = document.getElementById('refreshToolsBtn');
    if (refreshToolsBtn) {
        refreshToolsBtn.addEventListener('click', async () => {
            await loadTools();
            showSuccess('Tools refreshed');
        });
    }
    
    // Edit tools button
    const editToolsBtn = document.getElementById('editToolsBtn');
    if (editToolsBtn) {
        editToolsBtn.addEventListener('click', () => {
            // This would open a tool editor modal
            showInfo('Tool editor functionality coming soon');
        });
    }
    
    // Cutting priority controls
    const addToPriority = document.getElementById('addToPriority');
    if (addToPriority) {
        addToPriority.addEventListener('click', () => {
            // Add selected available item to priority order
            showInfo('Add to priority functionality coming soon');
        });
    }
    
    const removeFromPriority = document.getElementById('removeFromPriority');
    if (removeFromPriority) {
        removeFromPriority.addEventListener('click', () => {
            // Remove selected priority item
            showInfo('Remove from priority functionality coming soon');
        });
    }
    
    const insertBreak = document.getElementById('insertBreak');
    if (insertBreak) {
        insertBreak.addEventListener('click', () => {
            // Insert manual break in priority order
            showInfo('Insert break functionality coming soon');
        });
    }
    
    // Line type mapping controls
    const addLineTypeBtn = document.getElementById('addLineTypeBtn');
    if (addLineTypeBtn) {
        addLineTypeBtn.addEventListener('click', () => {
            showInfo('Add line type functionality coming soon');
        });
    }
    
    const autoMapBtn = document.getElementById('autoMapBtn');
    if (autoMapBtn) {
        autoMapBtn.addEventListener('click', () => {
            showInfo('Auto map functionality coming soon');
        });
    }
    
    const clearMappingsBtn = document.getElementById('clearMappingsBtn');
    if (clearMappingsBtn) {
        clearMappingsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all line type mappings?')) {
                currentMappings = [];
                displayLineTypeMappings();
                showSuccess('All mappings cleared');
            }
        });
    }
    
    // File output controls
    const browsePathBtn = document.getElementById('browsePathBtn');
    if (browsePathBtn) {
        browsePathBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.showDirectoryDialog();
                if (result && result.filePaths && result.filePaths.length > 0) {
                    const defaultSavePath = document.getElementById('defaultSavePath');
                    if (defaultSavePath) {
                        defaultSavePath.value = result.filePaths[0];
                    }
                }
            } catch (error) {
                console.error('Error browsing for path:', error);
                showError('Failed to browse for path');
            }
        });
    }
    
    const clearPathBtn = document.getElementById('clearPathBtn');
    if (clearPathBtn) {
        clearPathBtn.addEventListener('click', () => {
            const defaultSavePath = document.getElementById('defaultSavePath');
            if (defaultSavePath) {
                defaultSavePath.value = '';
            }
        });
    }
    
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            
            // Remove active class from all buttons and content
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            e.target.classList.add('active');
            const targetContent = document.getElementById(targetTab + 'Tab');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
    
    // Real-time preview updates
    const headerTemplate = document.getElementById('headerTemplate');
    if (headerTemplate) {
        headerTemplate.addEventListener('input', updateHeaderPreview);
    }
    
    const initialCommands = document.getElementById('initialCommands');
    if (initialCommands) {
        initialCommands.addEventListener('input', updateHeaderPreview);
    }
}

function showSuccess(message) {
    console.log('Success:', message);
    // You could add a more sophisticated notification system here
}

function showError(message) {
    console.error('Error:', message);
    // You could add a more sophisticated notification system here
}

function showInfo(message) {
    console.log('Info:', message);
    // You could add a more sophisticated notification system here
}

// Export functions for potential use by other modules
window.outputManager = {
    loadAvailableProfiles,
    loadCurrentProfile,
    loadProfileConfiguration,
    populateConfigurationFields,
    saveOutputUnitsToProfile,
    loadTools,
    loadLineTypeMappings,
    loadCuttingPriority,
    loadHeaderFooterConfig,
    loadOutputSettings
};
