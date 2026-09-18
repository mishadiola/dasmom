const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');
const motherPagesDir = path.join(srcDir, 'pages', 'MotherDashboard');
const motherComponentsDir = path.join(srcDir, 'components', 'MotherDashboard');

const extractKeys = (dir) => {
    let keys = new Set();
    if (!fs.existsSync(dir)) return keys;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            extractKeys(fullPath).forEach(k => keys.add(k));
        } else if (file.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // matches t('...') or t("...")
            const regex = /t\(['"](.*?)['"]\)/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                keys.add(match[1]);
            }
        }
    });
    return keys;
};

const allKeys = new Set([...extractKeys(motherPagesDir), ...extractKeys(motherComponentsDir)]);

const translationsPath = path.join(srcDir, 'utils', 'translations.js');
let translationsContent = fs.readFileSync(translationsPath, 'utf8');

// Find missing keys
const missingKeys = [];
allKeys.forEach(key => {
    if (!translationsContent.includes(`"${key}"`) && !translationsContent.includes(`'${key}'`)) {
        missingKeys.push(key);
    }
});

console.log('Missing Keys Count:', missingKeys.length);
fs.writeFileSync('missing_keys.json', JSON.stringify(missingKeys, null, 2));
console.log('Saved to missing_keys.json');
