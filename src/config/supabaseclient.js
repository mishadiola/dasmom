import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

console.log('SUPABASECLIENT LOADED')
console.log('ENV VARS:', import.meta.env)
console.log('URL:', supabaseUrl)
console.log('KEY:', supabaseKey)

if (!supabaseUrl || !supabaseKey) {
    throw new Error('putangina ok ka naman last time')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase





/*
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =import.meta.env.VITE_SUPABASE_KEY


//checking if nagana ba sya nagana naman
console.log('ENV:', import.meta.env)
console.log('URL:', supabaseUrl)
console.log('KEY:', supabaseKey)

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase

//EXPLANATION HIHIHIHI

/*
ganito kasi yan yang code na yan originally: galing yan sa site ng supabase yan dapat talaga nakalagay pero ewan q pano tayo naging vite so ok
vite na lang:

import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://hcrpdvizautiuwgmfcqc.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

pero kasi yung process.env.SUPABASE_KEY is not working sa Vite, kaya kailangan natin gamitin yung import.meta.env.VITE_SUPABASE_KEY para ma-access yung environment variable na nakalagay sa .env file ok na
tapos ung mga variable names na VITE_SUPABASE_URL at VITE_SUPABASE_KEY dapat nagsisimula sa VITE_ para ma-recognize ng Vite bilang environment variables.
tapos yung export default supabase ay para ma-export yung supabase client instance na ginawa natin para magamit ng ibang files natural 
*/


/*

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase

*/