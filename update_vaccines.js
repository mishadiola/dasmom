const fs = require('fs');

// UPDATE JSX
let jsx = fs.readFileSync('src/pages/Vaccinations/Vaccinations.jsx', 'utf8');

const oldRegex = /\{mode === 'vaccine' && pendingVaccines\.length > 0 && \([\s\S]*?<div className="pending-vaccines-section">[\s\S]*?<h3>Pending Scheduled Vaccines<\/h3>[\s\S]*?<p className="pending-vaccines-note">Check any scheduled doses that were administered today to update their records\.<\/p>[\s\S]*?\{pendingVaccines\.map\(v => \([\s\S]*?<label key=\{v\.id\} className="pending-vaccine-item">[\s\S]*?<input[\s\S]*?type="checkbox"[\s\S]*?checked=\{!!selectedVaccines\[v\.id\]\}[\s\S]*?onChange=\{\(\) => setSelectedVaccines\(prev => \(\{ \.\.\.prev, \[v\.id\]: !prev\[v\.id\] \}\)\)\}[\s\S]*?\/>[\s\S]*?\{v\.vaccine\} \(Dose \{v\.dose_number\}\)[^\{]*\{v\.scheduled_vaccination\}[\s\S]*?<\/label>[\s\S]*?\)\)\}[\s\S]*?<\/div>[\s\S]*?\)\}/m;

const newJSX = \{mode === 'vaccine' && pendingVaccines.length > 0 && (
                          <div className="pending-vaccines-section">
                              <h3 style={{ marginBottom: '4px' }}>Pending Scheduled Vaccines</h3>
                              <p className="pending-vaccines-note">Check any scheduled doses that were administered today to update their records.</p>
                              <div className="pending-vaccines-list">
                                  {pendingVaccines.map(v => {
                                      const parts = v.vaccine.split(' - ');
                                      const mainName = parts[0];
                                      const desc = parts.length > 1 ? parts.slice(1).join(' - ') : '';
                                      
                                      return (
                                          <label key={v.id} className={\\\pending-vaccine-card \\\\}>
                                              <input
                                                  type="checkbox"
                                                  checked={!!selectedVaccines[v.id]}
                                                  onChange={() => setSelectedVaccines(prev => ({ ...prev, [v.id]: !prev[v.id] }))}
                                              />
                                              <div className="pending-vaccine-details">
                                                  <div className="pending-vaccine-title">{mainName}</div>
                                                  <div className="pending-vaccine-desc">
                                                      {desc ? \\\\ · \\\ : ''}Dose {v.dose_number}
                                                  </div>
                                                  <div className="pending-vaccine-date">
                                                      Scheduled: {v.scheduled_vaccination}
                                                  </div>
                                              </div>
                                          </label>
                                      );
                                  })}
                              </div>
                          </div>
                      )}\;

if (oldRegex.test(jsx)) {
    jsx = jsx.replace(oldRegex, newJSX);
    fs.writeFileSync('src/pages/Vaccinations/Vaccinations.jsx', jsx);
    console.log('JSX successfully updated.');
} else {
    console.log('Regex did not match the JSX block.');
}

// APPEND CSS
const css = \

/* Pending Scheduled Vaccines UI */
.pending-vaccines-section {
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
}

.pending-vaccines-note {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 12px;
}

.pending-vaccines-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 250px;
    overflow-y: auto;
    padding-right: 5px;
}

.pending-vaccines-list::-webkit-scrollbar {
    width: 6px;
}
.pending-vaccines-list::-webkit-scrollbar-track {
    background: transparent;
}
.pending-vaccines-list::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 4px;
}

.pending-vaccine-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background-color: #f8fafc;
    cursor: pointer;
    transition: all 0.2s ease;
}

.pending-vaccine-card:hover {
    border-color: #cbd5e1;
    background-color: #f1f5f9;
}

.pending-vaccine-card.selected {
    border-color: #b9818a;
    background-color: #fcf9fa;
    box-shadow: 0 2px 4px rgba(185, 129, 138, 0.1);
}

.pending-vaccine-card input[type="checkbox"] {
    margin-top: 3px;
    cursor: pointer;
    width: 16px;
    height: 16px;
    accent-color: #b9818a;
}

.pending-vaccine-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
}

.pending-vaccine-title {
    font-size: 14px;
    font-weight: 600;
    color: #334155;
    line-height: 1.2;
}

.pending-vaccine-desc {
    font-size: 12px;
    color: #64748b;
    line-height: 1.4;
}

.pending-vaccine-date {
    font-size: 12px;
    font-weight: 500;
    color: #b9818a;
    margin-top: 2px;
}

@media (max-width: 600px) {
    .pending-vaccine-card {
        padding: 10px;
        gap: 10px;
    }
}
\;
fs.appendFileSync('src/styles/pages/Vaccinations.css', css);
console.log('CSS successfully appended.');
