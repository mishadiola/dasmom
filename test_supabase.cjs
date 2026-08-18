require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY);
sb.from('vaccine_inventory').select('id, status').limit(1).then(res => console.log('Response:', JSON.stringify(res))).catch(console.error);
