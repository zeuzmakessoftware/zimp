const parseZimp = require('./parser');
const compileToJavaScript = require('./compiler');
const fs = require('fs');
const path = require('path');

function compileZimpFile(filePath) {
    const basePath = path.dirname(filePath);
    const zimpContent = fs.readFileSync(filePath, 'utf-8');
    const parsedZimp = parseZimp(zimpContent, basePath);
    return compileToJavaScript(parsedZimp);
}

module.exports = {
    compileZimpFile
};