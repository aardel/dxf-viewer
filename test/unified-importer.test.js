// Test for UnifiedImporter with DDS, DXF, and CF2
const fs = require('fs');
const path = require('path');
const { UnifiedImporter } = require('../src/parsers');

describe('UnifiedImporter', () => {
    it('parses DDS files to unified geometry', () => {
        const ddsContent = 'LINE 0.0 0.0 1.0 1.0 100 0.02 2 0.05\nARC 1.0 1.0 2.0 2.0 1.5 1.5 0.5 101 0.02 1 0.05';
        const result = UnifiedImporter.import(ddsContent, 'test.dds');
        expect(result.length).toBe(2);
        expect(result[0].type).toBe('LINE');
        expect(result[1].type).toBe('ARC');
        expect(result[0].bridgeCount).toBe(2);
    });

    it('parses DXF files to unified geometry', () => {
        // Minimal DXF content for a line entity
        const dxfContent = '0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0.0\n20\n0.0\n11\n1.0\n21\n1.0\n0\nENDSEC\n0\nEOF';
        const result = UnifiedImporter.import(dxfContent, 'test.dxf');
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].type).toBe('LINE');
    });

    it('parses CF2 files to unified geometry (stub)', () => {
        const cf2Content = '...';
        const result = UnifiedImporter.import(cf2Content, 'test.cf2');
        expect(Array.isArray(result)).toBe(true);
    });
});
