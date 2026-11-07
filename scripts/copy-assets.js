const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`No assets to copy from ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`Copied assets → ${dest}`);
}

// WhatsApp media assets
copyDir(
  path.join(__dirname, '..', 'src', 'modules', 'whatsapp', 'assets'),
  path.join(__dirname, '..', 'dist', 'src', 'modules', 'whatsapp', 'assets'),
);

// WhatsApp Flow JSON definitions (upload to Meta Flows)
copyDir(
  path.join(__dirname, '..', 'src', 'modules', 'whatsapp-flows', 'flows'),
  path.join(__dirname, '..', 'dist', 'src', 'modules', 'whatsapp-flows', 'flows'),
);
