const fs = require('fs');

const fixFile = (file) => {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Check if import is missing
    if (!content.includes('useSystemSettings')) {
        content = content.replace(/import React(.*?)from 'react';/, "import React$1from 'react';\nimport { useSystemSettings } from '../../context/SystemSettingsContext';");
    }

    // 2. Fix itemsPerPage
    if (/const itemsPerPage = \d+;/.test(content)) {
        content = content.replace(/const itemsPerPage = \d+;/, 'const { settings } = useSystemSettings();\n    const itemsPerPage = settings?.tables?.rowsPerPage || 10;');
    }

    fs.writeFileSync(file, content);
};

[
  'src/pages/Newborns/NewbornTracking.jsx',
  'src/pages/Vaccinations/Vaccinations.jsx',
  'src/pages/Prenatal/PrenatalVisits.jsx',
  'src/pages/Postpartum/PostpartumRecords.jsx',
  'src/pages/Inventory/Inventory.jsx',
  'src/pages/HighRisk/HighRiskCases.jsx'
].forEach(f => fixFile(f));
console.log('Fixed imports and pagination successfully');
