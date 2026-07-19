import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hcrpdvizautiuwgmfcqc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjcnBkdml6YXV0aXV3Z21mY3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE2MTQsImV4cCI6MjA4ODQ2NzYxNH0.PMmCVGqe7GR5cAEiTDqJudT-nSLmgVh4_5uJGQXK7XU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    // Let's run a query to select table names from pg_catalog.pg_tables
    // Wait, let's see if we can do custom SQL. Supabase client doesn't let us run raw SQL directly unless we use an RPC.
    // Let's see if there is an RPC we can use, or if we can see error messages or query other tables we know about.
    // Let's check what tables are referenced in our code by doing a grep search for .from('
    // We already did a grep search and found:
    // - newborns
    // - patient_basic_info
    // - pregnancy_info
    // - prenatal_visits
    // - vaccine_records
    // - vaccine_inventory
    // - supplement_inventory
    // - staff_profiles
    // - user_type
    // - users
    // - vaccinations
    // - deliveries
    
    // Wait, let's see if we can query any table list using standard query on one of the tables to see what else exists.
    // Or we can check if there are other tables like "stations", "barangays", "station_reports", etc.
    // Let's write a quick script to list some common tables to see if we get error or data.
    const tablesToCheck = ['stations', 'barangays', 'station_reports', 'inventory_transactions', 'inventory_distribution_history', 'inventory_history', 'distributions', 'distribution_history'];
    for (const table of tablesToCheck) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        // console.log(`Table ${table} error:`, error.message);
      } else {
        console.log(`Table ${table} EXISTS!`);
      }
    }
    console.log('Done checking tables.');
  } catch (err) {
    console.error('Error during test:', err);
  }
}

test();
