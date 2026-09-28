import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual dotenv loading
let envFile = '';
try { envFile += fs.readFileSync('.env', 'utf-8') + '\n'; } catch(e) {}
try { envFile += fs.readFileSync('.env.local', 'utf-8') + '\n'; } catch(e) {}

const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.length > 0 && val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') {
      val = val.substring(1, val.length - 1).replace(/\\n/gm, '\n').replace(/\\"/gm, '"');
    }
    env[key] = val;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function reconcile() {
  console.log("Starting reconciliation...");
  
  // Get all deliveries
  const { data: deliveries, error: deliveryErr } = await supabase
    .from('deliveries')
    .select('id, mother_id, delivery_date');
    
  if (deliveryErr) {
    console.error("Error fetching deliveries:", deliveryErr);
    return;
  }
  
  console.log(`Found ${deliveries.length} deliveries.`);
  
  // Get all scheduled prenatal visits
  const { data: visits, error: visitErr } = await supabase
    .from('prenatal_visits')
    .select('id, patient_id, visit_date, status, next_appt_type')
    .eq('status', 'Scheduled');
    
  if (visitErr) {
    console.error("Error fetching visits:", visitErr);
    return;
  }
  
  console.log(`Found ${visits.length} scheduled visits.`);
  
  let cancelCount = 0;
  
  for (const delivery of deliveries) {
    const deliveryDate = new Date(delivery.delivery_date).setHours(0,0,0,0);
    
    // Find all scheduled visits for this mother that are AFTER the delivery date
    const staleVisits = visits.filter(v => {
      if (v.patient_id !== delivery.mother_id) return false;
      if (String(v.next_appt_type || '').toLowerCase().includes('postpartum')) return false; // Don't cancel postpartum!
      const visitDate = new Date(v.visit_date).setHours(0,0,0,0);
      return visitDate > deliveryDate;
    });
    
    if (staleVisits.length > 0) {
      console.log(`Cancelling ${staleVisits.length} visits for mother ${delivery.mother_id}`);
      
      const staleIds = staleVisits.map(v => v.id);
      const { error: updErr } = await supabase
        .from('prenatal_visits')
        .update({ status: 'Cancelled' })
        .in('id', staleIds);
        
      if (updErr) {
        console.error("Failed to cancel:", updErr);
      } else {
        cancelCount += staleIds.length;
        // Remove them from our local list so we don't process them again
        staleIds.forEach(id => {
          const idx = visits.findIndex(v => v.id === id);
          if (idx !== -1) visits.splice(idx, 1);
        });
      }
    }
  }
  
  console.log(`Reconciliation complete. Cancelled ${cancelCount} stale visits.`);
}

reconcile();
