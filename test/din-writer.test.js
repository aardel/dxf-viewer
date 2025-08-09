// Test for DinWriter bridge splitting logic
const { Line } = require('../src/core/Geometry');
const DinWriter = require('../src/writers/DinWriter');

describe('DinWriter', () => {
    it('outputs a single line with no bridges', () => {
        const line = new Line({ start: {x:0, y:0}, end: {x:10, y:0}, color: 1, kerfWidth: 0.02 });
        const result = DinWriter.export([line], { outputBridges: true });
        expect(result).toMatch(/LINE 0.000000 0.000000 10.000000 0.000000 1 0.02 0 0/);
    });
    it('splits line into segments for bridges', () => {
        const line = new Line({ start: {x:0, y:0}, end: {x:10, y:0}, color: 1, kerfWidth: 0.02, bridgeCount: 2, bridgeWidth: 1 });
        const result = DinWriter.export([line], { outputBridges: true });
        // Should output 3 cut segments (bridgeCount+1)
        const lines = result.split('\n').filter(l => l.startsWith('LINE'));
        expect(lines.length).toBe(3);
        expect(lines[0]).toMatch(/LINE 0.000000 0.000000 2.666667 0.000000 1 0.02 0 0/);
        expect(lines[1]).toMatch(/LINE 3.666667 0.000000 6.333333 0.000000 1 0.02 0 0/);
        expect(lines[2]).toMatch(/LINE 7.333333 0.000000 10.000000 0.000000 1 0.02 0 0/);
    });
    it('outputs full line with bridge fields if outputBridges is false', () => {
        const line = new Line({ start: {x:0, y:0}, end: {x:10, y:0}, color: 1, kerfWidth: 0.02, bridgeCount: 2, bridgeWidth: 1 });
        const result = DinWriter.export([line], { outputBridges: false });
        expect(result).toMatch(/LINE 0.000000 0.000000 10.000000 0.000000 1 0.02 2 1/);
    });
});
