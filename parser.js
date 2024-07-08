const fs = require('fs');
const path = require('path');

function parseZimp(fileContent, basePath) {
    const importPattern = /from\s+['"]([^'"]+)['"]\s+import\s+(\w+)/g;
    const varPattern = /(\w+)(:\s*(\w+))?\s*=\s*("[^"]*"|\d+)/g;
    const untypedVarPattern = /^(\w+)\s*=\s*("[^"]*"|\d+)/gm;
    const funPattern = /fun\s+(\w+)\(([^)]*)\):\s*([\s\S]+?)(?=\n\n|$)/g;
    const renderPattern = /(<[\s\S]+)$/m;
    const componentPattern = /<:3\s*(\w+)\s*([^:3]*)\s*:3>/g;

    const variables = [];
    const functions = [];
    let render = '';
    let imports = [];
    let components = [];

    function throwError(message, line) {
        throw new Error(`Parse Error: ${message} at line ${line}`);
    }

    function checkLinePattern(pattern, content, errorMessage) {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            if (pattern.test(line)) {
                throwError(errorMessage, index + 1);
            }
        });
    }

    function isReservedKeyword(word) {
        const reservedKeywords = ['class', 'onClick', 'id'];
        return reservedKeywords.includes(word);
    }

    //checkLinePattern(/^\S+\s+:/, fileContent, 'Incorrect variable declaration spacing');
    //checkLinePattern(/fun\s+\w+\s+\(/, fileContent, 'Incorrect function declaration spacing');

    let match;

    while ((match = importPattern.exec(fileContent)) !== null) {
        const importPath = path.resolve(basePath, match[1]);
        const componentName = match[2];
        if (fs.existsSync(importPath)) {
            const importedContent = fs.readFileSync(importPath, 'utf-8');
            const parsedImport = parseZimp(importedContent, path.dirname(importPath));
            imports.push({ name: componentName, content: parsedImport });
        } else {
            console.error(`Import path not found: ${importPath}`);
        }
    }

    while ((match = varPattern.exec(fileContent)) !== null) {
        if (!isReservedKeyword(match[1])) {
            variables.push({ type: match[3] || 'unknown', name: match[1], value: match[4] });
        }
    }

    while ((match = untypedVarPattern.exec(fileContent)) !== null) {
        if (!variables.some(v => v.name === match[1]) && !isReservedKeyword(match[1])) {
            variables.push({ type: 'unknown', name: match[1], value: match[2] });
        }
    }

    while ((match = funPattern.exec(fileContent)) !== null) {
        functions.push({ name: match[1], params: match[2], body: match[3] });
    }

    if ((match = renderPattern.exec(fileContent)) !== null) {
        render = match[1];
    }

    while ((match = componentPattern.exec(fileContent)) !== null) {
        const componentName = match[1];
        const props = {};
        const propsPattern = /(\w+)=["']([^"']+)["']/g;
        let propMatch;
        while ((propMatch = propsPattern.exec(match[2])) !== null) {
            if (!isReservedKeyword(propMatch[1])) {
                props[propMatch[1]] = propMatch[2];
            }
        }
        components.push({ name: componentName, props });
    }

    return { variables, functions, render, imports, components };
}

module.exports = parseZimp;