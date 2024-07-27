const fs = require('fs');
const path = require('path');

function parseZimp(fileContent, basePath) {
    const variables = [];
    const functions = [];
    let render = '';
    let imports = [];
    let components = [];
    let errors = [];
    let ifElse = [];

    let insideFunction = false;
    let functionWhitespace = 0;
    let functionStack = [];

    let insideIfElse = false;
    let IfElseCondition = false;
    let ifElseStack = [];
    let currentIndentation = 0;
    let conditionId = 0;

    const fileLines = fileContent.split('\n');

    function flipSignsAndEquality(str) {
        let tempStr = str
        .replace(/<=/g, '__TEMP_LESS_THAN_EQUAL__')
        .replace(/>=/g, '__TEMP_GREATER_THAN_EQUAL__')
        .replace(/</g, '__TEMP_LESS_THAN__')
        .replace(/>/g, '__TEMP_GREATER_THAN__');
    
        // Replace != and == with temporary placeholders
        tempStr = tempStr
            .replace(/!=/g, '__TEMP_NOT_EQUAL__')
            .replace(/==/g, '__TEMP_EQUAL__');
        
        // Replace the placeholders for <= with >
        tempStr = tempStr.replace(/__TEMP_LESS_THAN_EQUAL__/g, '>');
        
        // Replace the placeholders for >= with <
        tempStr = tempStr.replace(/__TEMP_GREATER_THAN_EQUAL__/g, '<');
        
        // Replace the placeholders for < and > with their flipped versions
        tempStr = tempStr
            .replace(/__TEMP_LESS_THAN__/g, '>')
            .replace(/__TEMP_GREATER_THAN__/g, '<');
        
        // Replace the placeholders for != and == with their flipped versions
        tempStr = tempStr
            .replace(/__TEMP_NOT_EQUAL__/g, '==')
            .replace(/__TEMP_EQUAL__/g, '!=');
        
        return tempStr;
    }    

    for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i];
        try {
            // if else
            if (insideIfElse) {
                const ifWhitespaceCount = (line.match(/^\s*/) || [""])[0].length;
                if (ifWhitespaceCount >= currentIndentation) {
                    currentIndentation = ifWhitespaceCount
                    ifElseStack[3] += line;
                }
                else {
                    ifElse.push({ keyword: ifElseStack[0], condition: ifElseStack[1], conditionId: ifElseStack[2], body: ifElseStack[3], line: ifElseStack[4] });
                    ifElseStack = [];
                    insideIfElse = false;
                    currentIndentation = 0;
                }
            }

            if (line.replace(/ /g,'').slice(0, 2) === "if" || line.replace(/ /g,'').slice(0, 7) === "else if" || line.replace(/ /g,'').slice(0, 4) === "else") {
                const parts = line.trimStart().split(' ');
                let keyword, condition = '';
                if (parts[0] == "else" && parts[1] == "if") {
                    keyword = "else if";
                    condition = parts.slice(2).join(' ').slice(0, -1);
                }
                else if (parts[0] == "else:") {
                    keyword = "else";
                    condition = ifElse[conditionId-1].condition;
                    condition = flipSignsAndEquality(condition);
                }
                else {
                    keyword = parts[0];
                    condition = parts.slice(1).join(' ').slice(0, -1);
                }
                insideIfElse = true;
                IfElseCondition = true;
                ifElseStack.push(keyword);
                ifElseStack.push(condition);
                ifElseStack.push(conditionId);
                ifElseStack.push('');
                ifElseStack.push(i+1);
                conditionId++;
            }
            // Process newRender
            if (line.replace(/ /g,'').slice(0, 1) == "<" && line.replace(/ /g,'').slice(-1) == ">" && !insideIfElse) {
                render += `${line}\n`;
            }
            else if (insideIfElse && IfElseCondition) {
                render += `${ifElseStack[0]} block/${ifElseStack[2]}\n`;
                IfElseCondition = false;
            }
            // Process imports
            if (line.includes("from") && line.includes("import")) {
                const import_elements = line.split(' ');
                import_elements[1] = import_elements[1].replace(/['"]+/g, '');
                const importPath = path.resolve(basePath, import_elements[1]);
                if (fs.existsSync(importPath)) {
                    const importedContent = fs.readFileSync(importPath, 'utf-8');
                    const parsedImport = parseZimp(importedContent, path.dirname(importPath));
                    imports.push({ name: import_elements[3], content: parsedImport });
                } else {
                    errors.push({ line: i + 1, message: `Import path not found: ${importPath}` });
                }
            }
            // Process components
            if (line.includes("<:3") && line.includes(":3>")) {
                const result = {
                    Component: '',
                    props: {}
                };

                const catStr = line.replace('<:3', '').replace(':3>', '').trim();

                const firstSpaceIndex = catStr.indexOf(' ');
                if (catStr.includes(" ")) {
                    result.Component = catStr.substring(0, firstSpaceIndex);
                    const propsString = catStr.substring(firstSpaceIndex + 1).trim();

                    let currentIndex = 0;
                    while (currentIndex < propsString.length) {
                        const equalsIndex = propsString.indexOf('=', currentIndex);
                        if (equalsIndex === -1) break;

                        const key = propsString.substring(currentIndex, equalsIndex).trim();
                
                        const quoteIndex = propsString.indexOf('"', equalsIndex);
                        const endQuoteIndex = propsString.indexOf('"', quoteIndex + 1);
                        const value = propsString.substring(quoteIndex + 1, endQuoteIndex);
                
                        result.props[key] = value;
                
                        currentIndex = endQuoteIndex + 1;
                        while (propsString[currentIndex] === ' ') currentIndex++;
                    }
                }
                else {
                    result.Component = catStr;
                }
                components.push({ name: result.Component, props: result.props });
            }
            // Process functions
            if (insideFunction) {
                const funcWhitespaceCount = (line.match(/^\s*/) || [""])[0].length;
                if (funcWhitespaceCount >= functionWhitespace) {
                    if (functionStack.length == 2) {
                        functionWhitespace = funcWhitespaceCount;
                        functionStack.push(line);
                    }
                    else {
                        functionStack[2] += line;
                    }
                }
                else {
                    functions.push({ name: functionStack[0], params: functionStack[1], body: functionStack[2] });
                    functionStack = [];
                    insideFunction = false;
                    functionWhitespace = 0;
                }
            }
            if (line.replace(/ /g,'').slice(0, 3) === "fun") {
                if (line.slice(-1) != ":") {
                    errors.push({ line: i + 1, message: `Function declaration must end with a colon` });
                }
                const cleanedInput = line.replace(":", "");
                functionStack = cleanedInput.split(/[\s()]+/);
                if (functionStack.length != 3) {
                    functionStack.pop();
                }
                functionStack.shift();
                insideFunction = true;
            }
            // Process variables
            if (!line.includes("=") || line.includes("+") || line.includes("<") || line.includes(">") || line.includes("==") || line.includes("!=") || line.includes("++") || line.includes("--") || line.includes("&&") || line.includes("||") || line.includes("===") || line.includes("!==") || line.includes("<=") || line.includes(">=")) {
                continue;
            }

            const processLine = (line) => {
                let result = [];
                if (line.includes(":")) {
                    let parts = line.replace(/\s+/g, '').split('=');
                    let keyAndType = parts[0].split(':');
                    let value = parts[1];
                    result = [...keyAndType, value];
                } else {
                    result = line.replace(/\s+/g, '').split('=');
                }
                return result;
            };

            let result;
            if (line.slice(0, 4) === "prop") {
                result = processLine(line.slice(5));
                if (result.length === 3) {
                    variables.push({ type: result[1], name: result[0], value: result[2] });
                }
                else if (result.length === 2) {
                    variables.push({ type: 'unknown', name: result[0], value: result[1] });
                }
            } else {
                result = processLine(line);
                if (result.length === 3) {
                    variables.push({ type: result[1], name: result[0], value: result[2] });
                }
                else if (result.length === 2) {
                    variables.push({ type: 'unknown', name: result[0], value: result[1] });
                }
            }
        } catch (err) {
            errors.push({ line: i + 1, message: `Error processing line: ${err.message}` });
        }
    }

    function flipSignsAndEquality(str) {
        let tempStr = str
            .replace(/<=/g, '__TEMP_LESS_THAN_EQUAL__')
            .replace(/>=/g, '__TEMP_GREATER_THAN_EQUAL__')
            .replace(/</g, '__TEMP_LESS_THAN__')
            .replace(/>/g, '__TEMP_GREATER_THAN__');
        
        tempStr = tempStr
            .replace(/!=/g, '__TEMP_NOT_EQUAL__')
            .replace(/==/g, '__TEMP_EQUAL__');
        
        tempStr = tempStr.replace(/__TEMP_LESS_THAN_EQUAL__/g, '>');
        
        tempStr = tempStr.replace(/__TEMP_GREATER_THAN_EQUAL__/g, '<');
        
        tempStr = tempStr
            .replace(/__TEMP_LESS_THAN__/g, '>')
            .replace(/__TEMP_GREATER_THAN__/g, '<');
        
        tempStr = tempStr
            .replace(/__TEMP_NOT_EQUAL__/g, '==')
            .replace(/__TEMP_EQUAL__/g, '!=');
        
        return tempStr;
    }

    return { variables, functions, render, imports, components, errors, ifElse };
}

module.exports = parseZimp;