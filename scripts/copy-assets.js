const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'modules', 'whatsapp', 'assets');
const dest = path.join(__dirname, '..', 'dist', 'src', 'modules', 'whatsapp', 'assets');

if (!fs.existsSync(src)) {
  console.log('No whatsapp assets to copy.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied assets → ${dest}`);
