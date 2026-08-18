const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.+)/);
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
fetch(url + '/rest/v1/?apikey=' + key)
  .then(res => res.json())
  .then(data => {
      fs.writeFileSync('schema.json', JSON.stringify(data, null, 2));
      console.log('Saved schema to schema.json');
  })
  .catch(console.error);
