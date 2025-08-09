
const helpers = require("../ParseHelpers.js");

function EntityParser() {}

EntityParser.ForEntityName = 'LINE';

EntityParser.prototype.parseEntity = function(scanner, curr) {
    var entity = { type: curr.value };
    curr = scanner.next();
    while(curr !== 'EOF') {
        if(curr.code === 0) break;

        switch(curr.code) {
        case 10: // Start point (X, Y, Z)
            entity.start = helpers.parsePoint(scanner);
            break;
        case 11: // End point (X, Y, Z)
            entity.end = helpers.parsePoint(scanner);
            break;
        case 210:
            entity.extrusionDirection = helpers.parsePoint(scanner);
            break;
        case 100:
            break;
        default:
            helpers.checkCommonEntityProperties(entity, curr, scanner);
            break;
        }

        curr = scanner.next();
    }
    return entity;
};

module.exports = EntityParser;
