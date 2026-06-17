const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hcrpdvizautiuwgmfcqc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjcnBkdml6YXV0aXV3Z21mY3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE2MTQsImV4cCI6MjA4ODQ2NzYxNH0.PMmCVGqe7GR5cAEiTDqJudT-nSLmgVh4_5uJGQXK7XU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('email_address, usertype');
      
    if (error) throw error;
    console.log('USERS IN DATABASE:');
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error fetching users:', err);
  }
}

listUsers();
