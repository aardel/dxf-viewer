// Output Manager Window JavaScript
// Handles profile loading, configuration management, and settings

let currentProfile = null;
let availableProfiles = [];

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
        
    } catch (error) {
        console.error('Error initializing Output Manager:', error);
        showError('Failed to initialize Output Manager');
    }
}

async function loadAvailableProfiles() {
    try {
        // Get available XML profiles from the main process
        const profiles = await window.electronAPI.loadXmlProfiles();
        availableProfiles = profiles || [];
        
        // Populate profile dropdown
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
        // Get current profile from main process
        const profile = await window.electronAPI.getCurrentProfile();
        currentProfile = profile;
        
        if (profile) {
            // Select the current profile in dropdown
            const profileSelect = document.getElementById('profileSelect');
            if (profileSelect) {
                profileSelect.value = profile.id || profile.name;
            }
            
            // Load profile configuration
            await loadProfileConfiguration(profile);
        }
        
    } catch (error) {
        console.error('Error loading current profile:', error);
        showError('Failed to load current profile');
    }
}

async function loadProfileConfiguration(profile) {
    try {
        // Get postprocessor configuration for the profile
        const config = await window.electronAPI.loadPostprocessorConfig(profile.id || profile.name);
        
        if (config) {
            // Populate the configuration fields
            populateConfigurationFields(config);
        }
        
    } catch (error) {
        console.error('Error loading profile configuration:', error);
        showError('Failed to load profile configuration');
    }
}

function populateConfigurationFields(config) {
    // Profile settings
    const unitsSelect = document.getElementById('outputUnits');
    if (unitsSelect && config.units) {
        unitsSelect.value = config.units;
    }
    
    const scaleCommandInput = document.getElementById('scaleCommand');
    if (scaleCommandInput && config.scaleCommand) {
        scaleCommandInput.value = config.scaleCommand;
    }
    
    const lineNumbersCheckbox = document.getElementById('includeLineNumbers');
    if (lineNumbersCheckbox) {
        lineNumbersCheckbox.checked = config.includeLineNumbers !== false;
    }
    
    // File output settings
    const savePathInput = document.getElementById('defaultSavePath');
    if (savePathInput && config.defaultSavePath) {
        savePathInput.value = config.defaultSavePath;
    }
    
    const filenameTemplateInput = document.getElementById('filenameTemplate');
    if (filenameTemplateInput && config.filenameTemplate) {
        filenameTemplateInput.value = config.filenameTemplate;
    }
    
    // Optimization settings
    const optimizationSelect = document.getElementById('optimizationStrategy');
    if (optimizationSelect && config.optimizationStrategy) {
        optimizationSelect.value = config.optimizationStrategy;
    }
    
    const bridgesCheckbox = document.getElementById('enableBridges');
    if (bridgesCheckbox) {
        bridgesCheckbox.checked = config.enableBridges !== false;
    }
    
    // Validation settings
    const validateWidthsCheckbox = document.getElementById('validateWidths');
    if (validateWidthsCheckbox) {
        validateWidthsCheckbox.checked = config.validateWidths !== false;
    }
    
    const includeCommentsCheckbox = document.getElementById('includeComments');
    if (includeCommentsCheckbox) {
        includeCommentsCheckbox.checked = config.includeComments !== false;
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
                    await loadProfileConfiguration(profile);
                }
            }
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadAvailableProfiles();
            await loadCurrentProfile();
            showSuccess('Profiles refreshed');
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
}

function showSuccess(message) {
    // Simple success notification
    console.log('Success:', message);
    // You could add a more sophisticated notification system here
}

function showError(message) {
    // Simple error notification
    console.error('Error:', message);
    // You could add a more sophisticated notification system here
}

// Export functions for potential use by other modules
window.outputManager = {
    loadAvailableProfiles,
    loadCurrentProfile,
    loadProfileConfiguration,
    populateConfigurationFields
};
