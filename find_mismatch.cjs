const fs = require('fs');
const content = fs.readFileSync('c:/Users/admin/Documents/DasMom- Capstone 2026/dasmom/src/pages/Analytics/Analytics.jsx', 'utf8');

let lines = content.split('\n');
let stack = [];

for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    for (let col = 0; col < line.length; col++) {
        const char = line[col];
        if (char === '{') {
            stack.push({ line: r + 1, col: col + 1, text: line.trim() });
        } else if (char === '}') {
            if (stack.length === 0) {
                console.log(`Extra closing brace } at line ${r + 1}, col ${col + 1}`);
            } else {
                const opened = stack.pop();
                // If it's a top-level block, let's log it
                if (stack.length === 1) {
                    console.log(`Block closed at line ${r + 1}: matching { at line ${opened.line} "${opened.text}"`);
                }
            }
        }
    }
}
