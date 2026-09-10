// Wake & Move — Supabase connection config
//
// HOW TO USE THIS FILE:
// 1. Create a Supabase project at supabase.com.
// 2. In your project dashboard, go to Settings -> API.
// 3. Copy the "Project URL" and the "anon public" key.
// 4. Make a copy of this file named `config.js` (same folder) and paste
//    your own values in below.
// 5. `config.js` is what index.html actually loads — this file
//    (config.example.js) is just the template, safe to commit to GitHub
//    with placeholder values so collaborators know what's needed.
//
// Note: the "anon public" key is meant to be used in client-side code —
// it is not a secret. Access control is enforced by the Row Level
// Security policies in supabase/schema.sql, not by hiding this key.

window.SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
window.SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";
