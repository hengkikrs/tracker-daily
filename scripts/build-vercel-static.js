const fs = require('fs');
const path = require('path');

require('./write-config');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'public');
const outputDir = path.join(root, '.vercel', 'output');
const staticDir = path.join(outputDir, 'static');

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
      return;
    }
    fs.copyFileSync(sourcePath, targetPath);
  });
}

fs.rmSync(staticDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'config.json'), `${JSON.stringify({ version: 3 }, null, 2)}\n`);
copyDir(sourceDir, staticDir);

console.log('Vercel static output generated');
