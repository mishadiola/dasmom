const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MotherDashboard.css';
let content = fs.readFileSync(path, 'utf8');

// The block we are replacing is inside `@media (max-width: 600px)`

const oldHeroBlock = `    /* ── Hero: COMPACT ── */
    .mother-welcome-header-with-img {
        min-height: 0 !important;
        height: auto !important;
        padding: 10px !important; /* Smaller padding */
        border-radius: 12px;
        margin-bottom: 0;
        position: relative;
        overflow: hidden;
        align-items: flex-start;
        display: flex;
        box-sizing: border-box;
    }

    .mother-welcome-header-content-wrapper {
        max-width: 65%;
        width: 65%;
        position: relative;
        z-index: 1;
        flex-shrink: 0;
    }

    .mother-welcome-text-section .page-title {
        font-size: 16px !important;
        font-weight: 800;
        margin-bottom: 2px;
        line-height: 1.1;
    }

    .mother-welcome-text-section .page-subtitle {
        font-size: 10px;
        line-height: 1.25;
        margin-bottom: 6px;
        font-weight: 500;
    }

    .welcome-badges-row {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap; /* keep them tight */
        gap: 4px;
        align-items: center;
        max-width: 100%;
        overflow-x: auto;
    }
    
    .welcome-badges-row::-webkit-scrollbar { display: none; }

    .welcome-badge {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 4px 6px;
        font-size: 8.5px;
        border-radius: 6px;
        flex-shrink: 0;
    }`;

const newHeroBlock = `    /* ── Hero: COMPACT ── */
    .mother-welcome-header-with-img {
        min-height: 0 !important;
        height: auto !important;
        padding: 12px !important; /* Slightly more comfortable padding */
        border-radius: 12px;
        margin-bottom: 0;
        position: relative;
        overflow: hidden;
        align-items: flex-start;
        display: flex;
        box-sizing: border-box;
    }

    .mother-welcome-header-content-wrapper {
        max-width: 75%; /* Allow more width for buttons */
        width: 75%;
        position: relative;
        z-index: 1;
        flex-shrink: 0;
    }

    .mother-welcome-text-section .page-title {
        font-size: 14px !important; /* Slightly smaller H1 */
        font-weight: 800;
        margin-bottom: 6px; /* Noticeable gap below H1 */
        line-height: 1.2;
    }

    .mother-welcome-text-section .page-subtitle {
        font-size: 9px; /* Slightly smaller text */
        line-height: 1.35;
        margin-bottom: 12px; /* Gap above buttons */
        font-weight: 500;
    }

    .welcome-badges-row {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap; /* Allow wrapping if absolutely necessary, to prevent cutoff */
        gap: 4px;
        align-items: center;
        max-width: 100%;
        overflow-x: hidden;
    }

    .welcome-badge {
        display: flex;
        align-items: center;
        gap: 3px;
        padding: 4px 6px;
        font-size: 8px; /* Slightly smaller to fit both comfortably */
        border-radius: 6px;
        flex-shrink: 1;
        white-space: nowrap;
    }`;

if (content.includes(oldHeroBlock)) {
    content = content.replace(oldHeroBlock, newHeroBlock);
    fs.writeFileSync(path, content);
    console.log('Patched MotherDashboard.css hero section.');
} else {
    console.log('Error: Could not find the old hero block.');
}
