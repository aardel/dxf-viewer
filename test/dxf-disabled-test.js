import fs from 'fs';
import path from 'path';
import UnifiedImporter from '../src/parsers/UnifiedImporter.js';

console.log('=== Testing DXF Loading Disabled ===');

// Test with a dummy DXF content
const dummyDxfContent = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1014
0
ENDSEC
0
EOF`;

console.log('\n--- Testing DXF file loading ---');
try {
    const result = await UnifiedImporter.import(dummyDxfContent, 'test.dxf');
    console.log('❌ FAILED: DXF file was loaded successfully when it should be blocked');
    console.log('Result:', result);
} catch (error) {
    console.log('✅ SUCCESS: DXF file loading was properly blocked');
    console.log('Error message:', error.message);
}

// Test with DDS file (should work)
console.log('\n--- Testing DDS file loading (should work) ---');
const dummyDdsContent = `DDS V1.0
1,0,0,1,0
2,0,0,2,0
3,0,0,3,0`;

try {
    const result = await UnifiedImporter.import(dummyDdsContent, 'test.dds');
    console.log('✅ SUCCESS: DDS file loaded successfully');
    console.log('Result length:', result.length);
} catch (error) {
    console.log('❌ FAILED: DDS file loading failed when it should work');
    console.log('Error message:', error.message);
}

// Test with CF2 file (should work)
console.log('\n--- Testing CF2 file loading (should work) ---');
const dummyCf2Content = `$BOF
V2
MAIN,DESIGN
LL,0.000,0.000
UR,1.000,1.000
SCALE,1,1
L,1,1,0,0.0,0.0,1.0,1.0,0,0.0000
END
$EOF`;

try {
    const result = await UnifiedImporter.import(dummyCf2Content, 'test.cf2');
    console.log('✅ SUCCESS: CF2 file loaded successfully');
    console.log('Result length:', result.length);
} catch (error) {
    console.log('❌ FAILED: CF2 file loading failed when it should work');
    console.log('Error message:', error.message);
}

console.log('\n=== Test Summary ===');
console.log('DXF loading should be disabled and show appropriate error message');
console.log('DDS and CF2 loading should work normally');
