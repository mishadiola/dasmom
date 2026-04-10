const fs = require('fs');
let f = fs.readFileSync('src/pages/Station/StationReports.jsx', 'utf8');

f = f.replace(/className="br-/g, 'className="st-');
f = f.replace(/className={`br-/g, 'className={`st-');
f = f.replace(/ br-/g, ' st-');
f = f.replace(/br-row--/g, 'st-row--');
f = f.replace(/'br-row--/g, '\'st-row--');

fs.writeFileSync('src/pages/Station/StationReports.jsx', f);
console.log('Done');
