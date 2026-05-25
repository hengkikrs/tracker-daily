const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env.local');
const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_TABLE', 'SUPABASE_CLIENT_ID'];

if (!fs.existsSync(envPath)) {
  console.error('.env.local not found');
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  });

required.forEach((name) => {
  if (!env[name]) {
    console.error(`${name} is missing in .env.local`);
    process.exitCode = 1;
    return;
  }

  const result = spawnSync('npx', ['vercel', 'env', 'add', name, 'production'], {
    input: `${env[name]}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) process.exitCode = result.status || 1;
});
