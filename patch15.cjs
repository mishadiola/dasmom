const fs = require('fs');
const path = 'c:\\Users\\admin\\Documents\\DasMom- Capstone 2026\\dasmom\\src\\styles\\pages\\UserVaccinations.css';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
/* ══════════════════════════════════════════
   VACCINATIONS REDESIGN: MOTHER MOBILE-FIRST
══════════════════════════════════════════ */

@media (max-width: 600px) {
    /* Base Container */
    .user-vaccinations-page {
        padding: 0 0 80px 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
        gap: 16px !important;
    }

    /* ── Compact Hero Header ── */
    .user-vaccinations-page .hero-header-with-img {
        min-height: 0 !important;
        height: auto !important;
        padding: 16px !important;
        border-radius: 16px !important;
        margin-bottom: 0 !important;
        box-sizing: border-box !important;
        width: 100% !important;
    }
    .user-vaccinations-page .hero-content-wrapper {
        width: 100% !important;
        max-width: 65% !important;
        padding-right: 5% !important;
        box-sizing: border-box !important;
    }
    .user-vaccinations-page .page-title {
        font-size: 18px !important;
        margin-bottom: 8px !important;
        display: flex;
        align-items: center;
    }
    .user-vaccinations-page .page-title .header-icon {
        width: 18px !important;
        height: 18px !important;
    }
    .user-vaccinations-page .page-subtitle {
        font-size: 12px !important;
        line-height: 1.4 !important;
        margin-bottom: 12px !important;
    }
    .user-vaccinations-page .hero-badges-row {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
    }
    .user-vaccinations-page .vitals-badge-btn {
        padding: 6px 12px !important;
        font-size: 11px !important;
        white-space: nowrap !important;
        flex: 1 1 auto !important;
        justify-content: center !important;
    }
    .user-vaccinations-page .hero-silhouette-bg {
        top: auto !important;
        bottom: -5% !important;
        right: -5% !important;
        height: auto !important;
        max-height: 120px !important;
        width: 45% !important;
        object-position: right bottom !important;
        opacity: 0.15 !important;
    }

    /* ── Overall Progress ── */
    .uv-progress-section {
        margin-bottom: 0 !important;
        width: 100% !important;
    }
    .uv-progress-card {
        padding: 16px !important;
        border-radius: 16px !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.03) !important;
    }
    .uv-progress-info {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 4px !important;
        margin-bottom: 16px !important;
    }
    .uv-progress-info span {
        font-size: 11px !important;
    }
    .uv-progress-info strong {
        font-size: 15px !important;
        color: var(--color-text-dark) !important;
    }

    /* ── Search + Category Filters ── */
    .uv-controls {
        flex-direction: column !important;
        gap: 12px !important;
        margin-bottom: 0 !important;
    }
    .uv-search-bar {
        width: 100% !important;
        border-radius: 12px !important;
        padding: 10px 16px !important;
    }
    .uv-search-bar input {
        font-size: 14px !important;
    }
    .uv-filters {
        width: 100% !important;
        display: flex !important;
        background: #f8f9fb !important;
        border-radius: 12px !important;
        padding: 4px !important;
        overflow-x: auto !important;
        scrollbar-width: none !important;
    }
    .uv-filters::-webkit-scrollbar { display: none !important; }
    .uv-filter-btn {
        flex: 1 !important;
        text-align: center !important;
        padding: 8px !important;
        font-size: 12px !important;
        border-radius: 8px !important;
        border: none !important;
        background: transparent !important;
        color: var(--color-text-light) !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        gap: 6px !important;
        white-space: nowrap !important;
    }
    .uv-filter-btn.active {
        background: #ffffff !important;
        color: var(--color-rose) !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
    }

    /* ── Vaccination Cards ── */
    .uv-cards-grid {
        display: flex !important;
        flex-direction: column !important;
        gap: 16px !important;
    }
    .uv-vaccine-card {
        padding: 16px !important;
        border-radius: 16px !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.04) !important;
        border: 1px solid rgba(185, 129, 138, 0.08) !important;
        background: #ffffff !important;
    }
    .uv-card-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 12px !important;
    }
    
    /* Category Tag (MY VACCINE) */
    .uv-category-tag {
        font-size: 10px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        padding: 4px 8px !important;
        border-radius: 6px !important;
        background: rgba(185, 129, 138, 0.1) !important;
        color: var(--color-rose) !important;
    }

    /* Status Badges */
    .uv-status-badge {
        font-size: 11px !important;
        font-weight: 600 !important;
        padding: 4px 8px !important;
        border-radius: 6px !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
    }
    .uv-status-badge svg {
        width: 12px !important;
        height: 12px !important;
    }
    /* Specific Status Colors */
    .uv-status-badge.status-pending, 
    .uv-status-badge.status-upcoming { background: #f0f9ff !important; color: #0369a1 !important; border: 1px solid #bae6fd !important; }
    
    .uv-status-badge.status-completed { background: #f0fdf4 !important; color: #166534 !important; border: 1px solid #bbf7d0 !important; }
    
    .uv-status-badge.status-missed,
    .uv-status-badge.status-overdue { background: #fef2f2 !important; color: #991b1b !important; border: 1px solid #fecaca !important; }

    /* Vaccine Name */
    .uv-vaccine-name {
        font-size: 18px !important;
        font-weight: 800 !important;
        color: var(--color-text-dark) !important;
        margin: 0 0 16px 0 !important;
        line-height: 1.3 !important;
    }

    /* Inner Details Container (Soft Pastel Background) */
    .uv-vaccine-schedule {
        background: #f8f9fb !important;
        border-radius: 12px !important;
        padding: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        margin-bottom: 16px !important;
    }
    .uv-schedule-item {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
    }
    .uv-schedule-item .label {
        font-size: 12px !important;
        font-weight: 500 !important;
        color: var(--color-text-light) !important;
    }
    .uv-schedule-item .value {
        font-size: 13px !important;
        font-weight: 700 !important;
        color: var(--color-text-dark) !important;
    }

    /* Footer: Click for details */
    .uv-card-footer {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding-top: 12px !important;
        border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        color: var(--color-rose) !important;
    }
    .uv-card-footer svg {
        color: var(--color-rose) !important;
    }

    /* Hide descriptions to keep card compact */
    .uv-vaccine-desc {
        display: none !important;
    }
    .uv-vaccine-person {
        display: none !important; /* Replaced by top badge */
    }
}
`;

content += newCSS;
fs.writeFileSync(path, content);
console.log('Appended Vaccinations Mobile Redesign CSS rules.');
