const fs = require('fs');
let lines = fs.readFileSync('src/pages/Vaccinations/Vaccinations.jsx', 'utf8').split(/\r?\n/);

const newLines = [
    "                    {mode === 'vaccine' && pendingVaccines.length > 0 && (",
    "                        <div className=\"pending-vaccines-section\">",
    "                            <h3 style={{ marginBottom: '4px' }}>Pending Scheduled Vaccines</h3>",
    "                            <p className=\"pending-vaccines-note\">Check any scheduled doses that were administered today to update their records.</p>",
    "                            <div className=\"pending-vaccines-list\">",
    "                                {pendingVaccines.map(v => {",
    "                                    const parts = v.vaccine.split(' - ');",
    "                                    const mainName = parts[0];",
    "                                    const desc = parts.length > 1 ? parts.slice(1).join(' - ') : '';",
    "                                    ",
    "                                    return (",
    "                                        <label key={v.id} className={\"pending-vaccine-card \" + (selectedVaccines[v.id] ? 'selected' : '')}>",
    "                                            <input",
    "                                                type=\"checkbox\"",
    "                                                checked={!!selectedVaccines[v.id]}",
    "                                                onChange={() => setSelectedVaccines(prev => ({ ...prev, [v.id]: !prev[v.id] }))}",
    "                                            />",
    "                                            <div className=\"pending-vaccine-details\">",
    "                                                <div className=\"pending-vaccine-title\">{mainName}</div>",
    "                                                <div className=\"pending-vaccine-desc\">",
    "                                                    {desc ? desc + ' · ' : ''}Dose {v.dose_number}",
    "                                                </div>",
    "                                                <div className=\"pending-vaccine-date\">",
    "                                                    Scheduled: {v.scheduled_vaccination}",
    "                                                </div>",
    "                                            </div>",
    "                                        </label>",
    "                                    );",
    "                                })}",
    "                            </div>",
    "                        </div>",
    "                    )}"
];

lines.splice(922, 16, ...newLines);
fs.writeFileSync('src/pages/Vaccinations/Vaccinations.jsx', lines.join('\n'));
console.log('Replaced JSX.');
