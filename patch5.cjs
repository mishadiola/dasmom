const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MotherDashboard.css';
let content = fs.readFileSync(path, 'utf8');

// The desktop block is defined in the root rules.
// Let's replace the .mother-welcome-text-section rules using regex.

// 1. Desktop Spacing
content = content.replace(
    /\.mother-welcome-text-section \.page-title\s*{[^}]+}/,
    `.mother-welcome-text-section .page-title {
    font-size: 38px;
    margin-bottom: 12px;
    font-weight: 800;
}`
);

content = content.replace(
    /\.mother-welcome-text-section \.page-subtitle\s*{[^}]+}/,
    `.mother-welcome-text-section .page-subtitle {
    font-size: 17px;
    line-height: 1.5;
    margin-bottom: 24px;
    opacity: 0.95;
    white-space: nowrap;
    font-weight: 500;
}`
);

// We also need to target the media queries properly.
// @media (max-width: 600px) block starts with:
// /* ══════════════════════════════════════════
//    MOBILE RESPONSIVE (max-width: 600px)
const mobileIndex = content.indexOf('MOBILE RESPONSIVE (max-width: 600px)');
if (mobileIndex !== -1) {
    let beforeMobile = content.slice(0, mobileIndex);
    let mobileContent = content.slice(mobileIndex);

    // tablet query might be above it. Let's do a global replace for tablet first if possible,
    // actually, let's just replace all matches in the file, since desktop/tablet/mobile have different font-sizes currently.
    // Wait, the regex above replaced the FIRST occurrence which is desktop.
}

// 2. Mobile spacing
// In mobile block, the title is currently 14px or 16px.
// Let's just find and replace the specific block inside mobile query.

content = content.replace(
    /@media \(max-width: 600px\) {([\s\S]*?)\/\* ══════════════════════════════════════════/,
    (match, p1) => {
        let block = p1;
        // replace title
        block = block.replace(
            /\.mother-welcome-text-section \.page-title\s*{[^}]+}/,
            `.mother-welcome-text-section .page-title {
        font-size: 16px !important;
        font-weight: 800;
        margin-bottom: 8px;
        line-height: 1.2;
        white-space: nowrap;
    }`
        );
        // replace subtitle
        block = block.replace(
            /\.mother-welcome-text-section \.page-subtitle\s*{[^}]+}/,
            `.mother-welcome-text-section .page-subtitle {
        font-size: 11px;
        line-height: 1.35;
        margin-bottom: 14px;
        font-weight: 500;
    }`
        );
        // replace badges row
        block = block.replace(
            /\.welcome-badges-row\s*{[^}]+}/,
            `.welcome-badges-row {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        gap: 6px;
        align-items: center;
        width: 100%;
        overflow-x: visible;
    }`
        );
        // replace badge
        block = block.replace(
            /\.welcome-badge\s*{[^}]+}/,
            `.welcome-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 8px;
        font-size: 9px;
        border-radius: 8px;
        flex-shrink: 1;
        white-space: nowrap;
    }`
        );
        // replace content wrapper
        block = block.replace(
            /\.mother-welcome-header-content-wrapper\s*{[^}]+}/,
            `.mother-welcome-header-content-wrapper {
        max-width: 100%;
        width: 100%;
        position: relative;
        z-index: 1;
        flex-shrink: 0;
        padding-right: 25%;
    }`
        );
        
        return `@media (max-width: 600px) {${block}/* ══════════════════════════════════════════`;
    }
);

// 3. Tablet Spacing (768px)
content = content.replace(
    /@media \(max-width: 768px\) {([\s\S]*?)(\/\* ════════════════|@media)/,
    (match, p1, p2) => {
        let block = p1;
        // replace title
        block = block.replace(
            /\.mother-welcome-text-section \.page-title\s*{[^}]+}/,
            `.mother-welcome-text-section .page-title {
        font-size: 22px;
        font-weight: 800;
        margin-bottom: 10px;
        line-height: 1.2;
    }`
        );
        // replace subtitle
        block = block.replace(
            /\.mother-welcome-text-section \.page-subtitle\s*{[^}]+}/,
            `.mother-welcome-text-section .page-subtitle {
        white-space: normal;
        font-size: 13px;
        line-height: 1.45;
        margin-bottom: 16px;
    }`
        );
        return `@media (max-width: 768px) {${block}${p2}`;
    }
);

fs.writeFileSync(path, content);
console.log('Regex patched successfully.');
