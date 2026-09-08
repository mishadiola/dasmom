const fs = require('fs');
const path = 'src/styles/pages/MotherDashboard.css';
let css = fs.readFileSync(path, 'utf8');

// 1. Quick Support Card adjustments
css = css.replace(
    /\.emergency-card \{\n    background: linear-gradient\(135deg, #fff5f7 0%, #ffe4e8 100%\) !important;\n    border: 2px solid rgba\(185, 129, 138, 0\.2\) !important;\n\}/,
    `.emergency-card {\n    background: linear-gradient(135deg, #fff5f7 0%, #ffe4e8 100%) !important;\n    border: 2px solid rgba(185, 129, 138, 0.2) !important;\n    display: flex;\n    flex-direction: column;\n    justify-content: center;\n    padding: 20px 24px !important;\n}`
);

css = css.replace(
    /\.support-header \{\n    display: flex;\n    align-items: center;\n    gap: 16px;\n    margin-bottom: 16px;\n\}/,
    `.support-header {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    margin-bottom: 12px;\n}`
);

css = css.replace(
    /\.support-icon-wrapper \{\n    width: 56px;\n    height: 56px;/,
    `.support-icon-wrapper {\n    width: 48px;\n    height: 48px;`
);

css = css.replace(
    /box-shadow: 0 0 0 12px rgba\(185, 129, 138, 0\);/,
    `box-shadow: 0 0 0 10px rgba(185, 129, 138, 0);`
);

css = css.replace(
    /\.support-title \{\n    font-size: 20px;/,
    `.support-title {\n    font-size: 18px;`
);

css = css.replace(
    /\.support-subtitle \{\n    font-size: 13px;/,
    `.support-subtitle {\n    font-size: 12px;`
);

css = css.replace(
    /\.support-text \{\n    font-size: 14px;\n    line-height: 1\.6;\n    color: var\(--color-text\);\n    margin-bottom: 20px;\n\}/,
    `.support-text {\n    font-size: 13px;\n    line-height: 1.5;\n    color: var(--color-text);\n    margin-bottom: 14px;\n}`
);

css = css.replace(
    /\.support-actions \{\n    display: flex;\n    flex-direction: column;\n    gap: 12px;\n\}/,
    `.support-actions {\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n}`
);

// 2. Milestone card fix
css = css.replace(
    /\.gestation-details-row \{\n    display: grid;\n    grid-template-columns: 1fr 1fr;\n    gap: 16px;\n    margin-bottom: 24px;\n\}/,
    `.gestation-details-row {\n    display: flex;\n    margin-bottom: 24px;\n}`
);

css = css.replace(
    /\.milestone-item \{\n    background: linear-gradient\(135deg, #fff9db 0%, #fff3cd 100%\);\n    border-radius: 12px;\n    padding: 12px;\n\}/,
    `.milestone-item {\n    background: linear-gradient(135deg, #fff9db 0%, #fff3cd 100%);\n    border-radius: 12px;\n    padding: 12px;\n    width: 75%;\n}`
);

css = css.replace(
    /\.appointments-timeline \{\n    display: flex;\n    flex-direction: column;\n    gap: 16px;\n\}/,
    `.appointments-timeline {\n    display: flex;\n    flex-direction: column;\n    gap: 12px;\n}`
);

css = css.replace(
    /\.timeline-item \{\n    display: flex;\n    align-items: flex-start;\n    gap: 16px;\n    padding: 16px;\n    background: #f8f9fb;\n    border-radius: 16px;\n    transition: all 0\.3s ease;\n    cursor: pointer;\n    border: 2px solid transparent;\n    position: relative;\n\}/,
    `.mother-timeline-item {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    padding: 12px 16px 12px 8px;\n    background: #f8f9fb;\n    border-radius: 16px;\n    transition: all 0.3s ease;\n    cursor: pointer;\n    border: 1px solid rgba(185, 129, 138, 0.08);\n    position: relative;\n    width: 100%;\n    box-sizing: border-box;\n}`
);

css = css.replace(
    /\.timeline-item:hover \{\n    transform: translateX\(6px\);/,
    `.mother-timeline-item:hover {\n    transform: translateX(4px);`
);

css = css.replace(
    /\.timeline-dot \{\n    width: 12px;\n    height: 12px;\n    border-radius: 50%;\n    background: var\(--color-rose\);\n    margin-top: 6px;/,
    `.timeline-dot {\n    width: 12px;\n    height: 12px;\n    border-radius: 50%;\n    background: var(--color-rose);\n    margin-top: 0;`
);

css = css.replace(
    /\.timeline-item\.completed \.timeline-dot/g,
    `.mother-timeline-item.completed .timeline-dot`
);

css = css.replace(
    /\.timeline-item\.scheduled \.timeline-dot/g,
    `.mother-timeline-item.scheduled .timeline-dot`
);


fs.writeFileSync(path, css);
console.log('CSS Fixed');
