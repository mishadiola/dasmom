// DasmomDatabase.js
import { createClient } from '@supabase/supabase-js'

// Supabase project info
const supabaseUrl = 'https://hcrpdvizautiuwgmfcqc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjcnBkdml6YXV0aXV3Z21mY3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE2MTQsImV4cCI6MjA4ODQ2NzYxNH0.PMmCVGqe7GR5cAEiTDqJudT-nSLmgVh4_5uJGQXK7XU'

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test connection (even if no tables exist yet)
export async function testConnection() {
  const { data, error } = await supabase.from('dummy_table').select('*')
  if (error) {
    console.log('Connection works! Table not found yet:', error.message)
  } else {
    console.log(data)
  }
}

// Optional: test auth
export async function signUpTestUser(email='test@example.com', password='StrongPass123!') {
  const { user, error } = await supabase.auth.signUp({ email, password })
  console.log('Sign Up:', user, error)
}

export async function signInTestUser(email='test@example.com', password='StrongPass123!') {
  const { user, error } = await supabase.auth.signInWithPassword({ email, password })
  console.log('Sign In:', user, error)
}
