const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\MotherDashboard.css';
let content = fs.readFileSync(path, 'utf8');

// 1. Desktop Spacing Update
const oldDesktopSpacing = `.mother-welcome-text-section .page-title {
    font-size: 38px;
    margin-bottom: 28px; /* Noticeably more spacing below title */
    font-weight: 800;
}

.mother-welcome-text-section .page-subtitle {
    font-size: 17px;
    line-height: 1.5;
    margin-bottom: 56px; /* Noticeably more spacing below subtitle */
    opacity: 0.95;
    white-space: nowrap;
    font-weight: 500;
}`;

const newDesktopSpacing = `.mother-welcome-text-section .page-title {
    font-size: 38px;
    margin-bottom: 12px; /* Noticeable small gap */
    font-weight: 800;
}

.mother-welcome-text-section .page-subtitle {
    font-size: 17px;
    line-height: 1.5;
    margin-bottom: 24px; /* Small gap above buttons */
    opacity: 0.95;
    white-space: nowrap;
    font-weight: 500;
}`;

if (content.includes(oldDesktopSpacing)) {
    content = content.replace(oldDesktopSpacing, newDesktopSpacing);
} else {
    console.log("oldDesktopSpacing not found!");
}

// 2. Mobile Hero Update
const oldMobileHero = `    .mother-welcome-text-section .page-title {
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

const newMobileHero = `    .mother-welcome-text-section .page-title {
        font-size: 18px !important; /* Slightly smaller than desktop but not excessively small */
        font-weight: 800;
        margin-bottom: 8px; /* Noticeable small gap */
        line-height: 1.2;
        white-space: nowrap; /* Keep on one line */
    }

    .mother-welcome-text-section .page-subtitle {
        font-size: 12px; /* Slightly smaller than desktop */
        line-height: 1.35;
        margin-bottom: 14px; /* Another small gap before buttons */
        font-weight: 500;
    }

    .welcome-badges-row {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap; /* Do not stack */
        gap: 6px;
        align-items: center;
        width: 100%;
        overflow-x: visible; /* Prevent clipping */
    }

    .welcome-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 8px;
        font-size: 9px; /* Reduce font to fit both buttons fully visible */
        border-radius: 8px;
        flex-shrink: 1; /* Allow shrinking if needed */
        white-space: nowrap; /* Prevent text clipping inside */
    }`;

if (content.includes(oldMobileHero)) {
    content = content.replace(oldMobileHero, newMobileHero);
} else {
    console.log("oldMobileHero not found!");
}

// 3. Tablet spacing update (tablet media query)
const oldTabletSpacing = `    .mother-welcome-text-section .page-title {
        font-size: 22px;
        font-weight: 800;
        margin-bottom: 6px;
        line-height: 1.2;
    }

    .mother-welcome-text-section .page-subtitle {
        white-space: normal;
        font-size: 13px;
        line-height: 1.45;
        margin-bottom: 12px;
    }`;

const newTabletSpacing = `    .mother-welcome-text-section .page-title {
        font-size: 22px;
        font-weight: 800;
        margin-bottom: 10px; /* Noticeable small gap */
        line-height: 1.2;
    }

    .mother-welcome-text-section .page-subtitle {
        white-space: normal;
        font-size: 13px;
        line-height: 1.45;
        margin-bottom: 16px; /* Another small gap before buttons */
    }`;

if (content.includes(oldTabletSpacing)) {
    content = content.replace(oldTabletSpacing, newTabletSpacing);
} else {
    console.log("oldTabletSpacing not found!");
}

// 4. Update the content wrapper width on mobile to 100% to guarantee room for buttons
const oldWrapper = `.mother-welcome-header-content-wrapper {
        max-width: 75%; /* Allow more width for buttons */
        width: 75%;
        position: relative;
        z-index: 1;
        flex-shrink: 0;
    }`;
const newWrapper = `.mother-welcome-header-content-wrapper {
        max-width: 100%; /* Use full width to ensure buttons fit */
        width: 100%;
        position: relative;
        z-index: 1;
        flex-shrink: 0;
        padding-right: 25%; /* Keep right padding so text doesn't overlap silhouette too much */
    }`;

if (content.includes(oldWrapper)) {
    content = content.replace(oldWrapper, newWrapper);
}

fs.writeFileSync(path, content);
console.log("Patched successfully.");
