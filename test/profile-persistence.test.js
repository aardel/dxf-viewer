const fs = require('fs');
const path = require('path');

// Simple test to verify profile persistence functionality
function testProfilePersistence() {
    console.log('🧪 Testing Profile Persistence Functionality...\n');
    
    // Test 1: Check if localStorage is available (browser environment)
    if (typeof localStorage !== 'undefined') {
        console.log('✅ localStorage is available');
        
        // Test saving and loading profile preference
        const testProfile = 'pts.xml';
        localStorage.setItem('lastSelectedProfile', testProfile);
        
        const loadedProfile = localStorage.getItem('lastSelectedProfile');
        if (loadedProfile === testProfile) {
            console.log('✅ Profile preference saved and loaded correctly:', loadedProfile);
        } else {
            console.log('❌ Profile preference not saved/loaded correctly');
        }
        
        // Clean up
        localStorage.removeItem('lastSelectedProfile');
    } else {
        console.log('⚠️  localStorage not available (Node.js environment)');
    }
    
    // Test 2: Check if active_profile.txt file can be created
    const testDir = path.join(__dirname, '..', 'CONFIG', 'profiles');
    const testFile = path.join(testDir, 'active_profile.txt');
    
    try {
        // Ensure directory exists
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        // Write test profile
        const testProfileName = 'test_profile.xml';
        fs.writeFileSync(testFile, testProfileName, 'utf8');
        
        // Read back
        const readProfile = fs.readFileSync(testFile, 'utf8').trim();
        
        if (readProfile === testProfileName) {
            console.log('✅ Active profile file created and read correctly:', readProfile);
        } else {
            console.log('❌ Active profile file not written/read correctly');
        }
        
        // Clean up
        fs.unlinkSync(testFile);
        
    } catch (error) {
        console.log('❌ Error testing active profile file:', error.message);
    }
    
    console.log('\n🎯 Profile Persistence Test Complete!');
}

// Run the test if this file is executed directly
if (require.main === module) {
    testProfilePersistence();
}

module.exports = { testProfilePersistence };
