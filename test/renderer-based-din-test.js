/**
 * Test for Renderer-Based DIN Generation
 * 
 * This test verifies that the new renderer-based DIN generator
 * correctly processes unified geometry objects and generates valid DIN files.
 */

const { RendererBasedDinGenerator } = require('../src/RendererBasedDinGenerator.js');

// Test configuration
const testConfig = {
    lineNumbers: { startNumber: 10 },
    units: { system: 'mm' },
    outputSettings: {
        enableBridges: true
    }
};

// Test metadata
const testMetadata = {
    filename: 'test.dxf',
    fileUnits: 'in',
    width: 10,
    height: 8
};

// Test geometries (simulating what the renderer successfully draws)
const testGeometries = [
    // Simple line
    {
        type: 'LINE',
        start: { x: 0, y: 0 },
        end: { x: 5, y: 5 },
        bridgeCount: 2,
        bridgeWidth: 0.1
    },
    // Simple arc
    {
        type: 'ARC',
        center: { x: 2, y: 2 },
        start: { x: 1, y: 2 },
        end: { x: 3, y: 2 },
        radius: 1
    },
    // Full circle
    {
        type: 'ARC',
        center: { x: 5, y: 5 },
        start: { x: 4, y: 5 },
        end: { x: 4, y: 5 }, // Same as start = full circle
        radius: 1
    }
];

function runTest() {
    console.log('🧪 Testing Renderer-Based DIN Generation');
    console.log('==========================================');
    
    try {
        // Create generator instance
        const generator = new RendererBasedDinGenerator();
        
        // Generate DIN content
        console.log('Generating DIN content...');
        const dinContent = generator.generateDin(testGeometries, testConfig, testMetadata);
        
        // Validate output
        console.log('\n✅ DIN Generation Successful!');
        console.log('Content length:', dinContent.length);
        console.log('\nGenerated DIN content:');
        console.log('------------------------');
        console.log(dinContent);
        
        // Basic validation
        const lines = dinContent.split('\n');
        const hasHeader = lines.some(line => line.includes('G21')); // Metric units
        const hasFooter = lines.some(line => line.includes('M30')); // Program end
        const hasLineCommands = lines.some(line => line.includes('G01')); // Line cuts
        const hasArcCommands = lines.some(line => line.includes('G02')); // Arc cuts
        
        console.log('\n📊 Validation Results:');
        console.log('Has header (G21):', hasHeader);
        console.log('Has footer (M30):', hasFooter);
        console.log('Has line commands (G01):', hasLineCommands);
        console.log('Has arc commands (G02):', hasArcCommands);
        
        if (hasHeader && hasFooter && hasLineCommands && hasArcCommands) {
            console.log('\n🎉 All validation checks passed!');
            return true;
        } else {
            console.log('\n❌ Some validation checks failed!');
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the test
if (require.main === module) {
    const success = runTest();
    process.exit(success ? 0 : 1);
}

module.exports = { runTest };
