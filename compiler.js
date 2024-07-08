function compileToJavaScript(parsedZimp, componentName = 'App', existingVariables = new Set()) {
    let jsCode = '';

    parsedZimp.imports.forEach(imported => {
        jsCode += compileToJavaScript(imported.content, imported.name, existingVariables);
        jsCode += `const ${imported.name} = render${imported.name};\n`;
    });

    parsedZimp.variables.forEach(variable => {
        if (!existingVariables.has(variable.name)) {
            let variableValue = variable.value;
            jsCode += `let ${variable.name} = ${variableValue};\n`;
            existingVariables.add(variable.name);
        }
    });

    // Handle functions and attach them to the global scope
    parsedZimp.functions.forEach(func => {
        jsCode += `function ${func.name}(${func.params}) {\n${func.body}\nrender();\n}\n`;
        jsCode += `window.${func.name} = ${func.name};\n`; // Attach to global scope
    });

    // Handle rendering
    jsCode += `
function render${componentName}(props = {}) {
    return \`
    ${parsedZimp.render
        .replace(/:3\s*(\w+)\s*:3/g, (match, p1) => `\${props.${p1} !== undefined ? props.${p1} : ${p1}}`)
        .replace(/\n/g, '')
        .replace(/onClick="(\w+)"/g, 'onclick="$1()"')
        .replace(/<:3\s*(\w+)\s*([^:3]*)\s*:3>/g, (match, p1, p2) => {
            const props = {};
            const propsPattern = /(\w+)=["']([^"']+)["']/g;
            let propMatch;
            while ((propMatch = propsPattern.exec(p2)) !== null) {
                props[propMatch[1]] = propMatch[2];
            }
            const propString = JSON.stringify(props).replace(/"(\w+)":/g, '$1:');
            return `\${${p1}(${propString})}`;
        }) // Handle flexible component tags with props
        .trim()}
    \`;
}\n`;

    // If it's the main component, attach the main render function
    if (componentName === 'App') {
        jsCode += `
function render() {
    const app = document.getElementById('app');
    app.innerHTML = renderApp();
}

document.addEventListener('DOMContentLoaded', () => {
    render();
});
`;
    }


    return jsCode;
}

module.exports = compileToJavaScript;
