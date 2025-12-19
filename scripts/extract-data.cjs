// Script to extract chat data from words.js into separate JSON files
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Read the words.js file  
const wordsPath = path.join(__dirname, '..', 'src', 'words.js');
const content = fs.readFileSync(wordsPath, 'utf8');

// Create a context with exports
const myExports = {};
const moduleContent = content.replace(/export const /g, 'myExports.');

try {
    vm.runInNewContext(moduleContent, { myExports }, { timeout: 120000 });
} catch (e) {
    console.error('Error evaluating words.js:', e.message);
    process.exit(1);
}

console.log('Exports found:', Object.keys(myExports));

// Create output directory
const outputDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Data exports to extract (excluding functions and small objects)
const dataExports = ['rawChatData', 'fullHistory', 'historyByDate', 'nightSkyData', 'bossModeData'];

dataExports.forEach(key => {
    if (myExports[key]) {
        const data = myExports[key];
        const size = JSON.stringify(data).length;
        console.log(`${key}: ${size} bytes`);

        fs.writeFileSync(
            path.join(outputDir, `${key}.json`),
            JSON.stringify(data),
            'utf8'
        );
        console.log(`Written ${key}.json`);
    }
});

// Keep speakerNames for the minimal words.js
console.log('\nspeakerNames:', myExports.speakerNames);
console.log('generateWords function exists:', typeof myExports.generateWords === 'function');
