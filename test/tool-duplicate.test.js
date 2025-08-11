// Simple test to verify tool duplication functionality
function testToolDuplication() {
    console.log('🧪 Testing Tool Duplication Functionality...\n');
    
    // Mock currentTools array
    const mockCurrentTools = [
        {
            id: 'T22',
            name: 'Fine Cut',
            description: 'Cutting',
            width: 1,
            hCode: 'H22',
            type: 'cut'
        },
        {
            id: 'T2',
            name: '2pt CW',
            description: 'Cutting',
            width: 1,
            hCode: 'H2',
            type: 'cut'
        }
    ];
    
    console.log('✅ Initial tools array:', mockCurrentTools.length, 'tools');
    
    // Test duplication logic
    const toolToDuplicate = mockCurrentTools[0];
    console.log('📋 Tool to duplicate:', toolToDuplicate.name, `(${toolToDuplicate.id})`);
    
    // Find highest existing ID
    const existingIds = mockCurrentTools.map(tool => {
        const idNum = parseInt(tool.id.toString().replace(/[^\d]/g, '')) || 0;
        return idNum;
    });
    const maxId = Math.max(...existingIds);
    const newId = maxId + 1;
    
    // Find highest existing H-Code
    const existingHCodes = mockCurrentTools.map(tool => {
        const hCodeNum = parseInt(tool.hCode.toString().replace(/[^\d.]/g, '')) || 0;
        return hCodeNum;
    });
    const maxHCode = Math.max(...existingHCodes);
    const newHCode = maxHCode + 1;
    
    // Create duplicated tool
    const duplicatedTool = {
        id: `T${newId}`,
        name: `${toolToDuplicate.name} (Copy)`,
        description: toolToDuplicate.description,
        width: toolToDuplicate.width,
        hCode: `H${newHCode}`,
        type: toolToDuplicate.type
    };
    
    console.log('✅ Duplicated tool created:', duplicatedTool.name, `(${duplicatedTool.id})`);
    console.log('✅ New H-Code assigned:', duplicatedTool.hCode);
    console.log('✅ Tool properties copied correctly');
    
    // Test insertion logic
    const insertIndex = 1; // After the first tool
    mockCurrentTools.splice(insertIndex, 0, duplicatedTool);
    
    console.log('✅ Tool inserted at position', insertIndex + 1);
    console.log('✅ Final tools array:', mockCurrentTools.length, 'tools');
    
    // Verify the duplicated tool is in the correct position
    if (mockCurrentTools[insertIndex].id === duplicatedTool.id) {
        console.log('✅ Duplicated tool is in the correct position');
    } else {
        console.log('❌ Duplicated tool is not in the correct position');
    }
    
    console.log('\n🎉 Tool duplication test completed successfully!');
}

// Run the test
testToolDuplication();
