const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  supabaseTable: process.env.SUPABASE_TABLE || 'tracker_daily_states',
  supabaseClientId: process.env.SUPABASE_CLIENT_ID || 'tracker-daily-default',
};

const content = `window.MIAW_TRACKER_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
const outPath = path.join(__dirname, '..', 'public', 'runtime-config.js');

fs.writeFileSync(outPath, content, 'utf8');
console.log('runtime-config.js generated');
