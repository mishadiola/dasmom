const fs = require('fs');
const content = fs.readFileSync('c:/Users/admin/Documents/DasMom- Capstone 2026/dasmom/src/pages/Analytics/Analytics.jsx', 'utf8');

let lines = content.split('\n');
let braceStack = [];

for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    for (let col = 0; col < line.length; col++) {
        const char = line[col];
        if (char === '{') {
            braceStack.push({ lineNum: r + 1, col: col + 1, text: line.trim() });
        } else if (char === '}') {
            if (braceStack.length > 0) {
                braceStack.pop();
            }
        }
    }
}

console.log("Current unclosed braces stack:");
braceStack.forEach((b, idx) => {
    console.log(`[${idx}] Line ${b.lineNum}: "${b.text}"`);
});
