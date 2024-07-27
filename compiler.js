function compileToJavaScript(parsedZimp, componentName = 'App', existingVariables = new Set(), isRoot = true) {
    let jsCode = '';
    const isError = parsedZimp.errors.length > 0;

    if (isRoot) {
        jsCode += `
function renderErrors(errors) {
    if (!errors || errors.length === 0) return '';
    return \`
    <style>
        .error-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #691c17;
        }
        .error-box {
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .error-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #dc3545;
            margin-bottom: 16px;
        }
        .error-list {
            list-style-type: disc;
            padding-left: 20px;
        }
        .error-item {
            color: #333333;
            margin-bottom: 8px;
        }
        .error-item strong {
            display: block;
            margin-bottom: 4px;
        }
    </style>
    <div class="error-container">
        <div class="error-box">
            <h2 class="error-title">Errors Found:</h2>
            <ul class="error-list">\${errors.map(error => \`
                <li class="error-item">
                    <strong>Error at line \${error.line}:</strong> \${error.message}
                </li>\`).join('')}
            </ul>
        </div>
    </div>\`;
}\n`;
    }

    parsedZimp.imports.forEach(imported => {
        jsCode += compileToJavaScript(imported.content, imported.name, existingVariables, false);
        jsCode += `const ${imported.name} = render${imported.name};\n`;
    });

    parsedZimp.variables.forEach(variable => {
        if (!existingVariables.has(variable.name)) {
            let variableValue = variable.value;
            jsCode += `let ${variable.name} = ${variableValue};\n`;
            existingVariables.add(variable.name);
        }
    });

    parsedZimp.functions.forEach(func => {
        jsCode += `function ${func.name}(${func.params}) {\n${func.body}\nrender();\n}\n`;
        jsCode += `window.${func.name} = ${func.name};\n`;
    });

    const renderBody = parsedZimp.render.split('\n').map(line => {
        if (line.match(/if\s+block\/\d+|else\s+block\/\d+/)) {
            const parts = line.split('/');
            return `\${${parsedZimp.ifElse[parts[1]].condition} ? '${parsedZimp.ifElse[parts[1]].body}' : ''}`;
        } else if (line.match(/onClick="(\w+)"/)) {
            return line.replace(/onClick="(\w+)"/g, 'onclick="$1()"');
        } else if (line.match(/<:3\s*(\w+)\s*([^:3]*)\s*:3>/)) {
            return line.replace(/<:3\s*(\w+)(.*?)\s*:3>/g, (match, p1, p2) => {
                const props = {};
                const propsPattern = /(\w+)=["']([^"']+)["']/g;
                let propMatch;
                while ((propMatch = propsPattern.exec(p2)) !== null) {
                    props[propMatch[1]] = propMatch[2];
                }
                const propString = JSON.stringify(props).replace(/"(\w+)":/g, '$1:');
                return `\${typeof ${p1} === 'function' ? ${p1}(${propString}) : ''}`;
            });
        } else if (line.match(/:3\s*(\w+)\s*:3/)) {
            return line.replace(/:3\s*(\w+)\s*:3/g, (match, p1) => `\${props.${p1} !== undefined ? props.${p1} : ${p1}}`);
        } else {
            return line;
        }
    }).join('');

    jsCode += `
function render${componentName}(props = {}) {
    const errorHtml = renderErrors(${JSON.stringify(parsedZimp.errors)});
    return \`
    ${renderBody}
    \${errorHtml}
    \`;
}\n`;

    if (componentName === 'App') {
        jsCode += `
function render() {
    const app = document.getElementById('app');
    if (app) {
        if (${isError}) {
            app.innerHTML = renderErrors(${JSON.stringify(parsedZimp.errors)});
        } else {
            app.innerHTML = renderApp();
        }
    } else {
        console.error('Element with ID "app" not found.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    render();
});
`;
    }

    return jsCode;
}

module.exports = compileToJavaScript;