/**
 * Remove stray .d.ts under dist/ from older builds (declaration: true).
 */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.d.ts')) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
}

walk(path.join(__dirname, '..', 'dist'));
