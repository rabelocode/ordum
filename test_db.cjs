const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.example' });
console.log(process.env.VITE_SUPABASE_URL ? "URL present" : "No URL");
