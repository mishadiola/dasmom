const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    let val = value.join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key.trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY);

async function run() {
  const { data: visits, error } = await supabase.from('prenatal_visits').select('*');
  if (error) {
    console.error('Error fetching visits', error);
    return;
  }
  
  let updatedCount = 0;
  for (const visit of visits) {
    if (!visit.risk_factors) continue;
    
    const factors = visit.risk_factors.split(',').map(s => s.trim()).filter(Boolean);
    const newFactors = factors.filter(f => {
      if (f === 'Hypothermia' && (visit.temp_c === null || visit.temp_c === '')) return false;
      if (f === 'Abnormal pulse' && (visit.pulse_bpm === null || visit.pulse_bpm === '')) return false;
      if (f === 'Abnormal respiratory rate' && (visit.resp_rate_cpm === null || visit.resp_rate_cpm === '')) return false;
      if (f === 'Abnormal fetal heart rate' && (visit.fhr_bpm === null || visit.fhr_bpm === '')) return false;
      return true;
    });
    
    if (factors.length !== newFactors.length) {
      const riskLevel = newFactors.length > 0 ? 'High Risk' : 'Normal';
      const riskStr = newFactors.length > 0 ? newFactors.join(', ') : null;
      
      console.log(`Fixing visit ${visit.id} for patient ${visit.patient_id}`);
      console.log(`  Old: ${visit.risk_factors}`);
      console.log(`  New: ${riskStr}`);
      
      const { error: updateError } = await supabase.from('prenatal_visits')
        .update({ risk_factors: riskStr, calculated_risk: riskLevel })
        .eq('id', visit.id);
        
      if (updateError) console.error('Update error', updateError);
      else updatedCount++;
    }
  }
  console.log('Fixed', updatedCount, 'visits.');
}

run();
