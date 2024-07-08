const path = require('path');
const { compileZimpFile } = require('./index');
const fs = require('fs');

function compileAndWriteZimp(filePath, outputDir) {
    console.log(`Compiling ${filePath}...`);
    try {
        const compiledJs = compileZimpFile(filePath);
        console.log(`Compilation output: ${compiledJs}`);
        if (!fs.existsSync(outputDir)){
            fs.mkdirSync(outputDir);
        }
        fs.writeFileSync(path.join(outputDir, 'bundle.js'), compiledJs);
        console.log(`Compiled and wrote ${filePath} to ${outputDir}/bundle.js`);
    } catch (error) {
        console.error(`Failed to compile ${filePath}:`, error);
        process.exit(1);
    }
}

if (require.main === module) {
    const inputPath = path.resolve(process.argv[2]);
    const outputPath = path.resolve(process.argv[3]);
    compileAndWriteZimp(inputPath, outputPath);
}

module.exports = {
    compileAndWriteZimp
};
